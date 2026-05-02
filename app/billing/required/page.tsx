import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { UpgradeButton } from './UpgradeButton';

export const metadata: Metadata = {
  title: 'Upgrade required',
  description: 'Continue using Bayaan with a Pro subscription',
};

const FEATURES = [
  'Unlimited classrooms',
  'Real-time Arabic → Dutch translation',
  'Recording & transcription',
  'Up to 100 participants per room',
  'Priority support',
];

/**
 * Hard paywall shown to org admins whose 30-day beta trial has expired.
 *
 * Reachable via the dashboard layout guard — once `subscription_status =
 * 'trialing'` AND `trial_ends_at < now()` AND no Stripe subscription
 * attached, every dashboard nav lands here. The page only renders for
 * orgs in that state; anyone who doesn't qualify is bounced back to
 * /dashboard so we don't accidentally upsell a paying customer.
 */
export default async function BillingRequiredPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'organization_id, is_superadmin, organization:organizations(name, subscription_status, trial_ends_at, stripe_subscription_id)',
    )
    .eq('id', user.id)
    .single();

  const typedProfile = profile as
    | {
        organization_id?: string | null;
        is_superadmin?: boolean | null;
        organization?: {
          name?: string;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          stripe_subscription_id?: string | null;
        } | null;
      }
    | null;

  if (!typedProfile?.organization_id) {
    redirect('/welcome');
  }

  const org = typedProfile.organization;
  const trialExpired =
    org?.subscription_status === 'trialing' &&
    org?.trial_ends_at != null &&
    new Date(org.trial_ends_at).getTime() < Date.now() &&
    !org?.stripe_subscription_id;

  // If the user shouldn't see the paywall, send them where they belong so
  // active subscribers don't hit a confusing upsell.
  if (typedProfile.is_superadmin) {
    redirect('/superadmin');
  }
  if (!trialExpired) {
    redirect('/dashboard');
  }

  const orgName = org?.name ?? 'your masjid';

  return (
    <div data-mkt-root className="auth-stage" style={{ gridTemplateColumns: '1fr' }}>
      <Link
        href="/"
        aria-label="Back to home"
        style={{
          position: 'fixed',
          top: 14,
          left: 14,
          zIndex: 70,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px 8px 12px',
          background: 'var(--mkt-bg-elev)',
          border: '2.5px solid var(--mkt-border)',
          borderRadius: 999,
          fontFamily: 'var(--mkt-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--mkt-fg)',
          textDecoration: 'none',
          boxShadow: '3px 3px 0 var(--mkt-border)',
          transform: 'rotate(-1deg)',
          lineHeight: 1,
        }}
      >
        <ArrowLeft size={16} strokeWidth={2.6} aria-hidden />
        <span>Back</span>
      </Link>

      <div className="auth-right">
        <div className="auth-right-inner">
          <div className="auth-card">
            <h2
              style={{
                fontFamily: 'var(--mkt-font-display)',
                fontSize: 30,
                margin: 0,
                marginBottom: 4,
              }}
            >
              Your trial has{' '}
              <span
                style={{
                  background:
                    'linear-gradient(180deg, transparent 55%, rgba(255,77,77,0.35) 55%, rgba(255,77,77,0.35) 92%, transparent 92%)',
                  padding: '0 4px',
                }}
              >
                ended
              </span>
            </h2>
            <p
              style={{
                fontSize: 16,
                color: 'rgba(45,45,45,0.65)',
                marginBottom: 18,
                marginTop: 6,
                fontFamily: 'var(--mkt-font-body)',
              }}
            >
              Add a payment method to keep <strong>{orgName}</strong> running.
            </p>

            <div
              style={{
                background: 'var(--mkt-bg-elev)',
                border: '2.5px solid var(--mkt-border)',
                borderRadius: 14,
                padding: 18,
                marginBottom: 18,
                boxShadow: '4px 4px 0 var(--mkt-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mkt-font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  Pro
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mkt-font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  €199.99<span style={{ fontSize: 14, fontWeight: 400 }}>/month</span>
                </span>
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 6,
                }}
              >
                {FEATURES.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      fontFamily: 'var(--mkt-font-body)',
                    }}
                  >
                    <Check size={14} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <UpgradeButton />

            <p
              style={{
                fontSize: 13,
                color: 'rgba(45,45,45,0.6)',
                marginTop: 14,
                marginBottom: 0,
                textAlign: 'center',
                fontFamily: 'var(--mkt-font-body)',
              }}
            >
              Need custom pricing for a larger congregation or alliance? Email{' '}
              <a
                href="mailto:support@bayaan.ai?subject=Custom%20pricing%20request"
                style={{ color: 'var(--mkt-fg)', textDecoration: 'underline' }}
              >
                support@bayaan.ai
              </a>
              .
            </p>

            <div className="auth-footer-link" style={{ marginTop: 16 }}>
              Wrong account?{' '}
              <form action="/api/auth/signout" method="post" style={{ display: 'inline' }}>
                <button
                  type="submit"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                  }}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
