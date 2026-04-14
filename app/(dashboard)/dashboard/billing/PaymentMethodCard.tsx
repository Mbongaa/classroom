import Stripe from 'stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

interface PaymentMethodCardProps {
  paymentMethod: Stripe.PaymentMethod | null;
}

export function PaymentMethodCard({ paymentMethod }: PaymentMethodCardProps) {
  // Empty state if no payment method
  if (!paymentMethod || paymentMethod.type !== 'card') {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">No payment method on file</p>
            <p className="text-gray-500 text-xs mt-1">
              Add one via the customer portal below
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const card = paymentMethod.card;

  if (!card) {
    return null;
  }

  // Get card brand icon or text
  const getBrandDisplay = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
      diners: 'Diners Club',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    };

    return brandMap[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">
                {getBrandDisplay(card.brand)} •••• {card.last4}
              </p>
              <p className="text-sm text-gray-400">
                Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">Default payment method</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Update your payment method via the customer portal below
        </p>
      </CardContent>
    </Card>
  );
}
