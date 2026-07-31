-- ============================================================
-- Hashmi Mart — Seed Data
-- Run this AFTER supabase_schema.sql to populate initial data.
-- ============================================================

BEGIN;

-- ── Product Categories ─────────────────────────────────────

INSERT INTO product_categories (name) VALUES
  ('Dairy'),
  ('Bakery'),
  ('Rice'),
  ('Beverages'),
  ('Snacks'),
  ('Vegetables'),
  ('Fruits'),
  ('Meat'),
  ('Cooking Oil'),
  ('Staples')
ON CONFLICT (name) DO NOTHING;

-- ── Products ───────────────────────────────────────────────

-- Helper view for readable lookups
WITH
  mode_ids AS (SELECT id, slug FROM shopping_modes),
  cat_ids  AS (SELECT id, name FROM product_categories)

INSERT INTO products (
  name, shopping_mode_id, product_category_id,
  price, unit, image, image_url, description, in_stock, wholesale_options
)
SELECT v.name, mode_ids.id, cat_ids.id, v.price, v.unit, v.image, v.image_url,
       v.description, v.in_stock, v.wholesale_options
FROM (VALUES

  -- ── Retail Products ──
  ('Fresh Milk (1L)',    'retail', 'Dairy',        220,  'pack',  '🥛',
   'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
   'Farm-fresh full cream milk',       true, NULL::int[]),

  ('Brown Bread',        'retail', 'Bakery',       180,  'loaf',  '🍞',
   'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop',
   'Soft whole wheat bread',          true, NULL),

  ('Farm Eggs (12)',     'retail', 'Dairy',        320,  'dozen', '🥚',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
   'Free-range eggs',                 true, NULL),

  ('Basmati Rice (5kg)', 'retail', 'Rice',         1450, 'bag',   '🍚',
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
   'Premium long grain basmati',      true, NULL),

  ('Sunflower Oil (1L)', 'retail', 'Cooking Oil',  580,  'bottle','🫒',
   'https://images.unsplash.com/photo-1610230566200-34713c0efc19?w=400&h=400&fit=crop',
   'Refined cooking oil',             true, NULL),

  ('Chicken Breast (1kg)','retail','Meat',         720,  'kg',    '🍗',
   'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop',
   'Skinless boneless breast',        true, NULL),

  ('Fresh Tomatoes (1kg)','retail','Vegetables',   120,  'kg',    '🍅',
   'https://images.unsplash.com/photo-1518977676601-b53f82ba65f1?w=400&h=400&fit=crop',
   'Locally sourced tomatoes',        true, NULL),

  ('Potatoes (1kg)',     'retail', 'Vegetables',   90,   'kg',    '🥔',
   'https://images.unsplash.com/photo-1518977956815-20a4017e262f?w=400&h=400&fit=crop',
   'Washed and sorted',               true, NULL),

  ('Bananas (1 dozen)',  'retail', 'Fruits',       200,  'dozen', '🍌',
   'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=400&fit=crop',
   'Ripe yellow bananas',             true, NULL),

  ('Mineral Water (1.5L)','retail','Beverages',    80,   'bottle','💧',
   'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop',
   'Packaged drinking water',         true, NULL),

  ('Tea Pack (900g)',    'retail', 'Beverages',    1100, 'pack',  '🍵',
   'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop',
   'Strong blend black tea',          true, NULL),

  ('Sugar (1kg)',        'retail', 'Staples',      165,  'kg',    '🧂',
   'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop',
   'Refined white sugar',             true, NULL),

  -- ── Wholesale Products ──
  ('Basmati Rice',       'wholesale', 'Rice',        260,  'kg',    '🍚',
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop',
   'Bulk basmati rice',              true, '{5,10,25,50}'),

  ('Sunflower Oil',      'wholesale', 'Cooking Oil', 520,  'liter', '🫒',
   'https://images.unsplash.com/photo-1610230566200-34713c0efc19?w=400&h=400&fit=crop',
   'Refined oil — bulk pricing',     true, '{5,10,20}'),

  ('Wheat Flour',        'wholesale', 'Bakery',      110,  'kg',    '🌾',
   'https://images.unsplash.com/photo-1618930150053-16e535569947?w=400&h=400&fit=crop',
   'Fine atta for bakeries',         true, '{10,25,50,100}'),

  ('Sugar',              'wholesale', 'Staples',     155,  'kg',    '🧂',
   'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop',
   'Refined sugar — wholesale',      true, '{10,25,50}'),

  ('Chicken (Whole)',    'wholesale', 'Meat',        380,  'kg',    '🍗',
   'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop',
   'Fresh whole chicken',            true, '{5,10,20}'),

  ('Potatoes',           'wholesale', 'Vegetables',  75,   'kg',    '🥔',
   'https://images.unsplash.com/photo-1518977956815-20a4017e262f?w=400&h=400&fit=crop',
   'Bulk potatoes for restaurants',  true, '{10,25,50,100}'),

  ('Onions',             'wholesale', 'Vegetables',  85,   'kg',    '🧅',
   'https://images.unsplash.com/photo-1618512496248-a07fe83aa5b8?w=400&h=400&fit=crop',
   'Red onions — bulk',              true, '{10,25,50}'),

  ('Mineral Water',      'wholesale', 'Beverages',   55,   'bottle','💧',
   'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop',
   '1.5L bottles — case pricing',    true, '{12,24,48}'),

  ('Tea (Loose)',        'wholesale', 'Beverages',   950,  'kg',    '🍵',
   'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop',
   'Loose leaf tea blend',           true, '{2,5,10}'),

  ('Milk (Packaged)',    'wholesale', 'Dairy',       200,  'liter', '🥛',
   'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop',
   'UHT milk — bulk cartons',        true, '{12,24,48}')

) AS v(name, mode_slug, cat_name, price, unit, image, image_url,
       description, in_stock, wholesale_options)
JOIN mode_ids ON mode_ids.slug = v.mode_slug
JOIN cat_ids  ON cat_ids.name  = v.cat_name;

COMMIT;
