-- ═══════════════════════════════════════════════════════════
-- Drop NOT NULL constraint on messages.message
-- Voice messages store content in voice_url + voice_duration
-- and set message to NULL.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.messages
  ALTER COLUMN message DROP NOT NULL;
