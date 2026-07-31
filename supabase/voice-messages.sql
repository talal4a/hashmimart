-- ═══════════════════════════════════════════════════════════
-- Voice Messages (schema only)
-- Cleanup handled by Vercel Cron → /api/cleanup-chat
-- ═══════════════════════════════════════════════════════════

-- 1. Add voice columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'voice'));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS voice_url TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS voice_duration REAL;

-- 2. Add indexes for voice-related queries
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_voice_url   ON messages(voice_url) WHERE voice_url IS NOT NULL;

-- 3. Create storage bucket for chat voice messages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-voice',
  'chat-voice',
  false,
  5242880,
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS: users can only access their own messages' voice files
DROP POLICY IF EXISTS "Users can read own voice messages" ON storage.objects;
CREATE POLICY "Users can read own voice messages" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND EXISTS (
      SELECT 1 FROM messages
      WHERE messages.voice_url = storage.objects.name
        AND (
          messages.sender_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
              AND (conversations.user_id = auth.uid() OR public.is_superadmin())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own voice messages" ON storage.objects;
CREATE POLICY "Users can insert own voice messages" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-voice'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Superadmin can read all voice" ON storage.objects;
CREATE POLICY "Superadmin can read all voice" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND public.is_superadmin()
  );

DROP POLICY IF EXISTS "Superadmin can insert voice" ON storage.objects;
CREATE POLICY "Superadmin can insert voice" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-voice'
    AND public.is_superadmin()
  );

-- 5. Allow superadmin to delete via Storage API (used by Vercel Cron)
DROP POLICY IF EXISTS "Superadmin can delete voice" ON storage.objects;
CREATE POLICY "Superadmin can delete voice" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND public.is_superadmin()
  );
