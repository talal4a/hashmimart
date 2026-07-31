-- ═══════════════════════════════════════════════════════════
-- Voice Orders (Direct Order → Checkout → Admin Dashboard)
--
-- Adds the columns placeOrder() already writes (is_voice_order,
-- audio_url) and the 'voice-notes' bucket it already uploads to.
-- Without these the voice order insert fails outright, so the
-- admin dashboard never receives the order at all.
-- ═══════════════════════════════════════════════════════════

-- 1. Voice order columns on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_voice_order BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Voice orders carry no line items: total starts at 0 (already allowed by
-- the base CHECK (total >= 0)) and the admin sets it after listening.

-- A voice order must actually carry its recording.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_voice_audio_check;
ALTER TABLE orders ADD CONSTRAINT orders_voice_audio_check
  CHECK (NOT is_voice_order OR audio_url IS NOT NULL);

-- Admin dashboard filters voice orders to the top of the queue.
CREATE INDEX IF NOT EXISTS idx_orders_is_voice_order
  ON orders(is_voice_order) WHERE is_voice_order = true;

-- 2. Storage bucket for order voice notes.
--    Public, because the admin <audio src> and the customer's own order
--    page both load it via getPublicUrl() — no signed-URL flow exists.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  10485760,
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 10485760,
      allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'];

-- 3. Storage RLS for voice-notes
DROP POLICY IF EXISTS "Public read voice-notes" ON storage.objects;
CREATE POLICY "Public read voice-notes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'voice-notes');

-- Logged-in customers upload their own order recording at checkout.
-- Prefixes inside this bucket:
--   <uuid>.webm  → order voice notes  (KEPT — the admin plays these)
--   search/...   → voice search       (disposable, deleted by /api/voice-search)
--   support/...  → AI support chat    (disposable, deleted by /api/support-chat)
DROP POLICY IF EXISTS "Auth insert voice-notes" ON storage.objects;
CREATE POLICY "Auth insert voice-notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

-- Deletes are restricted to superadmins AND to the disposable prefixes, so a
-- stray client can never remove an order's recording. The /api endpoints use
-- the service-role key and bypass this, which is why each one also validates
-- its own prefix before downloading or deleting.
DROP POLICY IF EXISTS "Superadmin delete voice-notes" ON storage.objects;
CREATE POLICY "Superadmin delete voice-notes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND public.is_superadmin()
    AND (name LIKE 'search/%' OR name LIKE 'support/%')
  );
