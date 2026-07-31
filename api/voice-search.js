import { createClient } from '@supabase/supabase-js'

// Words that carry no product signal — dropped before matching so a spoken
// sentence ("mujhe fresh milk chahiye" / "i want some rice") reduces to the
// meaningful tokens. Covers English + common Roman-Urdu filler.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'us', 'you', 'want', 'need',
  'get', 'give', 'buy', 'order', 'please', 'some', 'any', 'of', 'for',
  'to', 'and', 'or', 'with', 'is', 'are', 'do', 'have', 'can', 'would',
  'like', 'looking', 'show', 'find', 'search', 'mujhe', 'muje', 'chahiye',
  'chahie', 'chaiye', 'de', 'do', 'dedo', 'ek', 'aik', 'ka', 'ki', 'ke',
  'ko', 'hai', 'chahiyе', 'lena', 'leni', 'lele',
])

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

// Score a product against the spoken tokens. Name matches weigh most, then
// product category, then shopping mode, then a soft description bonus. Returns
// a number; 0 means no overlap at all.
function scoreProduct(product, tokens) {
  const name = tokenize(product.name)
  const category = tokenize(product.product_category?.name)
  const mode = tokenize(product.shopping_mode?.slug)
  const description = tokenize(product.description)

  const nameSet = new Set(name)
  const categorySet = new Set(category)
  const modeSet = new Set(mode)
  const descriptionSet = new Set(description)

  let score = 0
  for (const t of tokens) {
    if (nameSet.has(t)) score += 3
    if (categorySet.has(t)) score += 2
    if (modeSet.has(t)) score += 1
    if (descriptionSet.has(t)) score += 1
  }
  return score
}

async function transcribe(audioBlob, apiKey) {
  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-large-v3')
  form.append('response_format', 'json')

  const resp = await fetch('https://api.groq.com/openai/v1/audio/translations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!resp.ok) {
    // Surface a generic message — never echo the request (it carries the key).
    const detail = await resp.text().catch(() => '')
    console.error('[voice-search] Groq translation failed:', resp.status, detail)
    throw new Error('Transcription service failed')
  }

  const data = await resp.json()
  return String(data.text || '').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!groqApiKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' })
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return res
      .status(500)
      .json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  // Vercel parses JSON bodies automatically, but guard against a raw string.
  const body =
    typeof req.body === 'string' ? safeParse(req.body) : req.body || {}
  const path = body.path

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing audio path' })
  }

  // This endpoint downloads and then DELETES `path` with the service-role key,
  // which bypasses Storage RLS. The 'voice-notes' bucket is shared with order
  // voice notes (stored at the bucket root), so an unconstrained path would let
  // any caller destroy a customer's order recording. Only ever touch the
  // 'search/' prefix this endpoint owns, and reject traversal out of it.
  if (!path.startsWith('search/') || path.includes('..')) {
    return res.status(400).json({ error: 'Invalid audio path' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // ── 1. Download the uploaded audio (service role bypasses Storage RLS) ──
    const { data: audioBlob, error: dlErr } = await supabase.storage
      .from('voice-notes')
      .download(path)

    if (dlErr || !audioBlob) {
      console.error('[voice-search] download failed:', dlErr?.message)
      return res.status(404).json({ error: 'Audio not found' })
    }

    // ── 2. Transcribe + translate to English via Groq ──────────────────────
    const transcript = await transcribe(audioBlob, groqApiKey)

    // Best-effort cleanup — the audio is single-use, delete regardless of match.
    supabase.storage
      .from('voice-notes')
      .remove([path])
      .then(({ error }) => {
        if (error) console.warn('[voice-search] cleanup failed:', error.message)
      })

    if (!transcript) {
      return res.status(200).json({ transcript: '', product: null })
    }

    // ── 3. Match against in-stock products ─────────────────────────────────
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select(
        '*, shopping_mode:shopping_modes(slug), product_category:product_categories(name)',
      )
      .eq('in_stock', true)

    if (prodErr) {
      console.error('[voice-search] product query failed:', prodErr.message)
      return res.status(500).json({ error: 'Product lookup failed' })
    }

    const tokens = tokenize(transcript)
    let best = null
    let bestScore = 0

    for (const p of products || []) {
      const score = scoreProduct(p, tokens)
      if (score > bestScore) {
        best = p
        bestScore = score
      } else if (score === bestScore && score > 0 && best) {
        // Tie-break toward the more specific product (shorter name).
        if (tokenize(p.name).length < tokenize(best.name).length) best = p
      }
    }

    const product =
      best && bestScore > 0
        ? {
            id: best.id,
            name: best.name,
            price: best.price != null ? Number(best.price) : null,
            salePrice: best.sale_price != null ? Number(best.sale_price) : null,
            unit: best.unit,
            image: best.image,
            imageUrl: best.image_url,
            category: best.shopping_mode?.slug,
            productCategory: best.product_category?.name,
          }
        : null

    return res.status(200).json({ transcript, product })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[voice-search] fatal:', message)
    return res.status(500).json({ error: message })
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
