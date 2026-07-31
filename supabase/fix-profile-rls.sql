-- 1. Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Superadmin read all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin update all profiles" ON profiles;

-- 2. SECURITY DEFINER helper — never triggers RLS
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

-- 3. New non-recursive policies

-- Users can read their own profile; superadmins can read all
CREATE POLICY "Read own or superadmin read all"
ON profiles FOR SELECT
USING (
  auth.uid() = id OR public.is_superadmin()
);

-- Users can insert their own profile (fallback if trigger fails)
CREATE POLICY "Insert own"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile but cannot change role;
-- superadmins can update any profile
CREATE POLICY "Update own or superadmin update all"
ON profiles FOR UPDATE
USING (
  auth.uid() = id OR public.is_superadmin()
)
WITH CHECK (
  (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  OR
  public.is_superadmin()
);
