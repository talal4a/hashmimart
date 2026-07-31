-- ═══════════════════════════════════════════════════════════
-- Support Chat: Complete Backend
-- Run this entire script in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- ── 1. Helper: is_superadmin (SECURITY DEFINER) ──────────
-- Must exist before any RLS policy references it.

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- ── 2. Tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_type TEXT NOT NULL DEFAULT 'support',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, conversation_type)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('user', 'superadmin')),
  message         TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Indexes ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read      ON messages(is_read);

-- ── 4. Row Level Security ────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;

-- ── 4a. conversations policies ───────────────────────────

DROP POLICY IF EXISTS "users select own conversation" ON conversations;
CREATE POLICY "users select own conversation" ON conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS "superadmin all conversations" ON conversations;
CREATE POLICY "superadmin all conversations" ON conversations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Users need INSERT to create their own conversation
DROP POLICY IF EXISTS "users insert own conversation" ON conversations;
CREATE POLICY "users insert own conversation" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users need UPDATE to bump updated_at when they send a message
DROP POLICY IF EXISTS "users update own conversation" ON conversations;
CREATE POLICY "users update own conversation" ON conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 4b. messages policies ────────────────────────────────

DROP POLICY IF EXISTS "users select own messages" ON messages;
CREATE POLICY "users select own messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_id = auth.uid() OR public.is_superadmin())
    )
  );

DROP POLICY IF EXISTS "users insert own messages" ON messages;
CREATE POLICY "users insert own messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- Users can mark messages as read (update is_read) in their own conversation
DROP POLICY IF EXISTS "users update read status" ON messages;
CREATE POLICY "users update read status" ON messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_read = true
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "superadmin all messages" ON messages;
CREATE POLICY "superadmin all messages" ON messages
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 5. Enable Realtime ──────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END;
$$;

-- ── 6. Auto-cleanup (24-hour retention) ──────────────────

-- Deletes conversations whose last activity was more than 24 hours ago.
-- CASCADE automatically removes child messages.
-- Run every hour via pg_cron or a scheduled Edge Function.

CREATE OR REPLACE FUNCTION public.cleanup_old_chats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM conversations
  WHERE updated_at < NOW() - INTERVAL '24 HOURS';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- If pg_cron is available, schedule hourly cleanup:
-- SELECT cron.schedule('chat-cleanup', '0 * * * *', 'SELECT public.cleanup_old_chats();');
