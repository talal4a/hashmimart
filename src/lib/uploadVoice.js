import { supabase } from './supabase'

const VOICE_BUCKET = 'chat-voice'

export async function uploadVoice(audioBlob, conversationType = 'direct') {
  const fileName = `${conversationType}/${crypto.randomUUID()}.webm`
  const { error } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(fileName, audioBlob, {
      contentType: 'audio/webm',
      cacheControl: '3600',
    })
  if (error) throw error
  return fileName
}
