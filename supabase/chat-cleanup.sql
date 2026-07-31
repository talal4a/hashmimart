-- ── Support Chat: scheduled cleanup ───────────────────────
-- Run via pg_cron or a scheduled Edge Function every hour.
--
-- Schedule example (requires pg_cron extension):
--
--   SELECT cron.schedule('chat-cleanup', '0 * * * *', $$
--     DELETE FROM conversations
--     WHERE updated_at < NOW() - INTERVAL '24 HOURS';
--   $$);
--
-- ON DELETE CASCADE on the conversations→messages FK
-- automatically removes child messages.

-- Manual cleanup (safe to run anytime):
DELETE FROM conversations
WHERE updated_at < NOW() - INTERVAL '24 HOURS';
