-- ============================================================
-- Add the `ordermanager` role.
--
-- An ordermanager is staff with access to exactly three areas:
-- Orders, Direct Orders, and Support Chats. They must NOT be able
-- to touch products, product categories, discounts, or wishlists,
-- and must not be able to change anyone's role (including their own).
--
-- Frontend route guards mirror this (src/lib/permissions.js), but
-- the guards are bypassable from the browser console — these
-- policies are the actual enforcement boundary.
--
-- ⚠️  BEFORE RUNNING: snapshot the live policies, because the
--     DROP POLICY statements below will remove any same-named
--     policy that is not versioned in this repo:
--
--       SELECT tablename, policyname, cmd, roles, qual, with_check
--       FROM pg_policies WHERE schemaname = 'public'
--       ORDER BY tablename, policyname;
--
-- Applies on top of: create-profiles-table.sql, fix-profile-rls.sql,
-- orders-rls-policies.sql, allow-user-cancel-orders.sql,
-- complete-chat-backend.sql
-- ============================================================

BEGIN;

-- ── 1. profiles.role — allow the new role ─────────────────────
-- Without this, promoting a user to 'ordermanager' fails outright.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'superadmin', 'ordermanager'));

-- ── 2. messages.sender_role — allow the new role ──────────────
-- complete-chat-backend.sql:36 constrained this to ('user','superadmin').
-- Without widening it an ordermanager's chat reply is rejected by the
-- CHECK constraint before any policy is even evaluated.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_role_check
  CHECK (sender_role IN ('user', 'superadmin', 'ordermanager'));

-- ── 3. Helper functions ───────────────────────────────────────
-- SECURITY DEFINER so policies never re-enter profiles' own RLS.
-- is_superadmin() is intentionally left as-is: it still means
-- "superadmin only" and other policies depend on that meaning.

CREATE OR REPLACE FUNCTION public.is_ordermanager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ordermanager'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('superadmin', 'ordermanager')
  );
$$;

-- ── 4. profiles — staff read customer contact details ─────────
-- AdminChatPanel.jsx:122 looks up each conversation's customer name and
-- phone. Without widening this to staff, an ordermanager sees
-- "Unknown User" / "No phone number" on every conversation.
--
-- UPDATE is deliberately NOT widened: it stays superadmin-only, so an
-- ordermanager cannot promote itself or edit any other profile's role.

DROP POLICY IF EXISTS "Superadmin read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Read own or superadmin read all" ON public.profiles;
CREATE POLICY "Read own or staff read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_staff());

-- ── 5. orders ─────────────────────────────────────────────────
-- Replaces the superadmin-gated policies from orders-rls-policies.sql
-- with staff-gated equivalents. The customer-facing halves of each
-- USING clause (user_id = auth.uid()) are preserved exactly.
--
-- NOTE: "auth cancel own pending orders" (allow-user-cancel-orders.sql)
-- is a separate permissive UPDATE policy and is intentionally left in
-- place — Postgres ORs permissive policies, so it still lets a customer
-- cancel their own pending order.

DROP POLICY IF EXISTS "auth select orders" ON public.orders;
CREATE POLICY "auth select orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "auth update orders" ON public.orders;
CREATE POLICY "auth update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- Backs "Delete Selected" / "Delete All History" in the Orders section.
DROP POLICY IF EXISTS "auth delete orders" ON public.orders;
CREATE POLICY "auth delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- ── 6. order_items ────────────────────────────────────────────

DROP POLICY IF EXISTS "auth select order_items" ON public.order_items;
CREATE POLICY "auth select order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR public.is_staff())
    )
  );

DROP POLICY IF EXISTS "auth all order_items superadmin" ON public.order_items;
DROP POLICY IF EXISTS "auth all order_items staff" ON public.order_items;
CREATE POLICY "auth all order_items staff" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ── 7. conversations ──────────────────────────────────────────

DROP POLICY IF EXISTS "users select own conversation" ON public.conversations;
CREATE POLICY "users select own conversation" ON public.conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "superadmin all conversations" ON public.conversations;
DROP POLICY IF EXISTS "staff all conversations" ON public.conversations;
CREATE POLICY "staff all conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ── 8. messages ───────────────────────────────────────────────

DROP POLICY IF EXISTS "users select own messages" ON public.messages;
CREATE POLICY "users select own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_id = auth.uid() OR public.is_staff())
    )
  );

-- Customer INSERT keeps its hard sender_role = 'user' requirement, which
-- is what stops a customer forging a message that looks like staff.
DROP POLICY IF EXISTS "users insert own messages" ON public.messages;
CREATE POLICY "users insert own messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "superadmin all messages" ON public.messages;
DROP POLICY IF EXISTS "staff all messages" ON public.messages;
CREATE POLICY "staff all messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.is_staff())
  -- sender_role must equal the sender's real role: an ordermanager cannot
  -- post as 'superadmin', and neither can post as 'user'.
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
    AND sender_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

COMMIT;

-- ============================================================
-- Deliberately NOT changed: products, product_categories,
-- shopping_modes, wishlist_items.
--
-- supabase_schema.sql:129-166 already enables RLS on these with only
-- `FOR ALL TO anon` policies. With RLS on and no `authenticated`
-- policy, every authenticated write to them is ALREADY denied — an
-- ordermanager is blocked there before this migration runs. Adding an
-- explicit deny policy would be a no-op, and editing the existing
-- `allow_all_anon` policies risks breaking the customer storefront,
-- which reads the catalog through the anon key.
-- ============================================================

-- Promote a user (run separately, with a real email):
--   UPDATE public.profiles SET role = 'ordermanager' WHERE email = '...';
--
-- Verify:
--   SELECT public.is_staff(), public.is_ordermanager(), public.is_superadmin();
