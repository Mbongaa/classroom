'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Building2,
  Users,
  FileCheck2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface OrganizationProp {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
  contact_email: string | null;
  contact_phone: string | null;
  bank_iban: string | null;
  bank_account_holder: string | null;
  legal_form: string | null;
  mcc: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  website_url: string | null;
  business_description: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
}

const LEGAL_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'eenmanszaak', label: 'Eenmanszaak' },
  { value: 'vof', label: 'VOF' },
  { value: 'maatschap', label: 'Maatschap' },
  { value: 'bv', label: 'Besloten Vennootschap (BV)' },
  { value: 'nv', label: 'Naamloze Vennootschap (NV)' },
  { value: 'stichting', label: 'Stichting' },
  { value: 'vereniging', label: 'Vereniging' },
  { value: 'cooperatie', label: 'Coöperatie' },
  { value: 'other', label: 'Other' },
];

const UBO_REQUIRED_FORMS = new Set([
  'vof',
  'maatschap',
  'bv',
  'nv',
  'stichting',
  'vereniging',
  'cooperatie',
]);

interface PersonFormState {
  clientRef: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  isSignee: boolean;
  isUbo: boolean;
  uboPercentage: string;
}

function emptyPerson(country: string): PersonFormState {
  return {
    clientRef: crypto.randomUUID(),
    fullName: '',
    dateOfBirth: '',
    nationality: country,
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    country,
    isSignee: true,
    isUbo: false,
    uboPercentage: '',
  };
}

const STEPS = [
  { key: 'mosque', label: 'Mosque details', icon: Building2 },
  { key: 'persons', label: 'Signees & UBOs', icon: Users },
  { key: 'review', label: 'Review & submit', icon: FileCheck2 },
] as const;

export function OnboardingWizard({ organization }: { organization: OrganizationProp }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    legalName: organization.name,
    tradingName: organization.name,
    legalForm: organization.legal_form || 'stichting',
    mcc: organization.mcc || '8398',
    kvkNumber: organization.kvk_number || '',
    vatNumber: organization.vat_number || '',
    contactEmail: organization.contact_email || '',
    contactPhone: organization.contact_phone || '',
    iban: organization.bank_iban || '',
    ibanOwner: organization.bank_account_holder || organization.name,
    street: organization.address_street || '',
    houseNumber: organization.address_house_number || '',
    postalCode: organization.address_postal_code || '',
    city: organization.city || '',
    country: organization.country || 'NL',
    businessDescription: organization.business_description || organization.description || '',
    websiteUrl: organization.website_url || '',
  });

  const [persons, setPersons] = useState<PersonFormState[]>([
    emptyPerson(organization.country || 'NL'),
  ]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePerson(index: number, patch: Partial<PersonFormState>) {
    setPersons((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPerson() {
    setPersons((prev) => [...prev, emptyPerson(form.country || 'NL')]);
  }

  function removePerson(index: number) {
    setPersons((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validateMosqueStep(): string | null {
    const required: Array<[string, string]> = [
      [form.legalName, 'Legal name'],
      [form.tradingName, 'Trading name'],
      [form.kvkNumber, 'KvK number'],
      [form.mcc, 'MCC'],
      [form.contactEmail, 'Contact email'],
      [form.iban, 'IBAN'],
      [form.ibanOwner, 'IBAN holder'],
      [form.street, 'Street'],
      [form.houseNumber, 'House number'],
      [form.postalCode, 'Postal code'],
      [form.city, 'City'],
      [form.country, 'Country'],
      [form.businessDescription, 'Description'],
    ];
    for (const [val, label] of required) {
      if (!val || val.trim() === '') return `${label} is required.`;
    }
    return null;
  }

  function validatePersonsStep(): string | null {
    if (persons.length === 0) return 'At least one person is required.';
    for (let i = 0; i < persons.length; i++) {
      const p = persons[i];
      const missing: string[] = [];
      if (!p.fullName) missing.push('full name');
      if (!p.dateOfBirth) missing.push('date of birth');
      if (!p.nationality) missing.push('nationality');
      if (!p.street) missing.push('street');
      if (!p.houseNumber) missing.push('house number');
      if (!p.postalCode) missing.push('postal code');
      if (!p.city) missing.push('city');
      if (!p.country) missing.push('country');
      if (missing.length > 0) {
        return `Person ${i + 1}: ${missing.join(', ')} required.`;
      }
      if (p.isUbo && p.uboPercentage && Number(p.uboPercentage) <= 0) {
        return `Person ${i + 1}: UBO percentage must be greater than zero.`;
      }
    }
    if (!persons.some((p) => p.isSignee)) {
      return 'At least one person must be marked as a signee.';
    }
    if (UBO_REQUIRED_FORMS.has(form.legalForm) && !persons.some((p) => p.isUbo)) {
      return `Legal form "${form.legalForm}" requires at least one UBO.`;
    }
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 0) {
      const err = validateMosqueStep();
      if (err) {
        setError(err);
        return;
      }
    }
    if (step === 1) {
      const err = validatePersonsStep();
      if (err) {
        setError(err);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    const mosqueErr = validateMosqueStep();
    if (mosqueErr) {
      setStep(0);
      setError(mosqueErr);
      return;
    }
    const personsErr = validatePersonsStep();
    if (personsErr) {
      setStep(1);
      setError(personsErr);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        legalName: form.legalName,
        tradingName: form.tradingName,
        legalForm: form.legalForm,
        mcc: form.mcc,
        kvkNumber: form.kvkNumber,
        vatNumber: form.vatNumber || undefined,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        iban: form.iban,
        ibanOwner: form.ibanOwner,
        address: {
          street: form.street,
          houseNumber: form.houseNumber,
          postalCode: form.postalCode,
          city: form.city,
          country: form.country,
        },
        businessDescription: form.businessDescription,
        websiteUrl: form.websiteUrl || undefined,
        persons: persons.map((p) => ({
          clientRef: p.clientRef,
          fullName: p.fullName,
          dateOfBirth: p.dateOfBirth,
          nationality: p.nationality,
          email: p.email || undefined,
          phone: p.phone || undefined,
          address: {
            street: p.street,
            houseNumber: p.houseNumber,
            postalCode: p.postalCode,
            city: p.city,
            country: p.country,
          },
          isSignee: p.isSignee,
          isUbo: p.isUbo,
          uboPercentage: p.isUbo && p.uboPercentage ? Number(p.uboPercentage) : undefined,
        })),
      };

      const res = await fetch(`/api/organizations/${organization.id}/merchant/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      toast.success('Application submitted to Pay.nl');
      router.push(`/mosque-admin/${organization.slug}/settings`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(128,128,128,0.3)] bg-white/95 px-4 py-4 backdrop-blur dark:bg-black/95 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Payment setup
            </p>
            <h1 className="text-lg font-semibold text-black dark:text-white">
              {organization.name}
            </h1>
          </div>
          <Link
            href={`/mosque-admin/${organization.slug}`}
            className="rounded-md p-2 text-gray-600 hover:bg-zinc-100 hover:text-black dark:text-gray-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            aria-label="Close and return to dashboard"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <Stepper currentStep={step} />

        <div className="mt-10 rounded-xl border border-[rgba(128,128,128,0.3)] bg-white p-6 dark:bg-black sm:p-8">
          {step === 0 && (
            <MosqueStep form={form} updateField={updateField} />
          )}
          {step === 1 && (
            <PersonsStep
              persons={persons}
              legalForm={form.legalForm}
              onUpdate={updatePerson}
              onAdd={addPerson}
              onRemove={removePerson}
            />
          )}
          {step === 2 && <ReviewStep form={form} persons={persons} />}

          {error && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting} className="min-w-[180px]">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit to Pay.nl'}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Your information is sent to Pay.nl for KYC verification. You can review and
          edit the submitted data later in settings.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper indicator
// ---------------------------------------------------------------------------

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center justify-between gap-2 sm:gap-4">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isComplete = i < currentStep;
        const isActive = i === currentStep;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isComplete && 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black',
                isActive && 'border-black bg-background text-black dark:border-white dark:text-white',
                !isComplete && !isActive && 'border-slate-300 bg-background text-slate-400 dark:border-slate-700',
              )}
            >
              {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
            <div className="hidden flex-1 sm:block">
              <p
                className={cn(
                  'text-sm font-medium',
                  isActive && 'text-slate-900 dark:text-slate-100',
                  !isActive && 'text-slate-500 dark:text-slate-400',
                )}
              >
                {s.label}
              </p>
              <p className="text-xs text-slate-400">Step {i + 1}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'hidden h-0.5 flex-1 sm:block',
                  isComplete ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Mosque details
// ---------------------------------------------------------------------------

interface MosqueStepProps {
  form: {
    legalName: string;
    tradingName: string;
    legalForm: string;
    mcc: string;
    kvkNumber: string;
    vatNumber: string;
    contactEmail: string;
    contactPhone: string;
    iban: string;
    ibanOwner: string;
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
    businessDescription: string;
    websiteUrl: string;
  };
  updateField: (field: keyof MosqueStepProps['form'], value: string) => void;
}

function MosqueStep({ form, updateField }: MosqueStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Mosque details</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Details about your organization. This matches what is registered with the Chamber
          of Commerce (KvK).
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Business
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingLabelInput
            id="legalName"
            label="Legal name"
            value={form.legalName}
            onChange={(e) => updateField('legalName', e.target.value)}
          />
          <FloatingLabelInput
            id="tradingName"
            label="Trading name"
            value={form.tradingName}
            onChange={(e) => updateField('tradingName', e.target.value)}
          />
          <FloatingLabelInput
            id="kvkNumber"
            label="KvK number"
            value={form.kvkNumber}
            onChange={(e) =>
              updateField('kvkNumber', e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            maxLength={8}
          />
          <FloatingLabelInput
            id="vatNumber"
            label="VAT number (optional)"
            value={form.vatNumber}
            onChange={(e) => updateField('vatNumber', e.target.value)}
          />
          <div className="space-y-2">
            <Label htmlFor="legalForm">Legal form</Label>
            <Select
              value={form.legalForm}
              onValueChange={(value) => updateField('legalForm', value)}
            >
              <SelectTrigger id="legalForm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_FORM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <FloatingLabelInput
              id="mcc"
              label="MCC (category code)"
              value={form.mcc}
              onChange={(e) => updateField('mcc', e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              8398 = charitable organizations · 8661 = religious organizations
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="businessDescription">What does your mosque do?</Label>
          <Textarea
            id="businessDescription"
            value={form.businessDescription}
            onChange={(e) => updateField('businessDescription', e.target.value)}
            placeholder="Briefly describe the mosque's activities and how donations are used"
            rows={3}
          />
        </div>
        <div className="mt-4">
          <FloatingLabelInput
            id="websiteUrl"
            label="Website (optional)"
            type="url"
            value={form.websiteUrl}
            onChange={(e) => updateField('websiteUrl', e.target.value)}
          />
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Contact
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingLabelInput
            id="contactEmail"
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => updateField('contactEmail', e.target.value)}
          />
          <FloatingLabelInput
            id="contactPhone"
            label="Phone (optional)"
            type="tel"
            value={form.contactPhone}
            onChange={(e) => updateField('contactPhone', e.target.value)}
          />
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Registered address
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingLabelInput
            id="street"
            label="Street"
            value={form.street}
            onChange={(e) => updateField('street', e.target.value)}
          />
          <FloatingLabelInput
            id="houseNumber"
            label="House number"
            value={form.houseNumber}
            onChange={(e) => updateField('houseNumber', e.target.value)}
          />
          <FloatingLabelInput
            id="postalCode"
            label="Postal code"
            value={form.postalCode}
            onChange={(e) => updateField('postalCode', e.target.value)}
          />
          <FloatingLabelInput
            id="city"
            label="City"
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
          />
          <FloatingLabelInput
            id="country"
            label="Country (ISO)"
            value={form.country}
            onChange={(e) =>
              updateField('country', e.target.value.toUpperCase().slice(0, 2))
            }
            maxLength={2}
          />
        </div>
      </section>

      <Separator />

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Bank account
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Payouts from Pay.nl go to this account. It must be registered to the mosque.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingLabelInput
            id="iban"
            label="IBAN"
            value={form.iban}
            onChange={(e) => updateField('iban', e.target.value.toUpperCase().replace(/\s/g, ''))}
          />
          <FloatingLabelInput
            id="ibanOwner"
            label="Account holder name"
            value={form.ibanOwner}
            onChange={(e) => updateField('ibanOwner', e.target.value)}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Signees & UBOs
// ---------------------------------------------------------------------------

interface PersonsStepProps {
  persons: PersonFormState[];
  legalForm: string;
  onUpdate: (index: number, patch: Partial<PersonFormState>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function PersonsStep({ persons, legalForm, onUpdate, onAdd, onRemove }: PersonsStepProps) {
  const uboRequired = UBO_REQUIRED_FORMS.has(legalForm);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Signees & UBOs</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          List the board members authorised to sign and — for a stichting or similar — the
          pseudo-UBOs (the whole board). At least one signee is required.
          {uboRequired && ' At least one UBO is required for your legal form.'}
        </p>
      </div>

      <div className="space-y-4">
        {persons.map((p, index) => (
          <div
            key={p.clientRef}
            className="rounded-lg border border-[rgba(128,128,128,0.3)] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Person {index + 1}</p>
              {persons.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove person ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FloatingLabelInput
                  id={`p-name-${index}`}
                  label="Full name"
                  value={p.fullName}
                  onChange={(e) => onUpdate(index, { fullName: e.target.value })}
                />
              </div>
              <FloatingLabelInput
                id={`p-dob-${index}`}
                label="Date of birth"
                type="date"
                value={p.dateOfBirth}
                onChange={(e) => onUpdate(index, { dateOfBirth: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-nat-${index}`}
                label="Nationality (ISO)"
                value={p.nationality}
                onChange={(e) =>
                  onUpdate(index, {
                    nationality: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                maxLength={2}
              />
              <FloatingLabelInput
                id={`p-email-${index}`}
                label="Email (optional)"
                type="email"
                value={p.email}
                onChange={(e) => onUpdate(index, { email: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-phone-${index}`}
                label="Phone (optional)"
                type="tel"
                value={p.phone}
                onChange={(e) => onUpdate(index, { phone: e.target.value })}
              />

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Home address
                </p>
              </div>
              <FloatingLabelInput
                id={`p-street-${index}`}
                label="Street"
                value={p.street}
                onChange={(e) => onUpdate(index, { street: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-hnum-${index}`}
                label="House number"
                value={p.houseNumber}
                onChange={(e) => onUpdate(index, { houseNumber: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-postal-${index}`}
                label="Postal code"
                value={p.postalCode}
                onChange={(e) => onUpdate(index, { postalCode: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-city-${index}`}
                label="City"
                value={p.city}
                onChange={(e) => onUpdate(index, { city: e.target.value })}
              />
              <FloatingLabelInput
                id={`p-country-${index}`}
                label="Country (ISO)"
                value={p.country}
                onChange={(e) =>
                  onUpdate(index, {
                    country: e.target.value.toUpperCase().slice(0, 2),
                  })
                }
                maxLength={2}
              />

              <div className="sm:col-span-2 mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={p.isSignee}
                    onChange={(e) => onUpdate(index, { isSignee: e.target.checked })}
                  />
                  Signee
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={p.isUbo}
                    onChange={(e) =>
                      onUpdate(index, {
                        isUbo: e.target.checked,
                        uboPercentage: e.target.checked ? p.uboPercentage : '',
                      })
                    }
                  />
                  UBO / pseudo-UBO
                </label>
                {p.isUbo && (
                  <FloatingLabelInput
                    id={`p-ubo-pct-${index}`}
                    label="Ownership %"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={p.uboPercentage}
                    onChange={(e) => onUpdate(index, { uboPercentage: e.target.value })}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={onAdd} className="w-full sm:w-auto">
        <Plus className="mr-1 h-4 w-4" /> Add another person
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Review
// ---------------------------------------------------------------------------

function ReviewStep({
  form,
  persons,
}: {
  form: MosqueStepProps['form'];
  persons: PersonFormState[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Review & submit</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Double-check everything before sending it to Pay.nl. You can edit any of this
          later in settings, but resubmitting means a fresh KYC review.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Mosque
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Legal name" value={form.legalName} />
          <Row label="Trading name" value={form.tradingName} />
          <Row label="Legal form" value={form.legalForm} />
          <Row label="MCC" value={form.mcc} />
          <Row label="KvK" value={form.kvkNumber} />
          <Row label="VAT" value={form.vatNumber || '—'} />
          <Row label="Email" value={form.contactEmail} />
          <Row label="Phone" value={form.contactPhone || '—'} />
          <Row label="Website" value={form.websiteUrl || '—'} />
          <Row
            label="Address"
            value={`${form.street} ${form.houseNumber}, ${form.postalCode} ${form.city}, ${form.country}`}
          />
          <Row label="IBAN" value={form.iban} />
          <Row label="Account holder" value={form.ibanOwner} />
        </dl>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Description
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {form.businessDescription}
          </p>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Persons ({persons.length})
        </h3>
        <ul className="space-y-3">
          {persons.map((p, i) => (
            <li
              key={p.clientRef}
              className="rounded-md border border-[rgba(128,128,128,0.3)] p-3"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {p.fullName || `Person ${i + 1}`}
                </p>
                <div className="flex gap-2 text-xs">
                  {p.isSignee && (
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Signee
                    </span>
                  )}
                  {p.isUbo && (
                    <span className="rounded-full bg-black px-2 py-0.5 text-white dark:bg-white dark:text-black">
                      UBO{p.uboPercentage ? ` · ${p.uboPercentage}%` : ' · pseudo'}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                DOB {p.dateOfBirth || '—'} · {p.nationality || '—'} · {p.city || '—'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-md border border-[rgba(128,128,128,0.3)] bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <p className="font-medium text-black dark:text-white">What happens next?</p>
        <p className="mt-1">
          Pay.nl will review your application and may request documents (KvK extract,
          ID copies, bank statement). You&apos;ll be notified in the dashboard when
          documents are requested or when your mosque is approved to receive donations.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
