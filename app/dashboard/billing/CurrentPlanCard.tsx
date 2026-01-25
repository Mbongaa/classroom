import Stripe from 'stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, DollarSign } from 'lucide-react';

interface CurrentPlanCardProps {
  tier: string;
  status: string;
  periodEnd: string | null;
  subscriptionDetails: Stripe.Subscription | null;
}

export function CurrentPlanCard({
  tier,
  status,
  periodEnd,
  subscriptionDetails,
}: CurrentPlanCardProps) {
  // Status color mapping
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; className: string }
    > = {
      active: {
        label: 'Active',
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
      },
      trialing: {
        label: 'Trial',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      },
      past_due: {
        label: 'Past Due',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      },
      canceled: {
        label: 'Canceled',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
      },
      unpaid: {
        label: 'Unpaid',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
      },
      incomplete: {
        label: 'Incomplete',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      },
    };

    const config = statusConfig[status] || statusConfig.incomplete;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Format tier name
  const tierName = tier === 'pro' ? 'Pro Plan' : tier === 'beta' ? 'Beta Plan' : 'Free Plan';

  // Get billing interval
  const interval = subscriptionDetails?.items?.data[0]?.price?.recurring?.interval;
  const intervalLabel = interval === 'month' ? '/month' : interval === 'year' ? '/year' : '';

  // Get price
  const amount = subscriptionDetails?.items?.data[0]?.price?.unit_amount;
  const currency = subscriptionDetails?.items?.data[0]?.price?.currency;
  const price =
    amount && currency
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency.toUpperCase(),
        }).format(amount / 100)
      : null;

  // Format next billing date
  const nextBillingDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Check if subscription is set to cancel at period end
  const cancelAtPeriodEnd = subscriptionDetails?.cancel_at_period_end;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Name and Price */}
        <div>
          <h3 className="text-2xl font-bold text-white">{tierName}</h3>
          {price && (
            <p className="text-gray-400 mt-1">
              {price}
              {intervalLabel}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Billing Information */}
        <div className="space-y-3">
          {/* Next Billing Date or Access Until */}
          {nextBillingDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">
                  {cancelAtPeriodEnd || status === 'canceled'
                    ? 'Access until'
                    : status === 'trialing'
                      ? 'Trial ends'
                      : 'Next billing date'}
                </p>
                <p className="text-sm text-gray-400">{nextBillingDate}</p>
              </div>
            </div>
          )}

          {/* Billing Amount */}
          {price && !cancelAtPeriodEnd && status !== 'canceled' && (
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Amount</p>
                <p className="text-sm text-gray-400">{price}</p>
              </div>
            </div>
          )}

          {/* Cancellation Notice */}
          {cancelAtPeriodEnd && status !== 'canceled' && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                Your subscription is set to cancel at the end of the billing period.
                You can reactivate it anytime before {nextBillingDate}.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
