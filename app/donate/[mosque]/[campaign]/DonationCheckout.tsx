'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  IconLock,
  IconLoader2,
  IconBuildingBank,
  IconCreditCard,
  IconCheck,
  IconChevronLeft,
} from '@tabler/icons-react';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { getCampaignIcon } from '@/lib/campaign-icons';
import { LottieIcon } from '@/components/lottie-icon';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CampaignProp {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  cause_type: string | null;
  icon: string | null;
  raised_cents: number;
}

interface DonationCheckoutProps {
  campaign: CampaignProp;
  orgName: string;
  orgSlug: string;
  isRecurring?: boolean;
}

interface IdealIssuer {
  id: string;
  name: string;
}

type PaymentMethod = 'ideal' | 'card' | null;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRESET_AMOUNTS = [5, 10, 25, 50, 100] as const;
const IDEAL_METHOD_ID = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

function getBankLogoFilename(bankName: string): string {
  const lower = bankName.toLowerCase();
  if (lower.includes('abn') || lower.includes('amro')) return 'ABN Amro';
  if (lower.includes('ing')) return 'ING';
  if (lower.includes('rabo')) return 'Rabobank';
  if (lower.includes('sns')) return 'SNS';
  if (lower.includes('asn')) return 'ASN';
  if (lower.includes('triodos')) return 'Triodos';
  if (lower.includes('knab')) return 'Knab';
  if (lower.includes('bunq')) return 'Bunq';
  if (lower.includes('revolut')) return 'Revolut';
  if (lower.includes('handels')) return 'Handelsbanken';
  if (lower.includes('regio')) return 'RegioBank';
  if (lower.includes('lanschot')) return 'Van Lanschot';
  if (lower.includes('yoursafe')) return 'Yoursafe';
  return bankName;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatEuroWhole(euros: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(euros);
}

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/*
 * Stepper (bottom half only):
 *   One-time:  step 0 = choose method  →  step 1 = choose bank (iDEAL only)  →  step 2 = details + submit
 *              Card skips step 1: step 0 → step 2
 *   Recurring: step 0 = details + SEPA + submit  (single step)
 *
 * Amount picker lives in the top half, always visible.
 */

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DonationCheckout({
  campaign,
  orgName,
  orgSlug,
  isRecurring = false,
}: DonationCheckoutProps) {
  /* ---- Step state (bottom half only) ---- */
  const [step, setStep] = useState(0);
  const lastStep = isRecurring ? 0 : 2;

  // Amount (top half — always accessible)
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(25);
  const [customAmount, setCustomAmount] = useState('');

  // Payment method (one-time only)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [selectedIssuerId, setSelectedIssuerId] = useState<string>('');
  const [idealIssuers, setIdealIssuers] = useState<IdealIssuer[]>([]);
  const [loadingIssuers, setLoadingIssuers] = useState(false);

  // Donor info
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');

  // SEPA fields (recurring only)
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [ibanOwner, setIbanOwner] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recurringSuccess, setRecurringSuccess] = useState(false);

  const iconEntry = getCampaignIcon(campaign.icon);
  const hasGoal = campaign.goal_amount != null && campaign.goal_amount > 0;
  const pct = hasGoal
    ? Math.min(100, Math.round((campaign.raised_cents / campaign.goal_amount!) * 100))
    : null;

  /* ---- Fetch iDEAL issuers ---- */

  useEffect(() => {
    if (paymentMethod !== 'ideal' || idealIssuers.length > 0) return;
    setLoadingIssuers(true);
    fetch('/api/donate/ideal-issuers')
      .then((r) => r.json())
      .then((data) => setIdealIssuers(data.issuers ?? []))
      .catch(() => {
        setIdealIssuers([
          { id: '1', name: 'ABN Amro' },
          { id: '4', name: 'ING' },
          { id: '2', name: 'Rabobank' },
        ]);
      })
      .finally(() => setLoadingIssuers(false));
  }, [paymentMethod, idealIssuers.length]);

  /* ---- Amount helpers ---- */

  function resolveAmountCents(): number | null {
    if (selectedPreset !== 'custom') return selectedPreset * 100;
    const trimmed = customAmount.trim().replace(',', '.');
    if (!trimmed) return null;
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  function resolveDisplayEuros(): string | null {
    if (selectedPreset !== 'custom') return formatEuroWhole(selectedPreset);
    const cents = resolveAmountCents();
    if (!cents) return null;
    return formatEuro(cents);
  }

  /* ---- Auto-advance helpers ---- */

  function selectIdeal() {
    setPaymentMethod('ideal');
    setSelectedIssuerId('');
    // Advance to bank selection (step 1)
    setStep(1);
  }

  function selectCard() {
    setPaymentMethod('card');
    // Skip bank step, go straight to details (step 2)
    setStep(2);
  }

  function selectBank(issuerId: string) {
    setSelectedIssuerId(issuerId);
    // Advance to details (step 2)
    setStep(2);
  }

  /* ---- Validation (final step) ---- */

  function validate(): string | null {
    if (!resolveAmountCents()) return 'Please choose or enter a donation amount.';
    if (!isRecurring && !paymentMethod) return 'Please select a payment method.';
    if (paymentMethod === 'ideal' && !selectedIssuerId) return 'Please select your bank.';
    if (!donorName.trim()) return 'Please enter your name.';
    if (!EMAIL_RE.test(donorEmail.trim())) return 'Please enter a valid email address.';
    if (isRecurring) {
      if (!ibanOwner.trim()) return 'Please enter the name on the bank account.';
      if (!IBAN_RE.test(iban.replace(/\s+/g, '').toUpperCase()))
        return 'Please enter a valid IBAN.';
      if (!BIC_RE.test(bic.replace(/\s+/g, '').toUpperCase()))
        return 'Please enter a valid BIC.';
    }
    return null;
  }

  /* ---- Submit ---- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }

    const amountCents = resolveAmountCents()!;
    setSubmitting(true);

    try {
      if (!isRecurring) {
        const returnUrl = `${window.location.origin}/donate/${orgSlug}/thank-you`;
        const payload: Record<string, unknown> = {
          campaign_id: campaign.id,
          amount: amountCents,
          donor_name: donorName.trim(),
          donor_email: donorEmail.trim(),
          return_url: returnUrl,
        };
        if (paymentMethod === 'ideal') {
          payload.payment_method_id = IDEAL_METHOD_ID;
          if (selectedIssuerId) payload.issuer_id = selectedIssuerId;
        }

        const res = await fetch('/api/donate/one-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.checkout_url)
          throw new Error(data.error || 'Could not start checkout.');
        window.location.href = data.checkout_url;
        return;
      }

      const res = await fetch('/api/donate/recurring', {
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
      const data = await res.json();
      if (!res.ok || !data.paynl_mandate_id)
        throw new Error(data.error || 'Could not create mandate.');
      setRecurringSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Recurring success ---- */

  if (recurringSuccess) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-4 dark:bg-black">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Thank you!</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Your monthly donation of {resolveDisplayEuros()} to{' '}
            <strong>{campaign.title}</strong> has been set up.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            You will receive a confirmation at {donorEmail}.
          </p>
        </div>
      </div>
    );
  }

  /* ---- Layout ---- */

  const displayAmount = resolveDisplayEuros();

  let ctaLabel = isRecurring ? 'Start monthly donation' : 'Donate';
  if (!isRecurring && paymentMethod === 'ideal') ctaLabel = 'Continue to your bank';
  if (!isRecurring && paymentMethod === 'card') ctaLabel = 'Pay with card';
  if (displayAmount) ctaLabel += ` ${displayAmount}`;

  return (
    <div className="flex h-[100dvh] flex-col bg-white dark:bg-black">
      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {orgName}
          </span>
          <span className="text-[11px] text-slate-400">
            Powered by{' '}
            <a href="https://www.bayaan.app" className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300">
              Bayaan
            </a>
          </span>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  TOP HALF — Campaign summary + Amount picker (always visible) */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-shrink-0 flex-col items-center justify-center overflow-y-auto px-4 py-4" style={{ height: '46%' }}>
        <div className="w-full max-w-lg">
          {/* Campaign info */}
          <div className="text-center">
            {iconEntry && (
              <div className="mx-auto mb-2 flex flex-1 items-center justify-center">
                <LottieIcon src={iconEntry.file} className="aspect-square w-full max-w-[40vw]" />
              </div>
            )}
            <h1 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              {campaign.title}
            </h1>
            {campaign.description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {campaign.description}
              </p>
            )}
            {hasGoal && (
              <div className="mt-2.5">
                <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatEuro(campaign.raised_cents)}</span>
                  {' '}raised of {formatEuro(campaign.goal_amount!)} goal
                </p>
              </div>
            )}
          </div>

          {/* Amount picker */}
          <div className="mt-4">
            <h2 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {isRecurring ? 'Monthly amount' : 'Donation amount'}
            </h2>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {PRESET_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSelectedPreset(value); setCustomAmount(''); }}
                  className={cn(
                    'h-10 rounded-lg border-2 text-xs font-semibold transition-all sm:h-12 sm:rounded-xl sm:text-sm',
                    selectedPreset === value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {formatEuroWhole(value)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPreset('custom')}
                className={cn(
                  'h-10 rounded-lg border-2 text-xs font-semibold transition-all sm:h-12 sm:rounded-xl sm:text-sm',
                  selectedPreset === 'custom'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                Other
              </button>
            </div>

            {selectedPreset === 'custom' && (
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">&euro;</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className={cn(
                    'h-11 w-full rounded-lg border-2 border-slate-200 bg-white pl-8 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all sm:h-12 sm:rounded-xl',
                    'placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10',
                    'dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10',
                  )}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  BOTTOM HALF — Stepper: payment method → details              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 dark:border-slate-800">
        <div className="mx-auto flex w-full min-h-0 max-w-lg flex-1 flex-col px-4 py-3">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">

            {/* Back arrow + step title */}
            <div className="mb-3 flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    // Card skips bank step, so back from details goes to method
                    const prev = step === 2 && paymentMethod === 'card' ? 0 : step - 1;
                    if (prev === 0) setPaymentMethod(null);
                    setStep(prev);
                    setErrorMessage(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Go back"
                >
                  <IconChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-8" />
              )}
              <h2 className="flex-1 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                {!isRecurring && step === 0 && 'Payment method'}
                {!isRecurring && step === 1 && 'Choose your bank'}
                {!isRecurring && step === 2 && 'Your details'}
                {isRecurring && 'Your details'}
              </h2>
              <div className="w-8" />
            </div>

            {/* ─�� Step 0 (one-time): Choose payment method ── */}
            {!isRecurring && step === 0 && (
              <div className="animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* iDEAL tile */}
                  <button
                    type="button"
                    onClick={selectIdeal}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all sm:gap-2 sm:px-4 sm:py-4',
                      paymentMethod === 'ideal'
                        ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                    )}
                  >
                    <Image
                      src="/images/banks/ideal-logo-svgrepo-com.svg"
                      alt="iDEAL"
                      width={36}
                      height={36}
                      className="h-8 w-8 object-contain sm:h-9 sm:w-9"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <IconBuildingBank className="hidden h-8 w-8 text-[#CC0066]" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">iDEAL</span>
                  </button>

                  {/* Card tile */}
                  <button
                    type="button"
                    onClick={selectCard}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all sm:gap-2 sm:px-4 sm:py-4',
                      paymentMethod === 'card'
                        ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                    )}
                  >
                    <IconCreditCard className="h-7 w-7 text-slate-600 dark:text-slate-300 sm:h-8 sm:w-8" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Card</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 1 (one-time, iDEAL): Choose your bank ── */}
            {!isRecurring && step === 1 && (
              <div className="min-h-0 flex-1 animate-in fade-in slide-in-from-right-4 duration-200">
                {loadingIssuers ? (
                  <div className="flex items-center justify-center py-6">
                    <IconLoader2 className="h-5 w-5 animate-spin text-slate-400" />
                    <span className="ml-2 text-sm text-slate-400">Loading banks…</span>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto rounded-xl border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    {idealIssuers.map((issuer, idx) => {
                      const filename = getBankLogoFilename(issuer.name);
                      const isSelected = selectedIssuerId === issuer.id;
                      return (
                        <button
                          key={issuer.id}
                          type="button"
                          onClick={() => selectBank(issuer.id)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
                            idx !== 0 && 'border-t border-slate-100 dark:border-slate-800',
                            isSelected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                          )}
                        >
                          <Image
                            src={`/images/banks/${encodeURIComponent(filename)}.svg`}
                            alt={issuer.name}
                            width={32}
                            height={32}
                            className="h-8 w-8 flex-shrink-0 rounded-md"
                          />
                          <span className={cn(
                            'flex-1 text-sm font-medium',
                            isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200',
                          )}>
                            {issuer.name}
                          </span>
                          {isSelected && (
                            <IconCheck className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Final step: Donor details ── */}
            {step === lastStep && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="space-y-3">
                  <FloatingLabelInput
                    id="donor_name"
                    label="Full name"
                    type="text"
                    autoComplete="name"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    required
                  />
                  <div>
                    <FloatingLabelInput
                      id="donor_email"
                      label="Email address"
                      type="email"
                      autoComplete="email"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      required
                    />
                    <p className="mt-1 pl-1 text-[11px] text-slate-400">For your donation receipt</p>
                  </div>
                </div>

                {/* SEPA fields (recurring) */}
                {isRecurring && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Bank details</h3>
                    <p className="mb-2 text-xs text-slate-400">
                      For SEPA direct debit. Your IBAN is sent to Pay.nl and is not stored by Bayaan.
                    </p>
                    <div className="space-y-3">
                      <FloatingLabelInput id="iban_owner" label="Name on account" type="text" value={ibanOwner} onChange={(e) => setIbanOwner(e.target.value)} required />
                      <FloatingLabelInput id="iban" label="IBAN" type="text" autoComplete="off" value={iban} onChange={(e) => setIban(e.target.value)} required />
                      <FloatingLabelInput id="bic" label="BIC" type="text" autoComplete="off" value={bic} onChange={(e) => setBic(e.target.value)} required />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Spacer — only when bank list isn't filling the space */}
            {!(step === 1 && !isRecurring) && <div className="flex-1" />}

            {/* Error */}
            {errorMessage && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Submit — only on final step */}
            {step === lastStep && (
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'mt-3 flex h-12 w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all sm:h-14 sm:text-base',
                  'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]',
                  'dark:bg-emerald-500 dark:hover:bg-emerald-600',
                  'disabled:pointer-events-none disabled:opacity-60',
                )}
              >
                {submitting ? <IconLoader2 className="h-5 w-5 animate-spin" /> : ctaLabel}
              </button>
            )}

            {/* Trust footer */}
            <div className="mt-2 flex flex-shrink-0 items-center justify-center gap-1.5 pb-[env(safe-area-inset-bottom)] text-[11px] text-slate-400">
              <IconLock className="h-3.5 w-3.5" />
              <span>Secure payment via Pay.nl</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
