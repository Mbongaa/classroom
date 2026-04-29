'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MandateView {
  status: string;
  donorName: string;
  donorEmail: string;
  ibanOwner: string;
  monthlyAmount: number | null;
  paynlMandateId: string;
  firstDebitAt: string | null;
  nextDebitAt: string | null;
  createdAt: string;
  campaign: { id: string; title: string; icon: string | null };
  organization: { id: string; name: string; slug: string };
}

function formatEur(cents: number | null | undefined): string {
  if (typeof cents !== 'number') return '—';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

export function ManageMandateClient({
  token,
  initial,
}: {
  token: string;
  initial: MandateView;
}) {
  const [view, setView] = useState<MandateView>(initial);
  const [editingAmount, setEditingAmount] = useState(false);
  const [draftAmountEur, setDraftAmountEur] = useState(
    typeof initial.monthlyAmount === 'number' ? (initial.monthlyAmount / 100).toFixed(2) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const isCancelled = view.status === 'CANCELLED' || view.status === 'EXPIRED';
  const canEdit = !isCancelled;

  async function handleSaveAmount() {
    setError(null);
    setSuccess(null);
    const eur = Number(draftAmountEur);
    if (!Number.isFinite(eur) || eur < 1 || eur > 1000) {
      setError('Amount must be between €1 and €1000');
      return;
    }
    const cents = Math.round(eur * 100);
    if (cents === view.monthlyAmount) {
      setEditingAmount(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/donate/manage/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to update amount');
        return;
      }
      setView({ ...view, monthlyAmount: cents });
      setEditingAmount(false);
      setSuccess(`Monthly amount updated to ${formatEur(cents)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/donate/manage/${token}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to cancel');
        return;
      }
      setView({ ...view, status: 'CANCELLED' });
      setConfirmCancel(false);
      setSuccess(`Your recurring donation has been cancelled.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-[#E7E2D6] rounded-lg p-8 shadow-sm">
          <div className="mb-6">
            <p className="text-sm text-[#6B6157]">Manage your recurring donation to</p>
            <h1 className="text-2xl font-semibold text-[#1F1B16]">{view.organization.name}</h1>
            <p className="text-sm text-[#6B6157] mt-1">{view.campaign.title}</p>
          </div>

          {isCancelled ? (
            <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-6">
              <p className="text-sm font-medium text-red-900">
                This recurring donation is {view.status.toLowerCase()}.
              </p>
              <p className="text-xs text-red-800 mt-1">
                No further debits will be processed. To donate again, start a new
                recurring donation from the campaign page.
              </p>
            </div>
          ) : null}

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Status</dt>
              <dd className="font-medium">{view.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Donor</dt>
              <dd className="font-medium">{view.donorName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Email</dt>
              <dd>{view.donorEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Bank account</dt>
              <dd>{view.ibanOwner}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">First debit</dt>
              <dd>{formatDate(view.firstDebitAt) || 'Not yet collected'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Next debit</dt>
              <dd>{formatDate(view.nextDebitAt) || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B6157]">Mandate reference</dt>
              <dd className="font-mono text-xs">{view.paynlMandateId}</dd>
            </div>
          </dl>

          <hr className="my-6 border-[#E7E2D6]" />

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#6B6157] mb-2">
                Monthly amount
              </p>
              {editingAmount && canEdit ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="1000"
                    inputMode="decimal"
                    className="border border-[#E7E2D6] rounded px-3 py-2 text-lg w-32"
                    value={draftAmountEur}
                    onChange={(e) => setDraftAmountEur(e.target.value)}
                    disabled={submitting}
                  />
                  <Button onClick={handleSaveAmount} disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save'}
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-[#6B6157] underline"
                    onClick={() => {
                      setEditingAmount(false);
                      setDraftAmountEur(
                        typeof view.monthlyAmount === 'number'
                          ? (view.monthlyAmount / 100).toFixed(2)
                          : '',
                      );
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-semibold">{formatEur(view.monthlyAmount)}</p>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-sm text-[#6B6157] underline"
                      onClick={() => setEditingAmount(true)}
                    >
                      Change
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {canEdit ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B6157] mb-2">
                  Cancel donation
                </p>
                {confirmCancel ? (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <p className="text-sm">
                      Are you sure? This stops all future debits. You can always set
                      up a new recurring donation later.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={submitting}
                      >
                        {submitting ? 'Cancelling…' : 'Yes, cancel'}
                      </Button>
                      <button
                        type="button"
                        className="text-sm text-[#6B6157] underline"
                        onClick={() => setConfirmCancel(false)}
                        disabled={submitting}
                      >
                        Keep my donation
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-red-700 underline"
                    onClick={() => {
                      setConfirmCancel(true);
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    Cancel my recurring donation
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {success ? (
            <div className="mt-6 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              {success}
            </div>
          ) : null}
          {error ? (
            <div className="mt-6 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900">
              {error}
            </div>
          ) : null}
        </div>

        <p className="text-xs text-[#6B6157] text-center mt-4">
          You received this management link in your donation confirmation email.
          Keep it private — anyone with the link can change or cancel this donation.
        </p>
      </div>
    </div>
  );
}
