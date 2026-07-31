-- ═══════════════════════════════════════════════════════════
-- Remove old SQL-based cleanup
-- Cleanup now handled by Vercel Cron → Serverless Function
-- ═══════════════════════════════════════════════════════════

-- 1. Remove pg_cron scheduled job (if it exists)
SELECT cron.unschedule('cleanup-expired-messages');

-- 2. Drop the old cleanup function (if it exists)
DROP FUNCTION IF EXISTS public.cleanup_expired_messages;

-- 3. Drop the even older cleanup_old_chats function (if it exists)
DROP FUNCTION IF EXISTS public.cleanup_old_chats;
