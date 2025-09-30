# Supabase B2B Authentication Testing Guide

## Prerequisites

1. **Run the Complete Fix Script**
   - Open Supabase Dashboard → SQL Editor
   - Copy entire contents of `supabase/migrations/20250930_complete_auth_fix.sql`
   - Run the script
   - You should see "Auth fix script completed successfully!" message

2. **Verify Environment Variables**
   ```env
   # .env.local should contain:
   NEXT_PUBLIC_SUPABASE_URL=https://vmxjczdwyhrierexjoph.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Testing the Complete Auth Flow

### 1. Test Signup Flow
1. Start the dev server: `pnpm dev`
2. Navigate to http://localhost:3000/signup
3. Fill in the form:
   - Full Name: Test Admin
   - Email: admin@testorg.com
   - Password: TestPass123!
   - Organization Name: Test Organization
   - Organization URL: test-org (will auto-slugify)
4. Click "Create Account"

**Expected Result**:
- Redirects to `/org/test-org`
- Shows organization dashboard

**Verify in Supabase Dashboard**:
- Authentication → Users: New user exists
- Table Editor → profiles: User with role='admin'
- Table Editor → organizations: Organization created with slug='test-org'
- Table Editor → organization_members: Member record with role='admin'

### 2. Test Login Flow
1. Sign out (if logged in)
2. Navigate to http://localhost:3000/login
3. Enter credentials from signup
4. Click "Sign In"

**Expected Result**:
- Redirects to organization dashboard
- User session restored

### 3. Test Protected Routes
1. While logged in, navigate to:
   - `/org/test-org` - Should show dashboard
   - `/org/test-org/settings` - Should show settings
   - `/org/test-org/members` - Should show members list

2. Sign out and try same routes
   - Should redirect to login page

### 4. Test LiveKit Integration
1. While logged in, create a classroom:
   - Go to `/org/test-org/classrooms`
   - Click "Create Classroom"
   - Enter room details
2. Join the classroom
   - Should have admin/teacher permissions
   - Can manage participants

### 5. Test Role-Based Access

**As Admin (first user)**:
- ✅ Can create classrooms
- ✅ Can invite members
- ✅ Can manage organization settings
- ✅ Has full LiveKit permissions

**As Teacher (invite someone)**:
- ✅ Can create/manage own classrooms
- ✅ Can't change org settings
- ✅ Has teacher LiveKit permissions

**As Student (invite someone)**:
- ✅ Can join classrooms
- ✅ Listen-only by default
- ✅ Can request speaking permission

## Common Issues & Solutions

### Issue: "Failed to create organization"
**Solution**: Run the complete fix script - INSERT policy was missing

### Issue: "Infinite recursion detected"
**Solution**: Run the complete fix script - RLS policies were self-referential

### Issue: "User created but wrong role"
**Solution**: Run the complete fix script - Trigger was setting 'student' instead of 'admin'

### Issue: Form submission fails with regex error
**Solution**: Already fixed in `signup-form.tsx` - pattern attribute removed

## Database Verification Queries

Run these in Supabase SQL Editor to verify data:

```sql
-- Check all users and their roles
SELECT
  p.id,
  p.full_name,
  p.role,
  o.name as organization,
  om.role as member_role
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
LEFT JOIN organization_members om ON om.user_id = p.id;

-- Check organization structure
SELECT
  o.name,
  o.slug,
  COUNT(om.id) as member_count
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id
GROUP BY o.id, o.name, o.slug;

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Next Steps

After successful testing:

1. **Invite Team Members**
   - Implement invitation flow (Phase 2)
   - Add email notifications

2. **Enhance Classroom Features**
   - Complete remaining classroom phases
   - Add recording capabilities

3. **Production Deployment**
   - Set up production Supabase project
   - Configure environment variables
   - Enable additional security features

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase Dashboard logs
3. Verify all environment variables are set
4. Ensure you ran the complete fix script
5. Try the cleanup script if you have orphaned data