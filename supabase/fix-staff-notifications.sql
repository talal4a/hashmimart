-- ============================================================
-- Fix staff notifications (new-order alerts never reaching admins)
--
-- Root cause: placeOrder() inserts a notification with
-- audience = 'staff' so the admin bell + Notifications page light
-- up when a customer places an order. But the old
-- "notifications_insert_staff" policy required the INSERTER to be
-- a staff member — the customer placing the order is not staff, so
-- RLS silently rejected the insert and the alert never existed.
--
-- This migration:
--   1. Lets ANY authenticated user insert audience='staff'
--      notifications (the new-order alert), while staff can still
--      insert customer notifications (order status updates).
--   2. Closes the delete hole that let ANY authenticated user
--      delete staff notifications.
--   3. Self-heals the staff SELECT/UPDATE policies in case the
--      complete schema was never applied to this database.
--   4. Adds `notifications` to the supabase_realtime publication
--      so the bell updates live (enable-realtime.sql only ever
--      added messages + conversations).
--
-- Run this in the Supabase SQL Editor. Idempotent — safe to re-run.
-- ============================================================

-- ── 1. INSERT: customers may alert staff; staff may insert any feed ──
DROP POLICY IF EXISTS "notifications_insert_staff" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;
CREATE POLICY "notifications_insert_authenticated" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Any logged-in customer raising a new-order alert for the staff feed
    audience = 'staff'
    -- Staff creating customer notifications (order status updates) or the
    -- staff copy of those updates
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── 2. SELECT: staff can read the staff feed ──
DROP POLICY IF EXISTS "notifications_select_staff" ON notifications;
CREATE POLICY "notifications_select_staff" ON notifications
  FOR SELECT TO authenticated
  USING (
    audience = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── 3. UPDATE: staff can mark staff notifications read ──
DROP POLICY IF EXISTS "notifications_update_staff" ON notifications;
CREATE POLICY "notifications_update_staff" ON notifications
  FOR UPDATE TO authenticated
  USING (
    audience = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── 4. DELETE: customers delete their own; ONLY staff delete staff rows ──
-- The old policy (user_id = auth.uid() OR audience = 'staff') let any
-- authenticated customer wipe the entire staff feed.
DROP POLICY IF EXISTS "notifications_delete_user" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_staff" ON notifications;
CREATE POLICY "notifications_delete_staff" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      audience = 'staff'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
      )
    )
  );

-- ── 4b. Self-heal: customer feed policies ─────────────────────
-- If the complete schema was never applied to this database the customer
-- feed is broken too — customers would never see status-update
-- notifications. Recreate both idempotently; no-ops when already present.
DROP POLICY IF EXISTS "notifications_select_user" ON notifications;
CREATE POLICY "notifications_select_user" ON notifications
  FOR SELECT TO authenticated
  USING (
    audience = 'customer' AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notifications_update_user" ON notifications;
CREATE POLICY "notifications_update_user" ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ── 5. Realtime: deliver new staff alerts to the open bell channel ──
-- Guarded so re-running the script (or a table already added via the
-- dashboard) can't fail on "already member of publication".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END
$$;

-- Full row data so UPDATE events carry old/new rows for the feed.
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- ── Verify ──
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
-- ORDER BY policyname;
