import { createClient } from '@supabase/supabase-js'

// ── Model choices ──────────────────────────────────────────────────────────
// whisper-large-v3 handles Urdu well and, via /transcriptions, returns text in
// the ORIGINAL language (unlike /translations, which forces English — that's
// what api/voice-search.js wants, but the opposite of what support needs).
const STT_MODEL = 'whisper-large-v3'
const CHAT_MODEL = 'qwen/qwen3.6-27b'

const MAX_MESSAGE_CHARS = 2000
const MAX_HISTORY = 10
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

const SYSTEM_PROMPT = `You are the customer support assistant for Hashmi Mart, a Pakistani grocery store that delivers in Lahore. You help customers in a WhatsApp-style chat.

LANGUAGE — this matters most:
- Reply in the SAME language and script the customer used.
- Proper Urdu script (اردو) in, proper Urdu script out.
- Roman Urdu ("mujhe milk chahiye") in, Roman Urdu out.
- English in, English out.
- Mixed/Urdu-English ("order kahan hai?") — mirror that same mix.
- Never announce or explain which language you are using. Just answer.

WHAT YOU KNOW:
- Delivery is Lahore only, and the city field is fixed to Lahore.
- Payment: Cash on Delivery, or JazzCash (customer transfers first, then the order is processed once payment is verified).
- Order statuses: pending, approved, preparing, out_for_delivery, delivered, cancelled.
- Customers can order two ways: add items to the cart and check out normally, OR use "Direct Order" to send a voice note listing what they need — staff listen and confirm the items and total afterwards. A Direct Order shows its total as "To be decided" until staff set it.
- There is voice search for finding products by speaking.

STYLE:
- Short and warm. Two or three sentences is usually plenty for a chat bubble.
- Plain text only. No markdown, asterisks, bullet characters, or headings.
- One clear next step when the customer needs to act.

HONESTY RULES — do not break these:
- You cannot see the customer's account, cart, or order history. You have no database access.
- Never invent an order status, delivery time, price, total, or refund decision.
- If asked something specific about their order ("where is my order", "when will it arrive"), say you cannot look it up from here and tell them to check My Orders in the app, or that staff will confirm.
- Never promise a refund, discount, or exact delivery time. Say a staff member will confirm.
- If you don't know, say so plainly and point them to human staff.`

function badRequest(res, message) {
  return res.status(400).json({ error: message })
}

async function requestTranscription(audioBuffer, mimeType, apiKey, language) {
  const form = new FormData()
  form.append('file', new Blob([audioBuffer], { type: mimeType }), 'audio.webm')
  form.append('model', STT_MODEL)
  // verbose_json also returns the detected language, which we need to correct
  // the Hindi/Urdu confusion below.
  form.append('response_format', 'verbose_json')
  if (language) form.append('language', language)

  const resp = await fetch(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
  )

  if (!resp.ok) {
    // Log status only — never echo the request, it carries the API key.
    const detail = await resp.text().catch(() => '')
    console.error('[support-chat] transcription failed:', resp.status, detail)
    throw new Error('Could not understand the voice note')
  }

  const data = await resp.json()
  return {
    text: String(data.text || '').trim(),
    language: String(data.language || '').toLowerCase(),
  }
}

// Spoken Urdu and Hindi are near-identical, so Whisper's auto-detect often
// tags Pakistani speech as Hindi and writes it in Devanagari — wrong script for
// an Urdu-speaking customer. Verified against the live API:
//   auto-detect        → Roman-Urdu speech comes back as Devanagari
//   forced language=ur → English speech gets mangled into Urdu
// So: auto-detect first, and only re-run with the Urdu hint when the result
// came back as Hindi. English and Urdu are both detected correctly first time.
async function transcribe(audioBuffer, mimeType, apiKey) {
  const first = await requestTranscription(audioBuffer, mimeType, apiKey)

  if (first.language === 'hindi') {
    try {
      const retry = await requestTranscription(
        audioBuffer,
        mimeType,
        apiKey,
        'ur',
      )
      if (retry.text) return retry.text
    } catch (err) {
      // Fall through to the Devanagari text rather than failing the message.
      console.error('[support-chat] urdu retry failed:', err?.message)
    }
  }

  return first.text
}

async function chat(history, userText, apiKey) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userText },
  ]

  const resp = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 600,
      }),
    },
  )

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    console.error('[support-chat] completion failed:', resp.status, detail)
    throw new Error('Support assistant is unavailable')
  }

  const data = await resp.json()
  const reply = String(data.choices?.[0]?.message?.content || '').trim()
  if (!reply) throw new Error('Support assistant returned an empty reply')
  return reply
}

// Only keep the fields the Groq API accepts, drop anything client-supplied
// that could confuse the model (ids, timestamps, injected system roles).
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim(),
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    console.error('[support-chat] GROQ_API_KEY is not set')
    return res.status(500).json({ error: 'Support assistant is not configured' })
  }

  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body)
          } catch {
            return {}
          }
        })()
      : req.body || {}

  const history = sanitizeHistory(body.history)
  const audioPath = body.audioPath
  let userText = typeof body.message === 'string' ? body.message.trim() : ''
  let transcript = ''

  try {
    // ── Voice note: fetch from Storage, transcribe, then treat as the text ──
    if (audioPath) {
      if (typeof audioPath !== 'string') {
        return badRequest(res, 'Invalid audio path')
      }
      // This endpoint reads with the service-role key, which bypasses Storage
      // RLS. Confine it to the prefix support uploads use so a crafted path
      // can't read order voice notes (bucket root) or anything else.
      if (!audioPath.startsWith('support/') || audioPath.includes('..')) {
        return badRequest(res, 'Invalid audio path')
      }

      const supabaseUrl = process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[support-chat] Supabase env vars missing')
        return res
          .status(500)
          .json({ error: 'Support assistant is not configured' })
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const { data: blob, error: dlErr } = await supabase.storage
        .from('voice-notes')
        .download(audioPath)

      if (dlErr || !blob) {
        console.error('[support-chat] download failed:', dlErr?.message)
        return res.status(404).json({ error: 'Voice note not found' })
      }

      const buffer = Buffer.from(await blob.arrayBuffer())
      if (buffer.byteLength > MAX_AUDIO_BYTES) {
        return badRequest(res, 'Voice note is too large')
      }

      transcript = await transcribe(
        buffer,
        blob.type || 'audio/webm',
        groqApiKey,
      )
      if (!transcript) {
        return res
          .status(422)
          .json({ error: 'Could not hear anything in that voice note' })
      }
      userText = transcript

      // Support voice notes are single-use: the transcript is what the model
      // and the UI need, so don't retain customer audio. Best-effort.
      supabase.storage
        .from('voice-notes')
        .remove([audioPath])
        .then(({ error }) => {
          if (error) {
            console.error('[support-chat] cleanup failed:', error.message)
          }
        })
        .catch(() => {})
    }

    if (!userText) {
      return badRequest(res, 'Message is required')
    }
    if (userText.length > MAX_MESSAGE_CHARS) {
      userText = userText.slice(0, MAX_MESSAGE_CHARS)
    }

    const reply = await chat(history, userText, groqApiKey)

    // `transcript` lets the UI show what it heard under the voice bubble.
    return res.status(200).json({ reply, transcript })
  } catch (err) {
    console.error('[support-chat] error:', err?.message)
    return res
      .status(502)
      .json({ error: err?.message || 'Support assistant failed' })
  }
}
