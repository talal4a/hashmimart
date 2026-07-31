-- ============================================================
-- Production-safe RLS policies for the orders & order_items
-- tables.  Uses the existing SECURITY DEFINER helper
-- public.is_superadmin() so the profiles table is never
-- queried from within a policy.
-- ============================================================

-- ── 1. Ensure the helper function exists ──────────────────────

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

-- ── 2. Drop every existing policy on orders & order_items ─────

DROP POLICY IF EXISTS "anon all"              ON orders;
DROP POLICY IF EXISTS "auth insert orders"    ON orders;
DROP POLICY IF EXISTS "auth select orders"    ON orders;
DROP POLICY IF EXISTS "auth update orders"    ON orders;

DROP POLICY IF EXISTS "anon all"              ON order_items;
DROP POLICY IF EXISTS "auth insert order_items" ON order_items;
DROP POLICY IF EXISTS "auth select order_items" ON order_items;

-- ── 3. orders ────────────────────────────────────────────────

-- Guests (anon) — full access (no auth required for browsing)
CREATE POLICY "anon all orders" ON orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Authenticated users — insert only their own order
CREATE POLICY "auth insert orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authenticated users — read only their own orders
-- Superadmins — read every order
CREATE POLICY "auth select orders" ON orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_superadmin()
  );

-- Authenticated users — update only their own order
-- (e.g. cancel a pending order)
-- Superadmins — update any order (status changes, etc.)
CREATE POLICY "auth update orders" ON orders
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR public.is_superadmin()
  )
  WITH CHECK (
    user_id = auth.uid() OR public.is_superadmin()
  );

-- Superadmins only — delete orders
CREATE POLICY "auth delete orders" ON orders
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- ── 4. order_items ───────────────────────────────────────────

-- Guests — full access
CREATE POLICY "anon all order_items" ON order_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Authenticated users — insert items for their own orders
CREATE POLICY "auth insert order_items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Authenticated users — read items that belong to their orders
-- Superadmins — read every item
CREATE POLICY "auth select order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR public.is_superadmin())
    )
  );

-- Superadmins — update/delete items
CREATE POLICY "auth all order_items superadmin" ON order_items
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
