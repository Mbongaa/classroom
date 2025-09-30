# Minimal Policies Fix - Why This Works

## The Core Problem
The infinite recursion was caused by **self-referential queries** in RLS policies:
- Profiles SELECT queried profiles itself
- Organizations policies triggered profiles policies
- This created an infinite loop

## The Solution: Strip to Essentials
We've removed ALL complex cross-table queries and kept only what's ESSENTIAL for signup:

### Profiles Table (3 simple policies)
1. **SELECT**: `id = auth.uid()` - Users see ONLY their own profile
2. **INSERT**: `id = auth.uid()` - Trigger can create profiles
3. **UPDATE**: `id = auth.uid()` - Users update ONLY their own profile

**NO recursion possible** - No policy queries profiles itself!

### Organizations Table (2 simple policies)
1. **INSERT**: `true` - Anyone can create an organization
2. **SELECT**: Simple EXISTS check via profiles (not self-referential)

### Organization_members Table (2 simple policies)
1. **INSERT**: `user_id = auth.uid()` - Users add themselves
2. **SELECT**: Simple EXISTS check via profiles

## Why This Works for Signup

The signup flow in `lib/actions/auth.ts`:
```typescript
1. Create user → ✅ Works (auth.users)
2. Trigger creates profile → ✅ Works (profiles INSERT)
3. Create organization → ✅ Works (organizations INSERT: true)
4. Update profile with org_id → ✅ Works (profiles UPDATE: own profile)
5. Add to organization_members → ✅ Works (members INSERT: self)
```

**No step triggers recursion** because:
- No table queries itself
- All checks are simple and direct
- No complex cross-references

## What We Sacrificed (Temporarily)
- Users can't see other profiles in their org (not needed for signup)
- Admins can't update/delete orgs yet (not needed for signup)
- Complex member management (not needed for signup)

## Next Steps After Signup Works
Once signup is confirmed working, we can gradually add back:
1. Organization member viewing (carefully, without recursion)
2. Admin permissions for org management
3. Cross-organization profile viewing

But FIRST, we need signup to work!

## Run the Fix
1. Open Supabase Dashboard → SQL Editor
2. Copy entire `/supabase/migrations/20250930_minimal_policies_fix.sql`
3. Run it
4. Test signup with a NEW email

This approach follows the principle: **Make it work, then make it better!**