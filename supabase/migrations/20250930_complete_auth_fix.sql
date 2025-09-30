-- =====================================================
-- COMPLETE AUTH FIX SCRIPT
-- Run this entire script in Supabase SQL Editor to fix all auth issues
-- =====================================================

-- Step 1: Fix the profile trigger to set 'admin' role for organization creators
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
    'admin' -- Changed from 'student' to 'admin' for B2B context
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 2: Fix infinite recursion in organization_members policies
-- =====================================================

-- Drop ALL existing policies on organization_members to start fresh
DROP POLICY IF EXISTS "Users can view members in their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.organization_members;

-- Create new non-recursive SELECT policy using profiles table
CREATE POLICY "Users can view members in their organization"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- INSERT: Users can add themselves (no recursion risk)
CREATE POLICY "Users can insert themselves as members"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Admins can update member roles
CREATE POLICY "Admins can update member roles"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- DELETE: Admins can remove members
CREATE POLICY "Admins can delete members"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- Step 3: Ensure organizations INSERT policy exists
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 4: Verify all RLS is enabled
-- =====================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Step 5: Clean up any orphaned test data (optional but recommended)
-- =====================================================
-- This removes any incomplete signup attempts from testing

-- Delete orphaned organization_members (where user doesn't exist in profiles)
DELETE FROM public.organization_members
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Delete orphaned profiles (where auth user doesn't exist)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Delete empty organizations (no members)
DELETE FROM public.organizations
WHERE id NOT IN (SELECT DISTINCT organization_id FROM public.organization_members WHERE organization_id IS NOT NULL);

-- Step 6: Verify the setup
-- =====================================================
-- Run these queries to verify everything is configured correctly:

-- Check if policies are created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'organization_members', 'profiles')
ORDER BY tablename, policyname;

-- Check if trigger exists and is configured correctly
SELECT
  tgname as trigger_name,
  proname as function_name,
  tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Auth fix script completed successfully!';
  RAISE NOTICE 'You can now test the signup flow at http://localhost:3000/signup';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected flow:';
  RAISE NOTICE '1. User signs up → auth.users record created';
  RAISE NOTICE '2. Trigger creates profile with role=admin';
  RAISE NOTICE '3. Organization is created';
  RAISE NOTICE '4. Profile is updated with organization_id';
  RAISE NOTICE '5. User is added to organization_members as admin';
END $$;