-- Fix for signup flow: Add missing INSERT policy to organizations table
-- Run this in Supabase SQL Editor to fix organization creation during signup

-- Allow authenticated users to create organizations (required for signup flow)
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);