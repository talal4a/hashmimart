import { createClient } from '@supabase/supabase-js'

// Direct Order speech-to-text. The customer records what they need, the app
// uploads it under 'order-text/' in the voice-notes bucket, and this endpoint
// turns it into text they can review and edit before placing the order.
//
// /translations (not /transcriptions) on purpose: whatever the customer speaks
// — Urdu, Roman Urdu, English or a mix — comes back as English, so staff read
// one consistent list and product names match the catalogue. It also sidesteps
// Whisper writing spoken Urdu in Devanagari (see api/support-chat.js).
const STT_MODEL = 'whisper-large-v3'
const AUDIO_PREFIX = 'order-text/'
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

async function transcribe(audioBlob, apiKey) {
  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', STT_MODEL)
  form.append('response_format', 'json')
  // Nudges Whisper toward a shopping list instead of prose.
  form.append(
    'prompt',
    'Grocery order list with quantities, e.g. 2 kg sugar, 1 dozen eggs, 1 pack tea.',
  )

  const resp = await fetch('https://api.groq.com/openai/v1/audio/translations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!resp.ok) {
    // Log status only — never echo the request, it carries the API key.
    const detail = await resp.text().catch(() => '')
    console.error('[transcribe-order] Groq failed:', resp.status, detail)
    throw new Error('Could not convert your voice to text')
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

  if (!groqApiKey || !supabaseUrl || !serviceRoleKey) {
    console.error('[transcribe-order] GROQ_API_KEY / Supabase env vars missing')
    return res.status(500).json({ error: 'Voice to text is not configured' })
  }

  const body =
    typeof req.body === 'string' ? safeParse(req.body) : req.body || {}
  const path = body.path

  // The service-role key bypasses Storage RLS, and the voice-notes bucket also
  // holds older order recordings at its root. Only ever read and delete files
  // under the prefix this endpoint owns, and reject traversal out of it.
  if (
    !path ||
    typeof path !== 'string' ||
    !path.startsWith(AUDIO_PREFIX) ||
    path.includes('..')
  ) {
    return res.status(400).json({ error: 'Invalid audio path' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: audioBlob, error: dlErr } = await supabase.storage
      .from('voice-notes')
      .download(path)

    if (dlErr || !audioBlob) {
      console.error('[transcribe-order] download failed:', dlErr?.message)
      return res.status(404).json({ error: 'Recording not found' })
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return res.status(400).json({ error: 'Recording is too long' })
    }

    const text = await transcribe(audioBlob, groqApiKey)

    // The recording is single-use: only the text is kept. Best-effort.
    supabase.storage
      .from('voice-notes')
      .remove([path])
      .then(({ error }) => {
        if (error) console.warn('[transcribe-order] cleanup failed:', error.message)
      })
      .catch(() => {})

    return res.status(200).json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[transcribe-order] fatal:', message)
    return res.status(502).json({ error: message })
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
