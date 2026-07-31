import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // ── 1. Find expired voice messages ─────────────────────
    const { data: expiredVoiceMessages, error: voiceQueryErr } = await supabase
      .from('messages')
      .select('id, voice_url')
      .lt('created_at', cutoff)
      .eq('message_type', 'voice')
      .not('voice_url', 'is', null)

    if (voiceQueryErr) throw voiceQueryErr

    const voiceUrls = (expiredVoiceMessages ?? [])
      .map((m) => m.voice_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)

    // ── 2. Delete voice files from Storage API ─────────────
    let deletedVoiceFiles = 0
    for (const url of voiceUrls) {
      const { error: delErr } = await supabase.storage
        .from('chat-voice')
        .remove([url])
      if (delErr) {
        console.error(`[cleanup-chat] failed to delete voice file "${url}":`, delErr.message)
      } else {
        deletedVoiceFiles++
      }
    }

    // ── 3. Delete expired messages (text + voice) ──────────
    const { data: deletedMessagesData, error: delMsgErr } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', cutoff)

    if (delMsgErr) throw delMsgErr

    const deletedMessages = (deletedMessagesData ?? []).length

    // ── 4. Delete empty conversations ──────────────────────
    const { data: allConvs } = await supabase
      .from('conversations')
      .select('id')

    const { data: convsWithMessages } = await supabase
      .from('messages')
      .select('conversation_id')

    const activeIds = new Set((convsWithMessages ?? []).map((m) => m.conversation_id))
    const emptyIds = (allConvs ?? [])
      .filter((c) => !activeIds.has(c.id))
      .map((c) => c.id)

    let deletedConversations = 0
    if (emptyIds.length > 0) {
      const { error: delConvErr } = await supabase
        .from('conversations')
        .delete()
        .in('id', emptyIds)

      if (!delConvErr) deletedConversations = emptyIds.length
    }

    // ── 5. Return summary ──────────────────────────────────
    return new Response(
      JSON.stringify({
        deletedMessages,
        deletedVoiceFiles,
        deletedConversations,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cleanup-chat] fatal error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
