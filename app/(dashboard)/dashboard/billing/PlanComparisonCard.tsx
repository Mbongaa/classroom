import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface PlanComparisonCardProps {
  currentTier: string;
}

export function PlanComparisonCard({ currentTier }: PlanComparisonCardProps) {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      interval: '/month',
      tier: 'free',
      features: [
        '3 classrooms',
        '1 hour recordings',
        'Basic support',
        'Standard features',
      ],
      cta: 'Current Plan',
      ctaVariant: 'outline' as const,
      disabled: true,
    },
    {
      name: 'Pro',
      price: '€199.99',
      interval: '/month',
      tier: 'pro',
      features: [
        'Unlimited classrooms',
        'Unlimited recordings',
        'Email support',
        'Advanced features',
        'Priority access',
      ],
      cta: 'Upgrade to Pro',
      ctaVariant: 'default' as const,
      disabled: false,
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      interval: '',
      tier: 'enterprise',
      features: [
        'Everything in Pro',
        'Custom branding',
        'Dedicated support',
        'SLA guarantee',
        'Custom integrations',
      ],
      cta: 'Contact Sales',
      ctaVariant: 'outline' as const,
      disabled: false,
    },
  ];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Upgrade Your Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = currentTier === plan.tier;
            return (
              <div
                key={plan.tier}
                className={`rounded-lg border p-6 transition-all ${
                  plan.highlighted
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-gray-800 bg-gray-800/50'
                } ${isCurrent ? 'ring-2 ring-green-500/50' : ''}`}
              >
                {/* Plan Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500 border-green-500/20"
                      >
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    {plan.interval && (
                      <span className="text-gray-400 text-sm">{plan.interval}</span>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {plan.tier === 'enterprise' ? (
                  <Button
                    variant={plan.ctaVariant}
                    className="w-full"
                    asChild
                  >
                    <a href="mailto:sales@bayaan.ai">
                      {plan.cta}
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant={plan.ctaVariant}
                    className="w-full"
                    disabled={plan.disabled}
                    asChild={!plan.disabled}
                  >
                    {plan.disabled ? (
                      <span>{plan.cta}</span>
                    ) : (
                      <Link href="/api/stripe/create-checkout-session">{plan.cta}</Link>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-400">
            <strong>Need help choosing?</strong> Our Pro plan is perfect for growing
            teams, while Enterprise offers custom solutions for larger organizations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
