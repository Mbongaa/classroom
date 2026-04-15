'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2 } from 'lucide-react';

export function ManageSubscriptionButton() {
  const t = useTranslations('billing.manage');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('failedOpen'));
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('opening')}
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            {t('button')}
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
