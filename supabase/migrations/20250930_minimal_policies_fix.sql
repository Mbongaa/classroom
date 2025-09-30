-- =====================================================
-- MINIMAL VIABLE POLICIES FIX
-- Strips down to ESSENTIAL policies only to fix recursion
-- =====================================================

-- IMPORTANT: Run this ENTIRE script in Supabase SQL Editor

DO $$
BEGIN
  RAISE NOTICE '🔧 Starting Minimal Policies Fix...';
  RAISE NOTICE 'This will remove complex policies and use simple ones for signup';
END $$;

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- =====================================================

-- Drop ALL policies on profiles
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;

-- Drop ALL policies on organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can delete their organization" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Drop ALL policies on organization_members
DROP POLICY IF EXISTS "Users can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view members in their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;

-- =====================================================
-- STEP 2: CREATE MINIMAL PROFILES POLICIES
-- No self-referential queries!
-- =====================================================

-- SELECT: Users can ONLY view their own profile (no organization checking)
CREATE POLICY "Users view own profile only"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- INSERT: For trigger to create profile
CREATE POLICY "System creates profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can ONLY update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- STEP 3: CREATE MINIMAL ORGANIZATIONS POLICIES
-- Simple checks without complex queries
-- =====================================================

-- INSERT: Any authenticated user can create an organization
CREATE POLICY "Users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Users can view organizations they belong to (via profiles)
-- SIMPLIFIED: Just check if user has this org in their profile
CREATE POLICY "Users view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organizations.id
    )
  );

-- Skip UPDATE and DELETE for now - not needed for signup

-- =====================================================
-- STEP 4: CREATE MINIMAL ORGANIZATION_MEMBERS POLICIES
-- Basic policies for signup flow
-- =====================================================

-- INSERT: Users can add themselves as members
CREATE POLICY "Users add themselves as members"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: Users can view members if they have the same org
-- SIMPLIFIED: Check via user's own profile, not complex queries
CREATE POLICY "Users view members of their org"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_members.organization_id
    )
  );

-- Skip UPDATE and DELETE for now - not needed for signup

-- =====================================================
-- STEP 5: ENSURE TRIGGER IS CORRECT
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'admin' -- First user is admin
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- STEP 6: CLEAN UP TEST DATA
-- =====================================================

-- Remove orphaned organization_members
DELETE FROM public.organization_members
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Remove orphaned profiles
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Remove empty organizations
DELETE FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.organization_id = o.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = o.id
);

-- =====================================================
-- STEP 7: ENSURE RLS IS ENABLED
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: VERIFICATION
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'organizations', 'organization_members');

  RAISE NOTICE '';
  RAISE NOTICE '✅ MINIMAL POLICIES APPLIED!';
  RAISE NOTICE 'Total policies created: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 What this fix does:';
  RAISE NOTICE '1. Profiles: Users can only see/edit their own profile';
  RAISE NOTICE '2. Organizations: Simple INSERT and SELECT only';
  RAISE NOTICE '3. Organization_members: Basic INSERT and SELECT only';
  RAISE NOTICE '4. NO self-referential queries that cause recursion';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test signup at http://localhost:3000/signup';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected flow:';
  RAISE NOTICE '1. User signs up → profile created with role=admin';
  RAISE NOTICE '2. Organization created successfully (no recursion!)';
  RAISE NOTICE '3. Profile updated with organization_id';
  RAISE NOTICE '4. User added to organization_members';
  RAISE NOTICE '5. Redirect to dashboard';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ Note: Complex viewing permissions removed for now.';
  RAISE NOTICE 'Add them back AFTER signup works!';
END $$;

-- Show the new simplified policies
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN length(qual) > 60 THEN substring(qual, 1, 57) || '...'
    ELSE qual
  END as using_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'organizations', 'organization_members')
ORDER BY tablename, cmd;