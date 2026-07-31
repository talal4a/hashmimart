-- ═══════════════════════════════════════════════════════════
-- Add conversation_type to existing conversations table
-- Run AFTER complete-chat-backend.sql
-- ═══════════════════════════════════════════════════════════

-- Add column (ALLOW NULL temporarily for existing rows)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type TEXT;

-- Backfill existing rows
UPDATE conversations
  SET conversation_type = 'support'
  WHERE conversation_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE conversations
  ALTER COLUMN conversation_type SET NOT NULL;

-- Drop old unique constraint, add new composite one
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_user_id_key;

-- Add unique constraint on (user_id, conversation_type)
-- Name it explicitly so we can reference/drop it later
ALTER TABLE conversations
  ADD CONSTRAINT conversations_user_id_type_key
  UNIQUE (user_id, conversation_type);

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_conversations_type
  ON conversations(conversation_type);
