-- Add columns for auth + richer order data
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop old CHECK and re-create with full status list
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','approved','preparing','out_for_delivery','delivered','cancelled'));

-- ── RLS: anon (no auth) ────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_anon" ON orders;
CREATE POLICY "anon all" ON orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON order_items;
CREATE POLICY "anon all" ON order_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── RLS: authenticated users ───────────────────────────────

-- Anyone authenticated can insert orders
DROP POLICY IF EXISTS "auth insert orders" ON orders;
CREATE POLICY "auth insert orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can see their own orders; superadmins can see all
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

DROP POLICY IF EXISTS "auth select orders" ON orders;
CREATE POLICY "auth select orders" ON orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_superadmin()
  );

-- Superadmins can update any order
DROP POLICY IF EXISTS "auth update orders" ON orders;
CREATE POLICY "auth update orders" ON orders
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Anyone authenticated can insert order_items
DROP POLICY IF EXISTS "auth insert order_items" ON order_items;
CREATE POLICY "auth insert order_items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Order items visible to order owner or superadmin
DROP POLICY IF EXISTS "auth select order_items" ON order_items;
CREATE POLICY "auth select order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR public.is_superadmin())
    )
  );

-- Notifications: anon
DROP POLICY IF EXISTS "allow_all_anon" ON notifications;
CREATE POLICY "anon all" ON notifications
  FOR ALL TO anon USING (true) WITH CHECK (true);
