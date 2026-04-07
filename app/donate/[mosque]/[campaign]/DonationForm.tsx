'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PulsatingLoader from '@/components/ui/pulsating-loader';

/**
 * Donation form — client component rendered by /donate/[mosque]/[campaign].
 *
 * Uses only existing Shadcn primitives (Button, Input, Label, Card) +
 * PulsatingLoader for the submit spinner. No new colors or components are
 * introduced in Phase 1.
 *
 * One-time flow:  POST /api/donate/one-time  →  window.location = checkout_url
 * Monthly flow:   POST /api/donate/recurring →  inline confirmation
 */

interface CampaignProp {
  id: string;
  slug: string;
  title: string;
  goal_amount: number | null;
}

interface DonationFormProps {
  campaign: CampaignProp;
}

type Frequency = 'one_time' | 'monthly';

const PRESET_AMOUNTS_EUR = [10, 25, 50] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

interface RecurringSuccess {
  paynl_mandate_id: string;
  status: string;
  message?: string;
}

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DonationForm({ campaign }: DonationFormProps) {
  const [frequency, setFrequency] = useState<Frequency>('one_time');
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [ibanOwner, setIbanOwner] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recurringSuccess, setRecurringSuccess] = useState<RecurringSuccess | null>(null);

  // Amount resolution — returns integer cents.
  function resolveAmountCents(): number | null {
    if (selectedPreset !== 'custom') {
      return selectedPreset * 100;
    }
    const trimmed = customAmount.trim().replace(',', '.');
    if (!trimmed) return null;
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  function validateSharedFields(): string | null {
    if (!donorName.trim()) return 'Please enter your name.';
    if (!EMAIL_RE.test(donorEmail.trim())) return 'Please enter a valid email address.';
    return null;
  }

  function validateMonthlyFields(): string | null {
    if (!ibanOwner.trim()) return 'Please enter the name on the bank account.';
    const ibanClean = iban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_RE.test(ibanClean)) return 'Please enter a valid IBAN.';
    const bicClean = bic.replace(/\s+/g, '').toUpperCase();
    if (!BIC_RE.test(bicClean)) return 'Please enter a valid BIC.';
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setRecurringSuccess(null);

    const amountCents = resolveAmountCents();
    if (!amountCents) {
      setErrorMessage('Please choose or enter a donation amount.');
      return;
    }

    const sharedError = validateSharedFields();
    if (sharedError) {
      setErrorMessage(sharedError);
      return;
    }

    if (frequency === 'monthly') {
      const monthlyError = validateMonthlyFields();
      if (monthlyError) {
        setErrorMessage(monthlyError);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (frequency === 'one_time') {
        const returnUrl = `${window.location.origin}/thank-you`;
        const response = await fetch('/api/donate/one-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaign.id,
            amount: amountCents,
            donor_name: donorName.trim(),
            donor_email: donorEmail.trim(),
            return_url: returnUrl,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.checkout_url) {
          throw new Error(data.error || 'Could not start checkout.');
        }
        window.location.href = data.checkout_url;
        return;
      }

      // Monthly flow — create SEPA mandate.
      const response = await fetch('/api/donate/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          amount: amountCents,
          donor_name: donorName.trim(),
          donor_email: donorEmail.trim(),
          iban: iban.replace(/\s+/g, '').toUpperCase(),
          bic: bic.replace(/\s+/g, '').toUpperCase(),
          iban_owner: ibanOwner.trim(),
          process_date: isoDatePlusDays(3),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.paynl_mandate_id) {
        throw new Error(data.error || 'Could not create mandate.');
      }
      setRecurringSuccess({
        paynl_mandate_id: data.paynl_mandate_id,
        status: data.status,
        message: data.message,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (recurringSuccess) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold">Thank you</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your monthly donation to <strong>{campaign.title}</strong> is set up.
          </p>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Mandate reference: <code>{recurringSuccess.paynl_mandate_id}</code>
          </p>
          {recurringSuccess.message && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {recurringSuccess.message}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount picker */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS_EUR.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={selectedPreset === value ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedPreset(value);
                    setCustomAmount('');
                  }}
                >
                  €{value}
                </Button>
              ))}
              <Button
                type="button"
                variant={selectedPreset === 'custom' ? 'default' : 'outline'}
                onClick={() => setSelectedPreset('custom')}
              >
                Other
              </Button>
            </div>
            {selectedPreset === 'custom' && (
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="Amount in EUR"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Frequency toggle */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={frequency === 'one_time' ? 'default' : 'outline'}
                onClick={() => setFrequency('one_time')}
              >
                One-time
              </Button>
              <Button
                type="button"
                variant={frequency === 'monthly' ? 'default' : 'outline'}
                onClick={() => setFrequency('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>

          {/* Donor fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="donor_name">Name</Label>
              <Input
                id="donor_name"
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donor_email">Email</Label>
              <Input
                id="donor_email"
                type="email"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {frequency === 'monthly' && (
            <div className="space-y-4 rounded-md border border-[rgba(128,128,128,0.3)] p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                For SEPA direct debit. Your IBAN is sent to our payment provider (Pay.nl) and
                is not stored by Bayaan Hub.
              </p>
              <div className="space-y-2">
                <Label htmlFor="iban_owner">Name on account</Label>
                <Input
                  id="iban_owner"
                  type="text"
                  value={ibanOwner}
                  onChange={(e) => setIbanOwner(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  type="text"
                  placeholder="NL69INGB0123456789"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bic">BIC</Label>
                <Input
                  id="bic"
                  type="text"
                  placeholder="INGBNL2A"
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errorMessage}
            </p>
          )}

          <div>
            {submitting ? (
              <PulsatingLoader />
            ) : (
              <Button type="submit" className="w-full" size="lg">
                Donate now
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
