-- ============================================================
-- Hashmi Mart — Complete Supabase Database Schema
-- Run this script in the Supabase SQL Editor to set up
-- the complete database structure with RLS policies.
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

-- ── 3. Societies ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS societies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Products ──────────────────────────────────────────────

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

-- ── 5. Orders ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                TEXT UNIQUE NOT NULL,
  user_id                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'delivered', 'cancelled')),
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_city             TEXT DEFAULT 'Lahore',
  customer_society          TEXT,
  customer_address          TEXT,
  total                     NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  payment_method            TEXT NOT NULL DEFAULT 'Cash on Delivery',
  estimated_delivery_minutes INTEGER,
  is_voice_order            BOOLEAN DEFAULT false,
  hidden_by_admin           BOOLEAN DEFAULT false,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Order Items ───────────────────────────────────────────

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

-- ── 7. Wishlist Items ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, product_id),
  UNIQUE (session_id, product_id)
);

-- ── 8. Notifications ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  audience    TEXT NOT NULL DEFAULT 'customer'
              CHECK (audience IN ('customer', 'staff')),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 9. User Profiles ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'superadmin', 'ordermanager', 'staff')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 10. Conversations ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_type TEXT NOT NULL DEFAULT 'support'
                    CHECK (conversation_type IN ('support', 'direct_order')),
  unread_count      INTEGER DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 11. Messages ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role       TEXT NOT NULL DEFAULT 'user'
                    CHECK (sender_role IN ('user', 'superadmin', 'ordermanager', 'staff')),
  message           TEXT,
  message_type      TEXT NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'voice')),
  voice_url         TEXT,
  is_read           BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_shopping_mode ON products(shopping_mode_id);
CREATE INDEX IF NOT EXISTS idx_products_category      ON products(product_category_id);
CREATE INDEX IF NOT EXISTS idx_products_in_stock      ON products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at    ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm     ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone           ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_id         ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_user          ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_session       ON wishlist_items(session_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product       ON wishlist_items(product_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order    ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read     ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_profiles_role          ON profiles(role);

CREATE INDEX IF NOT EXISTS idx_conversations_user     ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type     ON conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_conversations_updated   ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender        ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at    ON messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read       ON messages(is_read);

-- ── Row-Level Security ───────────────────────────────────────

ALTER TABLE shopping_modes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE societies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;

-- ── Shopping Modes Policies ─────────────────────────────────

DROP POLICY IF EXISTS "shopping_modes_select_anon" ON shopping_modes;
CREATE POLICY "shopping_modes_select_anon" ON shopping_modes
  FOR SELECT TO anon, authenticated USING (true);

-- ── Product Categories Policies ───────────────────────────────

DROP POLICY IF EXISTS "product_categories_select_anon" ON product_categories;
CREATE POLICY "product_categories_select_anon" ON product_categories
  FOR SELECT TO anon, authenticated USING (true);

-- ── Societies Policies ────────────────────────────────────────

DROP POLICY IF EXISTS "societies_select_anon" ON societies;
CREATE POLICY "societies_select_anon" ON societies
  FOR SELECT TO anon, authenticated USING (true);

-- ── Products Policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "products_select_anon" ON products;
CREATE POLICY "products_select_anon" ON products
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_staff" ON products;
CREATE POLICY "products_insert_staff" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'staff', 'ordermanager')
    )
  );

DROP POLICY IF EXISTS "products_update_staff" ON products;
CREATE POLICY "products_update_staff" ON products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'staff', 'ordermanager')
    )
  );

DROP POLICY IF EXISTS "products_delete_staff" ON products;
CREATE POLICY "products_delete_staff" ON products
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'staff', 'ordermanager')
    )
  );

-- ── Orders Policies ───────────────────────────────────────────

DROP POLICY IF EXISTS "orders_select_anon" ON orders;
CREATE POLICY "orders_select_anon" ON orders
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
CREATE POLICY "orders_insert_anon" ON orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "orders_update_staff" ON orders;
CREATE POLICY "orders_update_staff" ON orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "orders_update_hidden" ON orders;
CREATE POLICY "orders_update_hidden" ON orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── Order Items Policies ─────────────────────────────────────

DROP POLICY IF EXISTS "order_items_select_anon" ON order_items;
CREATE POLICY "order_items_select_anon" ON order_items
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "order_items_insert_anon" ON order_items;
CREATE POLICY "order_items_insert_anon" ON order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ── Wishlist Items Policies ────────────────────────────────────

DROP POLICY IF EXISTS "wishlist_items_select_anon" ON wishlist_items;
CREATE POLICY "wishlist_items_select_anon" ON wishlist_items
  FOR SELECT TO anon, authenticated USING (session_id IS NOT NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "wishlist_items_insert_anon" ON wishlist_items;
CREATE POLICY "wishlist_items_insert_anon" ON wishlist_items
  FOR INSERT TO anon, authenticated WITH CHECK (session_id IS NOT NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "wishlist_items_delete_user" ON wishlist_items;
CREATE POLICY "wishlist_items_delete_user" ON wishlist_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wishlist_items_delete_session" ON wishlist_items;
CREATE POLICY "wishlist_items_delete_session" ON wishlist_items
  FOR DELETE TO anon USING (session_id IS NOT NULL);

-- ── Notifications Policies ────────────────────────────────────

DROP POLICY IF EXISTS "notifications_select_user" ON notifications;
CREATE POLICY "notifications_select_user" ON notifications
  FOR SELECT TO authenticated USING (audience = 'customer' AND (user_id IS NULL OR user_id = auth.uid()));

DROP POLICY IF EXISTS "notifications_select_staff" ON notifications;
CREATE POLICY "notifications_select_staff" ON notifications
  FOR SELECT TO authenticated
  USING (
    audience = 'staff'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "notifications_update_user" ON notifications;
CREATE POLICY "notifications_update_user" ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_staff" ON notifications;
CREATE POLICY "notifications_update_staff" ON notifications
  FOR UPDATE TO authenticated
  USING (
    audience = 'staff'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "notifications_insert_staff" ON notifications;
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "notifications_delete_user" ON notifications;
CREATE POLICY "notifications_delete_user" ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR audience = 'staff');

-- ── Profiles Policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select_user" ON profiles;
CREATE POLICY "profiles_select_user" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_staff" ON profiles;
CREATE POLICY "profiles_select_staff" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "profiles_insert_user" ON profiles;
CREATE POLICY "profiles_insert_user" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_user" ON profiles;
CREATE POLICY "profiles_update_user" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_staff" ON profiles;
CREATE POLICY "profiles_update_staff" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── Conversations Policies ─────────────────────────────────────

DROP POLICY IF EXISTS "conversations_select_user" ON conversations;
CREATE POLICY "conversations_select_user" ON conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_select_staff" ON conversations;
CREATE POLICY "conversations_select_staff" ON conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "conversations_insert_user" ON conversations;
CREATE POLICY "conversations_insert_user" ON conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update_user" ON conversations;
CREATE POLICY "conversations_update_user" ON conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update_staff" ON conversations;
CREATE POLICY "conversations_update_staff" ON conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

-- ── Messages Policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "messages_select_user" ON messages;
CREATE POLICY "messages_select_user" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_select_staff" ON messages;
CREATE POLICY "messages_select_staff" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "messages_insert_user" ON messages;
CREATE POLICY "messages_insert_user" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
CREATE POLICY "messages_insert_staff" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "messages_update_user" ON messages;
CREATE POLICY "messages_update_user" ON messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_update_staff" ON messages;
CREATE POLICY "messages_update_staff" ON messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'ordermanager', 'staff')
    )
  );

DROP POLICY IF EXISTS "messages_delete_user" ON messages;
CREATE POLICY "messages_delete_user" ON messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- ── Storage Buckets ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES
  ('products', 'Product Images', true),
  ('voice-notes', 'Voice Notes and Recordings', true),
  ('chat-voice', 'Chat Voice Messages', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage Policies ─────────────────────────────────────────

-- Products bucket policies
DROP POLICY IF EXISTS "products_select_anon" ON storage.objects;
CREATE POLICY "products_select_anon" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "products_insert_staff" ON storage.objects;
CREATE POLICY "products_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'staff', 'ordermanager')
    )
  );

DROP POLICY IF EXISTS "products_delete_staff" ON storage.objects;
CREATE POLICY "products_delete_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('superadmin', 'staff', 'ordermanager')
    )
  );

-- Chat voice bucket policies
DROP POLICY IF EXISTS "chat_voice_select_authenticated" ON storage.objects;
CREATE POLICY "chat_voice_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-voice');

DROP POLICY IF EXISTS "chat_voice_insert_authenticated" ON storage.objects;
CREATE POLICY "chat_voice_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-voice');

DROP POLICY IF EXISTS "chat_voice_delete_authenticated" ON storage.objects;
CREATE POLICY "chat_voice_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND (auth.uid()::text = (storage.foldername(name))[1])
  );

-- Voice notes bucket policies
DROP POLICY IF EXISTS "voice_notes_select_anon" ON storage.objects;
CREATE POLICY "voice_notes_select_anon" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'voice-notes');

DROP POLICY IF EXISTS "voice_notes_insert_authenticated" ON storage.objects;
CREATE POLICY "voice_notes_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

DROP POLICY IF EXISTS "voice_notes_delete_authenticated" ON storage.objects;
CREATE POLICY "voice_notes_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes');

-- ── Functions ─────────────────────────────────────────────────

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
