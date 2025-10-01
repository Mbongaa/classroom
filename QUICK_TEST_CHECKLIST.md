# Quick Test Checklist - Infinite Recursion Fix

## 🚀 Apply the Fix

1. **Open Supabase Dashboard**
   - Go to SQL Editor
   - Copy entire contents of `/supabase/migrations/20250930_fix_infinite_recursion_final.sql`
   - Run the script
   - You should see: "✅ INFINITE RECURSION FIX COMPLETE!"

## ✅ Test Signup Flow

1. **Start your app**: `pnpm dev`

2. **Test new signup**:
   - Go to http://localhost:3000/signup
   - Use a NEW email (not previously used)
   - Fill in all fields
   - Click "Create Account"

3. **Success indicators**:
   - ✅ No error messages
   - ✅ Redirected to `/org/[your-org-slug]`
   - ✅ Dashboard shows your organization name
   - ✅ Your role shows as "admin"

## 🔍 Verify in Database

Check these tables in Supabase Dashboard:

1. **auth.users** - Your user exists
2. **profiles** - Has entry with:
   - `role = 'admin'`
   - `organization_id` is NOT NULL
3. **organizations** - Your org exists with correct slug
4. **organization_members** - Has entry with:
   - `user_id` = your user ID
   - `organization_id` = your org ID
   - `role = 'admin'`

## ⚠️ If Issues Persist

Run this diagnostic query in SQL Editor:

```sql
-- Check for any remaining circular policies
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'organization_members')
ORDER BY tablename;

-- Should show the new policies without circular references
```

## 🎯 Key Changes Made

The fix completely eliminated circular dependencies by:

- **Organizations policies** now check `profiles.organization_id` instead of `organization_members`
- **Organization_members policies** use `profiles` for authorization instead of self-references
- **No table queries itself** in any RLS policy

This allows the signup flow to complete without triggering infinite recursion!
