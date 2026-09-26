-- ═══════════════════════════════════════════════════════════
-- Store settings, text orders, order price breakdown, subcategories
--
-- Run this once in the Supabase SQL editor. Safe to re-run.
--
--   1. store_settings        → admin-set delivery fee, free-delivery
--                              threshold and store-wide order discount
--   2. orders columns        → order_text (Direct Order, voice → text) and
--                              the price breakdown each order was charged
--   3. product_categories    → parent_id, so a category can hold
--                              subcategories (Dairy → Milk, Yogurt, …)
-- ═══════════════════════════════════════════════════════════

-- ── 1. Store settings (single row, id = 1) ─────────────────

CREATE TABLE IF NOT EXISTS store_settings (
  id                       SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  delivery_fee             NUMERIC(10,2) NOT NULL DEFAULT 50
                           CHECK (delivery_fee >= 0),
  free_delivery_enabled    BOOLEAN NOT NULL DEFAULT true,
  free_delivery_threshold  NUMERIC(10,2) NOT NULL DEFAULT 500
                           CHECK (free_delivery_threshold >= 0),
  discount_enabled         BOOLEAN NOT NULL DEFAULT false,
  discount_type            TEXT NOT NULL DEFAULT 'percentage'
                           CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value           NUMERIC(10,2) NOT NULL DEFAULT 0
                           CHECK (discount_value >= 0),
  discount_min_order       NUMERIC(10,2) NOT NULL DEFAULT 0
                           CHECK (discount_min_order >= 0),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  -- A percentage above 100 would push totals negative.
  CONSTRAINT store_settings_percentage_check
    CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

-- Defaults match the rule the app used to hardcode: Rs 50, free from Rs 500.
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Every shopper needs the current fee and discount to price the cart.
DROP POLICY IF EXISTS "store_settings_select_all" ON store_settings;
CREATE POLICY "store_settings_select_all" ON store_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Only a superadmin may change prices. is_superadmin() is defined in
-- update-orders-table.sql / complete-chat-backend.sql.
DROP POLICY IF EXISTS "store_settings_update_superadmin" ON store_settings;
CREATE POLICY "store_settings_update_superadmin" ON store_settings
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 2. Orders: text order + price breakdown ────────────────

-- Direct Order is now voice → text: the customer's list is stored as text.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_text TEXT;

-- What the customer was actually charged, so the admin view stays correct
-- even after the delivery fee or discount settings change.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);

-- ── 3. Subcategories ────────────────────────────────────────

-- A category with a parent is a subcategory. Deleting a parent turns its
-- subcategories back into main categories instead of deleting them (the
-- admin UI also refuses to delete a category that still has subcategories).
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID
  REFERENCES product_categories(id) ON DELETE SET NULL;

ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_not_own_parent;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_not_own_parent
  CHECK (parent_id IS NULL OR parent_id <> id);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent
  ON product_categories(parent_id);

-- ── Optional: wholesale clean-up ────────────────────────────
-- The app no longer shows the Wholesale option or wholesale products, so
-- nothing below is required. Wholesale products stay in the admin Products
-- tab, tagged "Wholesale (hidden)": edit one to move it to the shop, or
-- delete it. To delete them all at once instead, uncomment:
--
-- DELETE FROM products
--  WHERE shopping_mode_id = (SELECT id FROM shopping_modes WHERE slug = 'wholesale');
-- DELETE FROM shopping_modes WHERE slug = 'wholesale';
