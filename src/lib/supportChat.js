import { supabase } from './supabase'

// Support voice notes share the 'voice-notes' bucket with order voice notes and
// voice search, separated by prefix:
//   <uuid>.webm   → order voice notes  (kept — the admin plays these)
//   search/...    → voice search       (deleted by /api/voice-search)
//   support/...   → support chat       (deleted by /api/support-chat)
// api/support-chat.js enforces this prefix server-side before touching a file.
const SUPPORT_VOICE_PREFIX = 'support'

// Upload a recorded voice note for the support assistant and return its path.
// The backend downloads it with the service-role key, transcribes it, then
// deletes it — the audio is single-use, only the transcript is kept.
export async function uploadSupportVoice(audioBlob) {
  const path = `${SUPPORT_VOICE_PREFIX}/${crypto.randomUUID()}.webm`
  const { error } = await supabase.storage
    .from('voice-notes')
    .upload(path, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      cacheControl: '0',
    })
  if (error) throw error
  return path
}

// Ask the assistant to reply. Pass `message` for text, or `audioPath` for a
// voice note (from uploadSupportVoice). `history` is prior turns as
// [{ role: 'user' | 'assistant', content }] — the server trims and sanitizes.
// Returns { reply, transcript }; transcript is '' for text messages.
export async function sendSupportMessage({
  message,
  audioPath,
  history = [],
}) {
  let resp
  try {
    resp = await fetch('/api/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, audioPath, history }),
    })
  } catch {
    // Network-level failure (offline, DNS, connection reset).
    throw new Error(
      'Could not reach the support service. Check your connection and try again.',
    )
  }

  // A 502/504 here usually means the /api function never ran at all. In local
  // dev that is the API server not being up — `npm run dev` starts it, but
  // `vite` on its own does not, and the proxy then returns 502 ECONNREFUSED.
  if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
    const hint = import.meta.env.DEV
      ? ' The local API server may not be running — start the app with "npm run dev" (not "vite"), which launches it alongside Vite.'
      : ''
    throw new Error(`Support service is unavailable.${hint}`)
  }

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(data.error || `Support assistant failed (${resp.status})`)
  }
  return { reply: data.reply || '', transcript: data.transcript || '' }
}
