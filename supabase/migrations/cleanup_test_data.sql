-- Cleanup script for test data
-- Use this to remove partial/failed signup attempts and start fresh

-- WARNING: This will delete ALL data in these tables!
-- Only run this in development, never in production!

-- Step 1: Delete all organization members
DELETE FROM public.organization_members;

-- Step 2: Delete all profiles
-- (This should cascade from auth.users deletion, but just in case)
DELETE FROM public.profiles;

-- Step 3: Delete all organizations
DELETE FROM public.organizations;

-- Step 4: Delete all auth users (in Supabase Dashboard)
-- Go to: Authentication → Users → Select user → Delete
-- Or run this if you have service_role access:
-- DELETE FROM auth.users;

-- After cleanup, you can test signup fresh with:
-- http://localhost:3000/signup