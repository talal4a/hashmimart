import { supabase } from './supabase'

// Direct Order recordings share the 'voice-notes' bucket, separated by prefix:
//   order-text/... → Direct Order voice → text (deleted by /api/transcribe-order)
//   search/...     → voice search             (deleted by /api/voice-search)
//   support/...    → support chat             (deleted by /api/support-chat)
// api/transcribe-order.js enforces this prefix server-side.
const ORDER_TEXT_PREFIX = 'order-text'

// Upload the recording, have the backend convert it to text, and return that
// text ('' when nothing intelligible was heard). The audio is deleted
// server-side once transcribed — only the text is ever kept.
export async function transcribeOrderVoice(audioBlob) {
  const path = `${ORDER_TEXT_PREFIX}/${crypto.randomUUID()}.webm`
  const { error: uploadError } = await supabase.storage
    .from('voice-notes')
    .upload(path, audioBlob, {
      // Drop ";codecs=opus" — the bucket's allowed_mime_types lists bare types.
      contentType: (audioBlob.type || 'audio/webm').split(';')[0],
      cacheControl: '0',
    })
  if (uploadError) {
    console.error('transcribeOrderVoice: upload failed', uploadError)
    throw new Error('Could not upload your recording. Please try again.')
  }

  let resp
  try {
    resp = await fetch('/api/transcribe-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your connection and try again.',
    )
  }

  // 502-504 with no JSON body means the /api function never ran — locally,
  // that's `vite` running without the API server that `npm run dev` starts.
  const data = await resp.json().catch(() => null)
  if (!resp.ok) {
    const hint =
      !data && import.meta.env.DEV
        ? ' The local API server may not be running — start the app with "npm run dev".'
        : ''
    throw new Error(
      (data?.error || 'Voice to text failed. Please try again.') + hint,
    )
  }
  return String(data?.text || '').trim()
}
