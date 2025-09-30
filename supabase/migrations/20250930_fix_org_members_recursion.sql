-- Fix infinite recursion in organization_members policies
-- Run this in Supabase SQL Editor

-- Drop the problematic "for all" policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;

-- Create separate policies for each operation to avoid recursion

-- INSERT: Users can add themselves (no table self-reference, no recursion)
CREATE POLICY "Users can insert themselves as members"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Admins can update member roles (safe - row already exists)
CREATE POLICY "Admins can update member roles"
  ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Admins can remove members (safe - row already exists)
CREATE POLICY "Admins can delete members"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );