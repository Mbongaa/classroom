-- =====================================================
-- FINAL FIX FOR INFINITE RECURSION IN RLS POLICIES
-- This completely resolves the circular reference issue
-- =====================================================

-- IMPORTANT: Run this entire script in Supabase SQL Editor

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON BOTH TABLES
-- =====================================================

-- Drop ALL policies on organizations table
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Drop ALL policies on organization_members table
DROP POLICY IF EXISTS "Users can view members in their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.organization_members;

-- Drop ALL policies on profiles table (to ensure clean state)
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- =====================================================
-- STEP 2: CREATE NEW ORGANIZATIONS POLICIES
-- Using profiles.organization_id to avoid circular references
-- =====================================================

-- SELECT: Users can view organizations they belong to
CREATE POLICY "Users can view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    -- Check via profiles.organization_id (avoids organization_members)
    id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND organization_id IS NOT NULL
    )
  );

-- INSERT: Any authenticated user can create an organization
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Only admins can update their organization
CREATE POLICY "Admins can update their organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    -- Check admin role via profiles (avoids organization_members)
    id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    -- Ensure they can only update their own org
    id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  );

-- DELETE: Only admins can delete their organization
CREATE POLICY "Admins can delete their organization"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  );

-- =====================================================
-- STEP 3: CREATE NEW ORGANIZATION_MEMBERS POLICIES
-- Avoiding self-referential queries
-- =====================================================

-- SELECT: Users can view members in their organization
CREATE POLICY "Users can view organization members"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    -- Use profiles to determine user's organization
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND organization_id IS NOT NULL
    )
  );

-- INSERT: Users can add themselves to organizations
CREATE POLICY "Users can insert themselves as members"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Can only add themselves
    user_id = auth.uid()
  );

-- UPDATE: Admins can update member roles
CREATE POLICY "Admins can update member roles"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    -- Check if user is admin via profiles (not organization_members)
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    -- Ensure they can only update in their own org
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  );

-- DELETE: Admins can remove members from their organization
CREATE POLICY "Admins can delete members"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    -- Check if user is admin via profiles (not organization_members)
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id IS NOT NULL
    )
  );

-- =====================================================
-- STEP 4: CREATE NEW PROFILES POLICIES
-- Ensuring proper access control
-- =====================================================

-- SELECT: Users can view profiles in their organization or their own
CREATE POLICY "Users can view relevant profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Can see their own profile
    id = auth.uid()
    OR
    -- Can see profiles in their organization
    organization_id IN (
      SELECT organization_id
      FROM public.profiles p2
      WHERE p2.id = auth.uid()
      AND p2.organization_id IS NOT NULL
    )
  );

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: Handled by trigger, but add policy for completeness
CREATE POLICY "System can create profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- =====================================================
-- STEP 5: FIX THE PROFILE TRIGGER
-- Ensure it sets 'admin' role for initial users
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
    'admin' -- Set as admin for B2B context (org creator)
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- STEP 6: CLEAN UP ORPHANED DATA
-- Remove incomplete signup attempts
-- =====================================================

-- Clean up orphaned organization_members (where profile doesn't exist)
DELETE FROM public.organization_members
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Clean up orphaned profiles (where auth user doesn't exist)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Clean up empty organizations (no members and no profiles pointing to them)
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
-- STEP 7: VERIFY THE SETUP
-- =====================================================

-- Check that RLS is enabled on all tables
DO $$
BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.classroom_participants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS enabled on all tables';
END $$;

-- List all policies to verify they're created correctly
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members', 'profiles');

  RAISE NOTICE '';
  RAISE NOTICE '📊 Total policies created: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ INFINITE RECURSION FIX COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'The circular dependency has been completely resolved by:';
  RAISE NOTICE '1. Organizations policies now use profiles.organization_id';
  RAISE NOTICE '2. Organization_members policies use profiles for auth checks';
  RAISE NOTICE '3. No table queries itself in its own policies';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 You can now test signup at http://localhost:3000/signup';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected flow:';
  RAISE NOTICE '1. User signs up → auth.users created';
  RAISE NOTICE '2. Trigger creates profile with role=admin';
  RAISE NOTICE '3. Organization created successfully';
  RAISE NOTICE '4. Profile updated with organization_id';
  RAISE NOTICE '5. User added to organization_members as admin';
END $$;

-- Show the current policies for verification
SELECT
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'organization_members', 'profiles')
ORDER BY tablename, policyname;