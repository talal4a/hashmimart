-- ═══════════════════════════════════════════════════════════
-- Enable Realtime for messages and conversations tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Set REPLICA IDENTITY FULL so UPDATE events include full row data
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
