'use client';

import { useState } from 'react';
import { startTrialUpgradeCheckout } from '@/lib/actions/billing';

export function UpgradeButton() {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setErr(null);
    setSubmitting(true);
    try {
      const result = await startTrialUpgradeCheckout();
      if (!result.success || !result.checkoutUrl) {
        setErr(result.error ?? 'Could not start checkout. Please try again.');
        setSubmitting(false);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setErr('Could not start checkout. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      {err && (
        <div className="auth-banner" role="alert" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 18 }} aria-hidden>
            ⚠️
          </span>
          <div>{err}</div>
        </div>
      )}
      <button type="button" className="auth-btn" onClick={handleClick} disabled={submitting}>
        {submitting ? (
          <>
            <span className="auth-spinner" /> Opening checkout…
          </>
        ) : (
          'Continue with Pro'
        )}
      </button>
    </>
  );
}
