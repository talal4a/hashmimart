-- ============================================================
-- Hashmi Mart — Supabase Database Schema
-- Run this script in the Supabase SQL Editor to set up
-- the initial database structure for a fresh project.
-- ============================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. Shopping Modes (retail / wholesale) ─────────────────

CREATE TABLE IF NOT EXISTS shopping_modes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO shopping_modes (slug, name) VALUES
  ('retail', 'Retail'),
  ('wholesale', 'Wholesale')
ON CONFLICT DO NOTHING;

-- ── 2. Product Categories (Dairy, Bakery, etc.) ────────────

CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Products ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  shopping_mode_id    UUID NOT NULL REFERENCES shopping_modes(id),
  product_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sale_price          NUMERIC(10,2) CHECK (sale_price >= 0),
  unit                TEXT NOT NULL,
  image               TEXT,
  image_url           TEXT,
  description         TEXT,
  in_stock            BOOLEAN DEFAULT true,
  wholesale_options   INTEGER[] DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Orders ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                TEXT UNIQUE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_city             TEXT DEFAULT 'Lahore',
  customer_society          TEXT,
  customer_address          TEXT,
  total                     NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  payment_method            TEXT NOT NULL DEFAULT 'Cash on Delivery',
  estimated_delivery_minutes INTEGER,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Order Items ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  product_price     NUMERIC(10,2) NOT NULL,
  product_unit      TEXT NOT NULL,
  product_image     TEXT,
  product_image_url TEXT,
  product_category  TEXT,
  shopping_mode     TEXT,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- ── 6. Wishlist Items ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, product_id)
);

-- ── 7. Notifications ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_shopping_mode ON products(shopping_mode_id);
CREATE INDEX IF NOT EXISTS idx_products_category      ON products(product_category_id);
CREATE INDEX IF NOT EXISTS idx_products_in_stock      ON products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at    ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm     ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone           ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_session       ON wishlist_items(session_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product       ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order    ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read     ON notifications(is_read);

-- ── Row-Level Security ─────────────────────────────────────

ALTER TABLE shopping_modes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth yet — anon role has full access)
-- Tighten these once authentication is implemented.

DROP POLICY IF EXISTS "allow_all_anon" ON shopping_modes;
CREATE POLICY "allow_all_anon" ON shopping_modes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON product_categories;
CREATE POLICY "allow_all_anon" ON product_categories
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON products;
CREATE POLICY "allow_all_anon" ON products
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON orders;
CREATE POLICY "allow_all_anon" ON orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON order_items;
CREATE POLICY "allow_all_anon" ON order_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON wishlist_items;
CREATE POLICY "allow_all_anon" ON wishlist_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_anon" ON notifications;
CREATE POLICY "allow_all_anon" ON notifications
  FOR ALL TO anon USING (true) WITH CHECK (true);

COMMIT;
