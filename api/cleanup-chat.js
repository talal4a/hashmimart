import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // ── Verify CRON_SECRET (only Vercel Cron may call) ────
  // Fail closed if the secret is unset: otherwise the comparison below is
  // against the literal string "Bearer undefined", which any caller can send
  // to trigger destructive deletes via the service-role key.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured' })
  }

  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const result = {
    deletedVoiceFiles: 0,
    deletedMessages: 0,
    deletedConversations: 0,
    errors: [],
  }

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // ── 1. Find expired voice messages ──────────────────
    const { data: expiredVoiceMessages, error: voiceQueryErr } = await supabase
      .from('messages')
      .select('id, voice_url')
      .lt('created_at', cutoff)
      .eq('message_type', 'voice')
      .not('voice_url', 'is', null)

    if (voiceQueryErr) {
      result.errors.push({ query: voiceQueryErr.message })
      return res.status(500).json(result)
    }

    const voiceUrls = (expiredVoiceMessages ?? [])
      .map((m) => m.voice_url)
      .filter((url) => typeof url === 'string' && url.length > 0)

    // ── 2. Delete voice files via Storage API ───────────
    for (const url of voiceUrls) {
      const { error: delErr } = await supabase.storage
        .from('chat-voice')
        .remove([url])

      if (delErr) {
        result.errors.push({ url, error: delErr.message })
        console.error('[cleanup-chat] failed to delete voice file:', url, delErr.message)
      } else {
        result.deletedVoiceFiles++
      }
    }

    // ── 3. Delete expired messages ──────────────────────
    const { data: deletedMsgs, error: delMsgErr } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', cutoff)

    if (delMsgErr) {
      result.errors.push({ messages: delMsgErr.message })
    } else {
      result.deletedMessages = deletedMsgs?.length ?? 0
    }

    // ── 4. Delete empty conversations ───────────────────
    const { data: allConvs } = await supabase
      .from('conversations')
      .select('id')

    const { data: convsWithMsgs } = await supabase
      .from('messages')
      .select('conversation_id')

    const activeIds = new Set((convsWithMsgs ?? []).map((m) => m.conversation_id))
    const emptyIds = (allConvs ?? [])
      .filter((c) => !activeIds.has(c.id))
      .map((c) => c.id)

    if (emptyIds.length > 0) {
      const { error: delConvErr } = await supabase
        .from('conversations')
        .delete()
        .in('id', emptyIds)

      if (delConvErr) {
        result.errors.push({ conversations: delConvErr.message })
      } else {
        result.deletedConversations = emptyIds.length
      }
    }

    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.errors.push({ fatal: message })
    return res.status(500).json(result)
  }
}
