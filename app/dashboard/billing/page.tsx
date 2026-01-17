import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreditCard, Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

export const metadata = {
  title: 'Billing - Bayaan',
  description: 'Manage your subscription and billing',
};

export default async function BillingPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's profile and organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    redirect('/dashboard');
  }

  // Get organization with billing info
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single();

  if (!organization) {
    redirect('/dashboard');
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'trialing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'past_due':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'canceled':
      case 'unpaid':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'unpaid':
        return 'Unpaid';
      case 'incomplete':
        return 'Incomplete';
      default:
        return status;
    }
  };

  const isPastDue = organization.subscription_status === 'past_due';
  const isIncomplete = organization.subscription_status === 'incomplete';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 mt-1">Manage your subscription and payment methods</p>
      </div>

      {/* Warning banners */}
      {isPastDue && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-500">Payment Past Due</h3>
            <p className="text-sm text-yellow-400/80 mt-1">
              Your last payment failed. Please update your payment method to avoid service interruption.
            </p>
          </div>
        </div>
      )}

      {isIncomplete && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-500">Subscription Incomplete</h3>
            <p className="text-sm text-red-400/80 mt-1">
              Your subscription setup was not completed. Please complete payment to activate your account.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Current Plan</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl font-bold text-white capitalize">
                {organization.subscription_tier || 'Free'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                  organization.subscription_status
                )}`}
              >
                {getStatusLabel(organization.subscription_status)}
              </span>
            </div>
          </div>
          <CreditCard className="h-8 w-8 text-gray-600" />
        </div>

        {organization.current_period_end && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {organization.subscription_status === 'canceled'
                  ? 'Access until:'
                  : 'Next billing date:'}
              </span>
              <span className="text-white font-medium">
                {formatDate(organization.current_period_end)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Manage Subscription */}
      {organization.stripe_customer_id && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Manage Subscription</h2>
          <p className="text-gray-400 text-sm mb-6">
            Update your payment method, view invoices, or change your subscription plan through the
            Stripe Customer Portal.
          </p>
          <ManageSubscriptionButton />
        </div>
      )}

      {/* No billing info */}
      {!organization.stripe_customer_id && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
          <CreditCard className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Billing Information</h2>
          <p className="text-gray-400 text-sm">
            Your organization does not have billing set up yet. Contact support if you need
            assistance.
          </p>
        </div>
      )}
    </div>
  );
}
