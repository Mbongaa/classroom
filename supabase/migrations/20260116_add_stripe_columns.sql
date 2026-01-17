-- Add Stripe billing columns to organizations table
-- This migration adds support for Stripe payment integration

-- Add Stripe customer ID (links org to Stripe customer)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Add Stripe subscription ID (links org to active subscription)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- Add subscription status to track payment state
-- Values: incomplete, trialing, active, past_due, canceled, unpaid
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'incomplete';

-- Add current billing period end timestamp
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Create index for faster lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
ON organizations(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Create index for subscription status filtering
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
ON organizations(subscription_status);

-- Add comment for documentation
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe Customer ID for billing';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Active Stripe Subscription ID';
COMMENT ON COLUMN organizations.subscription_status IS 'Subscription status: incomplete, trialing, active, past_due, canceled, unpaid';
COMMENT ON COLUMN organizations.current_period_end IS 'End of current billing period';
