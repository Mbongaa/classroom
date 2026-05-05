'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  IconLock,
  IconLoader2,
  IconCheck,
  IconAlertCircle,
  IconChevronLeft,
} from '@tabler/icons-react';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import dynamic from 'next/dynamic';

const DotLottiePlayer = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => {
    const { DotLottieReact } = m;
    return function Player({ src }: { src: string }) {
      return (
        <DotLottieReact
          src={src}
          autoplay
          loop
          renderConfig={{ devicePixelRatio: 2.5 }}
          style={{ width: '100%', height: '100%' }}
        />
      );
    };
  }),
  { ssr: false },
);
import { validateIBAN, lookupBankByIBAN, formatIBAN } from '@/lib/iban';
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

interface MandateRegistrationProps {
  /** When omitted, this is a membership mandate (org-level, no campaign). */
  campaign?: CampaignProp | null;
  /** Required when campaign is omitted; ignored otherwise. */
  organizationId?: string;
  orgName: string;
  orgSlug: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRESET_AMOUNTS = [10, 25, 50, 100, 250] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/*
 * Stepper (bottom half):
 *   Step 0: Your details (name + email) → "Continue" button
 *   Step 1: Bank details (IBAN + BIC + account holder + mandate agreement) → Submit
 *
 * Amount picker lives in the top half, always visible.
 */

export function MandateRegistration({
  campaign,
  organizationId,
  orgName,
  orgSlug: _orgSlug,
}: MandateRegistrationProps) {
  const isMembership = !campaign;
  // Step state
  const [step, setStep] = useState(0);

  // Amount
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(25);
  const [customAmount, setCustomAmount] = useState('');

  // Donor info
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');

  // SEPA fields
  const [ibanRaw, setIbanRaw] = useState('');
  const [ibanOwner, setIbanOwner] = useState('');
  const [agreedToMandate, setAgreedToMandate] = useState(false);

  // IBAN validation state
  const [ibanTouched, setIbanTouched] = useState(false);
  const [ibanValidation, setIbanValidation] = useState<{
    valid: boolean;
    error?: string;
    bankName?: string;
    bankBic?: string;
    bankIssuerId?: string;
  }>({ valid: false });

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ---- IBAN validation (debounced on change) ---- */

  const validateIbanField = useCallback((raw: string) => {
    if (!raw.trim()) {
      setIbanValidation({ valid: false });
      return;
    }

    const result = validateIBAN(raw);
    if (!result.valid) {
      setIbanValidation({ valid: false, error: result.error });
      return;
    }

    // Look up bank info
    const bank = lookupBankByIBAN(result.iban!);
    setIbanValidation({
      valid: true,
      bankName: bank?.name,
      bankBic: bank?.bic,
      bankIssuerId: bank?.issuerId,
    });

  }, []);

  // Only validate via debounce once the user has typed enough characters
  // for a complete IBAN. Partial validation errors while typing are confusing.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const stripped = ibanRaw.replace(/\s/g, '');
      // Only auto-validate when we have a plausibly complete IBAN (15+ chars)
      // or when it's empty (to clear errors). Mid-typing validation is deferred to blur.
      if (stripped.length >= 15) {
        validateIbanField(ibanRaw);
      } else if (stripped.length === 0) {
        setIbanValidation({ valid: false });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [ibanRaw, validateIbanField]);

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

  /* ---- IBAN input handler ---- */

  function handleIbanChange(value: string) {
    setIbanRaw(value);
  }

  function handleIbanBlur() {
    setIbanTouched(true);
    const cleaned = ibanRaw.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length >= 5) {
      setIbanRaw(formatIBAN(cleaned));
      validateIbanField(cleaned);
    }
  }

  /* ---- Validation ---- */

  /** Step 0: donor details */
  function validateStep0(): string | null {
    if (!resolveAmountCents()) return 'Please choose or enter a monthly amount.';
    if (!donorName.trim()) return 'Please enter your name.';
    if (!EMAIL_RE.test(donorEmail.trim())) return 'Please enter a valid email address.';
    return null;
  }

  /** Step 1: bank details + mandate agreement */
  function validateStep1(): string | null {
    if (!ibanOwner.trim()) return 'Please enter the name on the bank account.';

    const ibanResult = validateIBAN(ibanRaw);
    if (!ibanResult.valid) return ibanResult.error || 'Please enter a valid IBAN.';

    if (!agreedToMandate) return 'Please agree to the SEPA Direct Debit mandate to continue.';

    return null;
  }

  function handleContinue() {
    setErrorMessage(null);
    const err = validateStep0();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setStep(1);
  }

  /* ---- Submit ---- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const err = validateStep1();
    if (err) {
      setErrorMessage(err);
      return;
    }

    const amountCents = resolveAmountCents()!;
    const ibanClean = ibanRaw.replace(/\s+/g, '').toUpperCase();
    // Derive BIC from IBAN bank code — standard per bank, no user input needed.
    const bank = lookupBankByIBAN(ibanClean);
    const bicClean = bank?.bic || '';

    setSubmitting(true);
    try {
      const res = await fetch('/api/donate/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(campaign
            ? { campaign_id: campaign.id }
            : { organization_id: organizationId }),
          amount: amountCents,
          donor_name: donorName.trim(),
          donor_email: donorEmail.trim(),
          iban: ibanClean,
          bic: bicClean,
          iban_owner: ibanOwner.trim(),
          process_date: isoDatePlusDays(3),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paynl_mandate_id) {
        throw new Error(data.error || 'Could not create mandate.');
      }
      setSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Success screen ---- */

  if (success) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white px-4 dark:bg-black">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Mandate registered
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Your monthly contribution of {resolveDisplayEuros()} to{' '}
            <strong>{orgName}</strong> has been set up.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your first payment will be collected within a few business days.
            You will receive a confirmation at <strong>{donorEmail}</strong>.
          </p>
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300">What happens next?</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Your bank will notify you of the first direct debit</li>
              <li>The mandate becomes active after the first successful collection</li>
              <li>You can cancel anytime by contacting your mosque or bank</li>
              <li>You have the right to a refund within 8 weeks of any debit</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Main form ---- */

  const displayAmount = resolveDisplayEuros();
  const ctaLabel = displayAmount
    ? `Start monthly donation ${displayAmount}`
    : 'Start monthly donation';

  // Determine IBAN field visual state
  const showIbanSuccess = ibanTouched && ibanValidation.valid;
  const showIbanError = ibanTouched && !ibanValidation.valid && ibanRaw.trim().length > 0;

  return (
    // h-[100svh] (not min-h) because globals.css sets html/body to overflow:hidden + touch-action:none
    // for LiveKit. Page-level scroll is disabled app-wide; this layout creates its own inner scroll container.
    <div className="flex h-[100svh] flex-col bg-white dark:bg-black">
      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {orgName}
          </span>
          <span className="text-[11px] text-slate-400">
            Powered by{' '}
            <a
              href="https://www.bayaan.app"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Bayaan
            </a>
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Inner scrollable area. touch-pan-y overrides body's touch-action:none so iOS scrolls. */}
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
          {/* Full-bleed Lottie — animation traverses the full viewport width */}
          <div
            aria-hidden="true"
            className="mx-auto w-full max-w-lg"
            style={{ aspectRatio: '392 / 132' }}
          >
            <DotLottiePlayer src="/lottie/brown-beads.lottie" />
          </div>

          {/* Padded content */}
          <div className="px-4 pb-6 sm:px-6 sm:pb-8">
            <div className="mx-auto w-full max-w-lg space-y-6 sm:space-y-7">
            {/* Heading */}
            <section className="text-center">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                Become a monthly contributor
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Support {orgName} with a recurring SEPA direct debit. Cancel anytime.
              </p>
            </section>

            {/* Amount picker */}
            <section>
              <h2 className="mb-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Monthly amount
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(value);
                      setCustomAmount('');
                    }}
                    className={cn(
                      'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
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
                    'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
                    selectedPreset === 'custom'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  Other
                </button>
              </div>

              {selectedPreset === 'custom' && (
                <div className="relative mt-2.5">
                  <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    &euro;
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    aria-label="Custom monthly amount in euros"
                    className={cn(
                      'h-12 w-full rounded-xl border-2 border-slate-200 bg-white pl-8 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all',
                      'placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10',
                      'dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10',
                    )}
                    autoFocus
                  />
                </div>
              )}
            </section>

            {/* Stepper section */}
            <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
              {/* Back arrow + step title */}
              <div className="mb-4 flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setStep(0); setErrorMessage(null); }}
                    className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Go back"
                  >
                    <IconChevronLeft className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="w-10" />
                )}
                <h2 className="flex-1 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                  {step === 0 ? 'Your details' : 'Bank details'}
                </h2>
                <div className="w-10" />
              </div>

              {/* ── Step 0: Donor details ── */}
              {step === 0 && (
                <div className="space-y-3 animate-in fade-in duration-200">
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
                    <p className="mt-1.5 pl-1 text-[11px] text-slate-400">
                      For your donation receipt and mandate confirmation
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 1: Bank details + mandate ── */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-200">
                  <p className="mb-3 text-xs text-slate-400">
                    Your IBAN is sent directly to Pay.nl and is not stored by Bayaan.
                  </p>

                  <div className="space-y-3">
                    {/* IBAN field */}
                    <div>
                      <div className="relative">
                        <FloatingLabelInput
                          id="iban"
                          label="IBAN"
                          type="text"
                          autoComplete="off"
                          spellCheck={false}
                          value={ibanRaw}
                          onChange={(e) => handleIbanChange(e.target.value)}
                          onBlur={handleIbanBlur}
                          className={cn(
                            'pr-16',
                            showIbanSuccess &&
                              'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/10',
                            showIbanError &&
                              'border-red-400 focus:border-red-400 focus:ring-red-400/10',
                          )}
                          required
                        />
                        {/* Right-side indicator: bank logo + check, or error icon */}
                        {ibanTouched && ibanRaw.trim().length > 0 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {ibanValidation.valid ? (
                              <>
                                {ibanValidation.bankIssuerId ? (
                                  <Image
                                    src={`/images/paynl/issuers/${ibanValidation.bankIssuerId}.svg`}
                                    alt={ibanValidation.bankName || ''}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 rounded"
                                  />
                                ) : ibanValidation.bankName ? (
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {ibanValidation.bankName}
                                  </span>
                                ) : null}
                                <IconCheck className="h-5 w-5 text-emerald-500" />
                              </>
                            ) : (
                              <IconAlertCircle className="h-5 w-5 text-red-400" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* IBAN error message */}
                      {showIbanError && ibanValidation.error && (
                        <p className="mt-1.5 pl-1 text-xs text-red-500">{ibanValidation.error}</p>
                      )}
                    </div>

                    {/* Account holder */}
                    <FloatingLabelInput
                      id="iban_owner"
                      label="Name on bank account"
                      type="text"
                      autoComplete="name"
                      value={ibanOwner}
                      onChange={(e) => setIbanOwner(e.target.value)}
                      required
                    />
                  </div>

                  {/* SEPA mandate agreement */}
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={agreedToMandate}
                        onChange={(e) => setAgreedToMandate(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        I authorise this SEPA Direct Debit mandate for{' '}
                        {displayAmount || 'the selected amount'}/month to{' '}
                        <strong>{orgName}</strong>.
                      </span>
                    </label>
                    <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      By signing this mandate, you authorise <strong>{orgName}</strong> to
                      send instructions to your bank to debit your account, and your bank
                      to debit your account in accordance with those instructions. You are
                      entitled to a refund within 8 weeks from the date of any debit.
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {errorMessage && (
                <div
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}
            </section>
          </div>
        </div>
        {/* /scrollable area */}
        </div>

        {/* CTA bar — flex-shrink-0 sibling, naturally pinned to bottom of viewport */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] dark:border-slate-800 dark:bg-black">
          <div className="mx-auto max-w-lg">
            {step === 0 ? (
              <button
                type="button"
                onClick={handleContinue}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all sm:h-14 sm:text-base',
                  'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]',
                  'dark:bg-emerald-500 dark:hover:bg-emerald-600',
                )}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all sm:h-14 sm:text-base',
                  'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]',
                  'dark:bg-emerald-500 dark:hover:bg-emerald-600',
                  'disabled:pointer-events-none disabled:opacity-60',
                )}
              >
                {submitting ? <IconLoader2 className="h-5 w-5 animate-spin" /> : ctaLabel}
              </button>
            )}
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <IconLock className="h-3.5 w-3.5" />
              <span>Secure payment via Pay.nl &middot; SEPA Direct Debit</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
