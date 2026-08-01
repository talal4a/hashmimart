-- ── Societies ──────────────────────────────────────────────
-- Admin-managed list of Lahore societies offered for delivery.
-- Mirrors product_categories: flat name list, unique, admin CRUD.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS societies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE societies ENABLE ROW LEVEL SECURITY;

-- Matches the existing permissive policy on product_categories so the admin
-- dashboard can write with the anon key. Tighten alongside the other tables
-- when auth-scoped policies land.
DROP POLICY IF EXISTS "allow_all_anon" ON societies;
CREATE POLICY "allow_all_anon" ON societies
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed with the Lahore societies the app previously hardcoded.
INSERT INTO societies (name) VALUES
  ('DHA Phase 1'),
  ('DHA Phase 2'),
  ('DHA Phase 3'),
  ('DHA Phase 4'),
  ('DHA Phase 5'),
  ('DHA Phase 6'),
  ('DHA Phase 7'),
  ('DHA Phase 8'),
  ('Bahria Town Lahore'),
  ('Bahria Orchard'),
  ('Bahria Nasheman'),
  ('Lake City'),
  ('Valencia Town'),
  ('Wapda Town'),
  ('Model Town'),
  ('Gulberg I'),
  ('Gulberg II'),
  ('Gulberg III'),
  ('Garden Town'),
  ('Johar Town'),
  ('Faisal Town'),
  ('Iqbal Town'),
  ('Allama Iqbal Town'),
  ('Township'),
  ('Green Town'),
  ('Canal View'),
  ('Askari 9'),
  ('Askari 10'),
  ('Askari 11'),
  ('Cavalry Ground'),
  ('Defence Raya'),
  ('Park View City'),
  ('Al-Noor Orchard'),
  ('Eden City'),
  ('Pine Avenue'),
  ('Royal Orchard'),
  ('State Life Housing Society'),
  ('PCSIR Staff Colony'),
  ('EME Society')
ON CONFLICT (name) DO NOTHING;
