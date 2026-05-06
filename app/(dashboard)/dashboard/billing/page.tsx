import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  getDefaultPaymentMethod,
  listCustomerInvoices,
  getSubscriptionDetails,
} from '@/lib/stripe';
import { resolveActingAsForUser } from '@/lib/superadmin/acting-as';
import { getFinanceAccessForOrganization } from '@/lib/finance-access';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { CurrentPlanCard } from './CurrentPlanCard';
import { PaymentMethodCard } from './PaymentMethodCard';
import { InvoiceHistoryCard } from './InvoiceHistoryCard';
import { PlanComparisonCard } from './PlanComparisonCard';

export const metadata = {
  title: 'Billing - Bayaan',
  description: 'Manage your subscription and billing',
};

export default async function BillingPage() {
  const t = await getTranslations('billing');
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's profile. NOTE: superadmins legitimately have
  // organization_id = NULL (they don't belong to a tenant), so we resolve
  // impersonation BEFORE deciding whether to redirect. Otherwise a
  // superadmin acting as an org would bounce back to /dashboard before we
  // get a chance to honor the cookie.
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, is_superadmin')
    .eq('id', user.id)
    .single();

  // Honor superadmin "act as organization" impersonation. When active, we
  // show the impersonated org's billing instead of the superadmin's home org.
  const actingAs = await resolveActingAsForUser(user.id);
  const organizationId = actingAs?.organizationId ?? profile?.organization_id;

  if (!organizationId) {
    redirect('/dashboard');
  }

  const supabaseAdmin = createAdminClient();
  const access = await getFinanceAccessForOrganization(user.id, organizationId, supabaseAdmin);
  if (!access.canAccessFinance) {
    redirect('/dashboard');
  }

  // Get organization with billing info
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (!organization) {
    redirect('/dashboard');
  }

  // Fetch Stripe data if customer exists
  let paymentMethod = null;
  let invoices = null;
  let subscriptionDetails = null;

  if (organization.stripe_customer_id) {
    try {
      // Parallel fetching for performance
      [paymentMethod, invoices] = await Promise.all([
        getDefaultPaymentMethod(organization.stripe_customer_id),
        listCustomerInvoices(organization.stripe_customer_id, 5),
      ]);

      // Fetch subscription details if exists
      if (organization.stripe_subscription_id) {
        subscriptionDetails = await getSubscriptionDetails(
          organization.stripe_subscription_id
        );
      }
    } catch (error) {
      console.error('[Billing] Stripe fetch error:', error);
      // Continue rendering with database data only
      // Components will handle null Stripe data gracefully
    }
  }

  const isPastDue = organization.subscription_status === 'past_due';
  const isIncomplete = organization.subscription_status === 'incomplete';
  const isFree =
    organization.subscription_tier === 'free' && !organization.stripe_customer_id;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('pageTitle')}</h1>
        <p className="text-gray-400 mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* Warning Banners */}
      {isPastDue && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-500">{t('warnings.pastDueTitle')}</h3>
            <p className="text-sm text-yellow-400/80 mt-1">
              {t('warnings.pastDueMessage')}
            </p>
          </div>
        </div>
      )}

      {isIncomplete && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-500">{t('warnings.incompleteTitle')}</h3>
            <p className="text-sm text-red-400/80 mt-1">
              {t('warnings.incompleteMessage')}
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <CurrentPlanCard
        tier={organization.subscription_tier || 'free'}
        status={organization.subscription_status}
        periodEnd={organization.current_period_end}
        subscriptionDetails={subscriptionDetails}
      />

      {/* Payment Method Card (only for paying customers) */}
      {organization.stripe_customer_id && (
        <PaymentMethodCard paymentMethod={paymentMethod} />
      )}

      {/* Invoice History (only if has invoices) */}
      {organization.stripe_customer_id && invoices && invoices.data.length > 0 && (
        <InvoiceHistoryCard invoices={invoices.data} />
      )}

      {/* Plan Comparison (only for free tier users) */}
      {isFree && <PlanComparisonCard currentTier="free" />}

      {/* Manage Subscription (only for paying customers) */}
      {organization.stripe_customer_id && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{t('manage.title')}</h2>
          <p className="text-gray-400 text-sm mb-6">
            {t('manage.description')}
          </p>
          <ManageSubscriptionButton />
        </div>
      )}
    </div>
  );
}
