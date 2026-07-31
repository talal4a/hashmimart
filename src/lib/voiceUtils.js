import { supabase } from './supabase'

export async function voiceFileExists(voiceUrl) {
  try {
    const { data, error } = await supabase.storage
      .from('chat-voice')
      .createSignedUrl(voiceUrl, 30)

    if (error || !data?.signedUrl) return false

    const res = await fetch(data.signedUrl, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

export async function removeOrphanedVoiceMessages(messages) {
  const voiceMsgs = messages.filter((m) => m.message_type === 'voice' && m.voice_url)
  if (voiceMsgs.length === 0) return messages

  const results = await Promise.allSettled(
    voiceMsgs.map(async (m) => {
      const exists = await voiceFileExists(m.voice_url)
      return { id: m.id, exists }
    }),
  )

  const missingIds = new Set()
  for (const r of results) {
    if (r.status === 'fulfilled' && !r.value.exists) {
      missingIds.add(r.value.id)
    }
  }

  if (missingIds.size === 0) return messages

  // Delete orphaned rows from DB (fire and forget; RLS may reject)
  supabase.from('messages').delete().in('id', [...missingIds]).then(({ error }) => {
    if (error) console.warn('[removeOrphanedVoiceMessages] DB delete failed:', error.message)
  })

  return messages.filter((m) => !missingIds.has(m.id))
}
