-- Support Chat: conversations + messages
-- Each user has exactly one conversation (enforced by UNIQUE(user_id))
-- is_superadmin() already exists in update-orders-table.sql

-- ── Conversations ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- ── Messages ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('user', 'superadmin')),
  message         TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_read         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read      ON messages(is_read);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;

-- Conversations: users see only their own
DROP POLICY IF EXISTS "users select own conversation" ON conversations;
CREATE POLICY "users select own conversation" ON conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

-- Conversations: superadmin full access (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "superadmin all conversations" ON conversations;
CREATE POLICY "superadmin all conversations" ON conversations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Messages: users select only messages in their own conversation
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

-- Messages: users insert into their own conversation only
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

-- Messages: superadmin full access (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "superadmin all messages" ON messages;
CREATE POLICY "superadmin all messages" ON messages
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Messages: nobody can UPDATE or DELETE via user policies
-- (only superadmin has UPDATE/DELETE via the "superadmin all messages" policy above)
