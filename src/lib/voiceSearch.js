import { supabase } from './supabase'

const VOICE_SEARCH_BUCKET = 'voice-notes'

// Upload a recorded audio blob to the voice-notes bucket and return its path.
// The backend downloads it with the service-role key, transcribes it, then
// deletes it — the file is single-use.
export async function uploadVoiceSearch(audioBlob) {
  const path = `search/${crypto.randomUUID()}.webm`
  const { error } = await supabase.storage
    .from(VOICE_SEARCH_BUCKET)
    .upload(path, audioBlob, {
      contentType: 'audio/webm',
      cacheControl: '0',
    })
  if (error) throw error
  return path
}

// Ask the backend to transcribe the audio at `path` and find a matching
// product. Returns { transcript, product } where product is null on no match.
export async function searchByVoice(path) {
  const resp = await fetch('/api/voice-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(data.error || 'Voice search failed')
  }
  return { transcript: data.transcript || '', product: data.product || null }
}
