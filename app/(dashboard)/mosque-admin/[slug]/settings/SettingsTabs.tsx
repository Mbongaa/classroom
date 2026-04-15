'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThankYouAnimationPlayer } from '@/components/thankyou-animation';
import {
  DEFAULT_THANK_YOU_ANIMATION_ID,
  groupAnimationsByCategory,
  type ThankYouAnimation,
} from '@/lib/thankyou-animations';
import { IconExternalLink } from '@tabler/icons-react';
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Plus,
  Trash2,
  Upload,
  FileCheck2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { locales, localeLabels, type Locale } from '@/i18n/config';
import { updateOrganizationLocale } from '@/lib/actions/auth';

/**
 * Organization settings tabs.
 *
 * Three tabs:
 *   - General — read-only org info
 *   - Payments — gated merchant onboarding / finance status
 *   - Thank-you animation — picker grid
 *
 * The Payments tab shows different views based on KYC lifecycle:
 *   - pending (no merchant_id)  → onboarding form
 *   - submitted                 → waiting/status screen
 *   - rejected                  → rejection notice + re-submit info
 *   - approved                  → merchant status card with finance links
 */

interface OrganizationPerson {
  id: string;
  full_name: string;
  is_signee: boolean;
  is_ubo: boolean;
  paynl_license_code: string | null;
}

interface OrganizationKycDocument {
  id: string;
  doc_type: string;
  person_id: string | null;
  paynl_document_code: string | null;
  paynl_required: boolean;
  translations: Record<string, { name?: string; description?: string }> | null;
  status: 'requested' | 'uploaded' | 'forwarded' | 'accepted' | 'rejected';
  uploaded_at: string | null;
}

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
  thankyou_animation_id: string | null;
  paynl_merchant_id: string | null;
  paynl_service_id: string | null;
  paynl_boarding_status: 'REGISTERED' | 'ONBOARDING' | 'ACCEPTED' | 'SUSPENDED' | 'OFFBOARDED' | null;
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  donations_active: boolean;
  onboarded_at: string | null;
  platform_fee_bps: number;
  // KYC-related (populated after _03 + _415 migrations)
  legal_form: string | null;
  mcc: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  website_url: string | null;
  business_description: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  preferred_locale: 'en' | 'ar' | 'nl' | 'fr' | 'de';
  persons: OrganizationPerson[];
  kyc_documents: OrganizationKycDocument[];
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

/**
 * Human labels for the document `doc_type` classifications Pay.nl emits.
 * Only used as a fallback when Pay.nl's `translations` field is empty — the
 * canonical label/description comes from DB (translations column, populated
 * by /v2/merchants/{code}/info).
 */
const DOC_TYPE_FALLBACK_LABELS: Record<string, { label: string; description: string }> = {
  kvk_extract: {
    label: 'KvK extract',
    description: 'Recent Chamber of Commerce extract',
  },
  coc_extract: {
    label: 'Chamber of Commerce extract',
    description: 'Recent (≤6 months) extract of business registration',
  },
  ubo_extract: {
    label: 'UBO register extract',
    description: 'From KvK — ultimate beneficial owner declaration',
  },
  bank_statement: {
    label: 'Bank statement',
    description: 'Recent statement showing IBAN + company name',
  },
  id_front: {
    label: 'ID — front',
    description: 'Front of a valid passport / ID card',
  },
  id_back: {
    label: 'ID — back',
    description: 'Back of the ID (not needed for passports)',
  },
  passport: {
    label: 'Passport',
    description: 'Full passport page with photo',
  },
  power_of_attorney: {
    label: 'Power of attorney',
    description: 'If signing on behalf of the legal representative',
  },
  other: {
    label: 'Other document',
    description: '',
  },
};

function resolveDocLabel(
  doc: Pick<OrganizationKycDocument, 'doc_type' | 'translations'>,
  locale: string,
): { label: string; description: string } {
  const t = doc.translations?.[locale] ?? doc.translations?.en;
  const fallback =
    DOC_TYPE_FALLBACK_LABELS[doc.doc_type] ??
    { label: doc.doc_type, description: '' };
  return {
    label: t?.name ?? fallback.label,
    description: t?.description ?? fallback.description,
  };
}

interface SettingsTabsProps {
  organization: OrganizationProp;
}

export function SettingsTabs({ organization }: SettingsTabsProps) {
  const t = useTranslations('mosqueAdmin.settings');
  return (
    <Tabs defaultValue="payments" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
        <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
        <TabsTrigger value="animation">{t('tabs.animation')}</TabsTrigger>
        <TabsTrigger value="language">{t('tabs.language')}</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralPanel organization={organization} />
      </TabsContent>

      <TabsContent value="payments">
        <PaymentsPanel organization={organization} />
      </TabsContent>

      <TabsContent value="animation">
        <AnimationPanel organization={organization} />
      </TabsContent>

      <TabsContent value="language">
        <LanguagePanel organization={organization} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Payments tab — gated by KYC status
// ---------------------------------------------------------------------------

function PaymentsPanel({ organization }: { organization: OrganizationProp }) {
  const [kycStatus, setKycStatus] = useState(organization.kyc_status);
  const [merchantId, setMerchantId] = useState(organization.paynl_merchant_id);
  const [serviceId, setServiceId] = useState(organization.paynl_service_id);
  const [donationsActive, setDonationsActive] = useState(organization.donations_active);

  // After successful onboard submission, switch to the submitted view
  const handleOnboardSuccess = useCallback(
    (result: { merchantId: string; serviceId: string; kycStatus: string }) => {
      setMerchantId(result.merchantId);
      setServiceId(result.serviceId);
      setKycStatus(result.kycStatus as OrganizationProp['kyc_status']);
      if (result.kycStatus === 'approved') {
        setDonationsActive(true);
      }
    },
    [],
  );

  // Refresh status from Pay.nl
  const handleStatusRefresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organization.id}/merchant/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.kycStatus) setKycStatus(data.kycStatus);
      if (data.merchantId) setMerchantId(data.merchantId);
      if (data.serviceId) setServiceId(data.serviceId);
      if (data.donationsActive !== undefined) setDonationsActive(data.donationsActive);
    } catch {
      // silent — the UI already shows current state
    }
  }, [organization.id]);

  // No merchant yet → show onboarding form
  if (!merchantId) {
    return <OnboardingForm organization={organization} onSuccess={handleOnboardSuccess} />;
  }

  // Rejected → rejection notice
  if (kycStatus === 'rejected') {
    return <KycRejectedCard onRefresh={handleStatusRefresh} />;
  }

  // Approved → merchant status + finance links
  if (kycStatus === 'approved') {
    return (
      <MerchantStatusCard
        organization={organization}
        merchantId={merchantId}
        serviceId={serviceId}
        donationsActive={donationsActive}
        onRefresh={handleStatusRefresh}
      />
    );
  }

  // Default (submitted OR pending-with-merchant) → waiting screen +
  // documents panel so the admin can finish uploading KYC files.
  return (
    <div className="space-y-4">
      <KycPendingCard onRefresh={handleStatusRefresh} />
      <DocumentsPanel organization={organization} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding form — collects KYC data and submits to the onboard endpoint
// ---------------------------------------------------------------------------

interface OnboardingFormProps {
  organization: OrganizationProp;
  onSuccess: (result: { merchantId: string; serviceId: string; kycStatus: string }) => void;
}

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

function OnboardingForm({ organization, onSuccess }: OnboardingFormProps) {
  const t = useTranslations('mosqueAdmin.settings.onboarding');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from org data where available
  const [form, setForm] = useState({
    legalName: organization.name,
    tradingName: organization.name,
    legalForm: organization.legal_form || 'stichting',
    mcc: organization.mcc || '8398', // 8398 = Charitable/Social Service Organizations
    kvkNumber: organization.kvk_number || '',
    vatNumber: organization.vat_number || '',
    contactEmail: organization.contact_email || '',
    contactPhone: organization.contact_phone || '',
    iban: organization.bank_iban || '',
    ibanOwner: organization.bank_account_holder || '',
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

  function updateField(field: string, value: string) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Client-side UBO + signee checks — server re-validates but the
      // message is friendlier here.
      const hasSignee = persons.some((p) => p.isSignee);
      if (!hasSignee) {
        throw new Error('At least one person must be marked as a signee.');
      }
      if (UBO_REQUIRED_FORMS.has(form.legalForm)) {
        const hasUbo = persons.some((p) => p.isUbo);
        if (!hasUbo) {
          throw new Error(
            `Legal form "${form.legalForm}" requires at least one UBO (≥25% ownership).`,
          );
        }
      }

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
          uboPercentage: p.isUbo ? Number(p.uboPercentage) : undefined,
        })),
      };

      const res = await fetch(`/api/organizations/${organization.id}/merchant/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('errors.submitFailed'));
      }

      toast.success(t('toastSuccess'));
      onSuccess(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.somethingWrong');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription>
              {t('description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business details */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('businessDetails')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legalName">{t('legalName')}</Label>
                <Input
                  id="legalName"
                  value={form.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradingName">{t('tradingName')}</Label>
                <Input
                  id="tradingName"
                  value={form.tradingName}
                  onChange={(e) => updateField('tradingName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kvkNumber">{t('kvkNumber')}</Label>
                <Input
                  id="kvkNumber"
                  value={form.kvkNumber}
                  onChange={(e) => updateField('kvkNumber', e.target.value)}
                  placeholder={t('kvkPlaceholder')}
                  maxLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">{t('vatNumber')}</Label>
                <Input
                  id="vatNumber"
                  value={form.vatNumber}
                  onChange={(e) => updateField('vatNumber', e.target.value)}
                  placeholder={t('vatPlaceholder')}
                />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="mcc">MCC (merchant category code)</Label>
                <Input
                  id="mcc"
                  value={form.mcc}
                  onChange={(e) => updateField('mcc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="8398"
                  maxLength={4}
                  required
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="businessDescription">
                {t('businessDescription')}
              </Label>
              <Textarea
                id="businessDescription"
                value={form.businessDescription}
                onChange={(e) => updateField('businessDescription', e.target.value)}
                placeholder={t('businessDescriptionPlaceholder')}
                rows={3}
                required
              />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="websiteUrl">{t('website')}</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={form.websiteUrl}
                onChange={(e) => updateField('websiteUrl', e.target.value)}
                placeholder={t('websitePlaceholder')}
              />
            </div>
          </section>

          <Separator />

          {/* Contact information */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('contactInformation')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">{t('contactPhone')}</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  placeholder={t('contactPhonePlaceholder')}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Address */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('registeredAddress')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="street">{t('street')}</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={(e) => updateField('street', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="houseNumber">{t('houseNumber')}</Label>
                <Input
                  id="houseNumber"
                  value={form.houseNumber}
                  onChange={(e) => updateField('houseNumber', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">{t('postalCode')}</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder={t('postalPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t('city')}</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t('country')}</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  placeholder={t('countryPlaceholder')}
                  maxLength={2}
                  required
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Bank account */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('bankAccount')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iban">{t('iban')}</Label>
                <Input
                  id="iban"
                  value={form.iban}
                  onChange={(e) => updateField('iban', e.target.value)}
                  placeholder={t('ibanPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibanOwner">{t('ibanOwner')}</Label>
                <Input
                  id="ibanOwner"
                  value={form.ibanOwner}
                  onChange={(e) => updateField('ibanOwner', e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Signees + UBOs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Signees &amp; UBOs
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  At least one signee is required. For VOF, BV, stichting, vereniging or
                  coöperatie, every Ultimate Beneficial Owner (≥25% ownership) must also be
                  listed.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPerson}>
                <Plus className="mr-1 h-4 w-4" /> Add person
              </Button>
            </div>
            <div className="space-y-6">
              {persons.map((p, index) => (
                <div
                  key={p.clientRef}
                  className="rounded-lg border border-[rgba(128,128,128,0.3)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Person {index + 1}</p>
                    {persons.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePerson(index)}
                        aria-label={`Remove person ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`p-name-${index}`}>Full name</Label>
                      <Input
                        id={`p-name-${index}`}
                        value={p.fullName}
                        onChange={(e) => updatePerson(index, { fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-dob-${index}`}>Date of birth</Label>
                      <Input
                        id={`p-dob-${index}`}
                        type="date"
                        value={p.dateOfBirth}
                        onChange={(e) => updatePerson(index, { dateOfBirth: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-nat-${index}`}>Nationality (ISO)</Label>
                      <Input
                        id={`p-nat-${index}`}
                        value={p.nationality}
                        onChange={(e) =>
                          updatePerson(index, {
                            nationality: e.target.value.toUpperCase().slice(0, 2),
                          })
                        }
                        maxLength={2}
                        placeholder="NL"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-email-${index}`}>Email</Label>
                      <Input
                        id={`p-email-${index}`}
                        type="email"
                        value={p.email}
                        onChange={(e) => updatePerson(index, { email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-phone-${index}`}>Phone</Label>
                      <Input
                        id={`p-phone-${index}`}
                        type="tel"
                        value={p.phone}
                        onChange={(e) => updatePerson(index, { phone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Home address
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-street-${index}`}>Street</Label>
                      <Input
                        id={`p-street-${index}`}
                        value={p.street}
                        onChange={(e) => updatePerson(index, { street: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-hnum-${index}`}>House number</Label>
                      <Input
                        id={`p-hnum-${index}`}
                        value={p.houseNumber}
                        onChange={(e) => updatePerson(index, { houseNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-postal-${index}`}>Postal code</Label>
                      <Input
                        id={`p-postal-${index}`}
                        value={p.postalCode}
                        onChange={(e) => updatePerson(index, { postalCode: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-city-${index}`}>City</Label>
                      <Input
                        id={`p-city-${index}`}
                        value={p.city}
                        onChange={(e) => updatePerson(index, { city: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`p-country-${index}`}>Country (ISO)</Label>
                      <Input
                        id={`p-country-${index}`}
                        value={p.country}
                        onChange={(e) =>
                          updatePerson(index, {
                            country: e.target.value.toUpperCase().slice(0, 2),
                          })
                        }
                        maxLength={2}
                        required
                      />
                    </div>

                    <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={p.isSignee}
                          onChange={(e) => updatePerson(index, { isSignee: e.target.checked })}
                        />
                        Signee (authorised to sign)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={p.isUbo}
                          onChange={(e) =>
                            updatePerson(index, {
                              isUbo: e.target.checked,
                              uboPercentage: e.target.checked ? p.uboPercentage : '',
                            })
                          }
                        />
                        UBO (≥25% ownership/control)
                      </label>
                      {p.isUbo && (
                        <div className="space-y-1">
                          <Label htmlFor={`p-ubo-pct-${index}`} className="text-xs">
                            UBO percentage
                          </Label>
                          <Input
                            id={`p-ubo-pct-${index}`}
                            type="number"
                            min={1}
                            max={100}
                            step="0.01"
                            value={p.uboPercentage}
                            onChange={(e) =>
                              updatePerson(index, { uboPercentage: e.target.value })
                            }
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="min-w-[180px]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KYC Pending — waiting for Pay.nl review
// ---------------------------------------------------------------------------

function KycPendingCard({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const t = useTranslations('mosqueAdmin.settings.kycPending');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success(t('refreshed'));
    } catch {
      toast.error(t('refreshError'));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t('title')}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {t('description')}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {refreshing ? t('checking') : t('checkStatus')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KYC Rejected — show rejection notice
// ---------------------------------------------------------------------------

function KycRejectedCard({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const t = useTranslations('mosqueAdmin.settings.kycRejected');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t('title')}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {t('description')}
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('recheck')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Documents panel — post-onboard KYC document uploads
//
// Shown while the merchant exists but KYC isn't approved yet. Each document
// type gets a row; required types are flagged. Uploads POST to
// /api/organizations/[id]/merchant/documents and optimistically append to
// the local list.
// ---------------------------------------------------------------------------

function DocumentsPanel({ organization }: { organization: OrganizationProp }) {
  const [docs, setDocs] = useState<OrganizationKycDocument[]>(organization.kyc_documents);
  const [submitting, setSubmitting] = useState(false);

  function handleUpdated(doc: OrganizationKycDocument) {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)));
  }

  const locale = organization.preferred_locale ?? 'en';

  // Group docs: org-scoped (no person_id) vs per-person.
  const orgDocs = docs.filter((d) => !d.person_id);
  const personDocs = docs.filter((d) => d.person_id);
  const docsByPerson = new Map<string, OrganizationKycDocument[]>();
  for (const d of personDocs) {
    if (!d.person_id) continue;
    const list = docsByPerson.get(d.person_id) ?? [];
    list.push(d);
    docsByPerson.set(d.person_id, list);
  }

  const outstandingRequired = docs.filter(
    (d) => d.paynl_required && d.status === 'requested',
  );
  const canSubmit =
    docs.length > 0 &&
    outstandingRequired.length === 0 &&
    organization.paynl_boarding_status !== 'ACCEPTED';

  async function handleSubmitForReview() {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organization.id}/merchant/submit-for-review`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      toast.success('Submitted to Pay.nl for review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg">KYC documents</CardTitle>
            <CardDescription>
              Pay.nl needs these before donations can go live. All files are private and
              forwarded directly to Pay.nl.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {docs.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pay.nl has not yet reported any required documents. This usually syncs
            automatically after onboarding. If this persists, refresh merchant status.
          </p>
        )}

        {orgDocs.map((d) => (
          <DocumentRow
            key={d.id}
            organizationId={organization.id}
            doc={d}
            locale={locale}
            onUpdated={handleUpdated}
          />
        ))}

        {organization.persons.length > 0 && personDocs.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Per-person documents
              </p>
              <div className="space-y-4">
                {organization.persons.map((person) => {
                  const rows = docsByPerson.get(person.id) ?? [];
                  if (rows.length === 0) return null;
                  return (
                    <div
                      key={person.id}
                      className="rounded-lg border border-[rgba(128,128,128,0.3)] p-4"
                    >
                      <p className="mb-3 text-sm font-medium">
                        {person.full_name}
                        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                          {[
                            person.is_signee ? 'signee' : null,
                            person.is_ubo ? 'UBO' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </p>
                      {rows.map((d) => (
                        <DocumentRow
                          key={d.id}
                          organizationId={organization.id}
                          doc={d}
                          locale={locale}
                          onUpdated={handleUpdated}
                          disabled={!person.paynl_license_code}
                          disabledReason="Waiting for Pay.nl to issue a license code for this person."
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {docs.length > 0 && (
          <div className="border-t border-[rgba(128,128,128,0.2)] pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Submit for review</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {outstandingRequired.length > 0
                    ? `${outstandingRequired.length} required document${outstandingRequired.length === 1 ? '' : 's'} still outstanding.`
                    : organization.paynl_boarding_status === 'ACCEPTED'
                      ? 'Pay.nl has already accepted this merchant.'
                      : 'All required documents are uploaded. Submit to Pay.nl Compliance.'}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleSubmitForReview}
                disabled={!canSubmit || submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit to Pay.nl
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({
  organizationId,
  doc,
  locale,
  onUpdated,
  disabled,
  disabledReason,
}: {
  organizationId: string;
  doc: OrganizationKycDocument;
  locale: string;
  onUpdated: (doc: OrganizationKycDocument) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [uploading, setUploading] = useState(false);

  const { label, description } = resolveDocLabel(doc, locale);
  const documentCode = doc.paynl_document_code;

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!documentCode) {
      toast.error('This document is missing its Pay.nl code — refresh merchant info.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('documentCode', documentCode);
      formData.append('file', file);

      const res = await fetch(
        `/api/organizations/${organizationId}/merchant/documents`,
        { method: 'POST', body: formData },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onUpdated({
        ...doc,
        status: data.status,
        uploaded_at: data.uploadedAt,
      });
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const hasUpload = doc.status !== 'requested';
  const inputId = `doc-${doc.id}`;
  const effectiveDisabled = disabled || !documentCode || doc.status === 'accepted';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[rgba(128,128,128,0.2)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {hasUpload ? (
          <FileCheck2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Upload className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
        )}
        <div>
          <p className="text-sm font-medium">
            {label}
            {doc.paynl_required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          )}
          <p className="mt-1 text-xs">
            Status: <span className="font-medium">{doc.status}</span>
          </p>
          {disabled && disabledReason && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{disabledReason}</p>
          )}
        </div>
      </div>
      <div>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={handleChange}
          disabled={uploading || effectiveDisabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || effectiveDisabled}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {doc.status === 'accepted' ? 'Accepted' : hasUpload ? 'Replace' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merchant Status — approved, show finance info + links
// ---------------------------------------------------------------------------

function MerchantStatusCard({
  organization,
  merchantId,
  serviceId,
  donationsActive,
  onRefresh,
}: {
  organization: OrganizationProp;
  merchantId: string | null;
  serviceId: string | null;
  donationsActive: boolean;
  onRefresh: () => Promise<void>;
}) {
  const t = useTranslations('mosqueAdmin.settings.merchantStatus');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh on mount to sync latest state
  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success(t('refreshed'));
    } catch {
      toast.error(t('refreshError'));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('title')}</CardTitle>
                <CardDescription>
                  {t('description')}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('statusLabel')}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={donationsActive ? 'default' : 'outline'}>
                  {donationsActive ? t('donationsActive') : t('donationsInactive')}
                </Badge>
              </div>
            </div>
            {merchantId && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('merchantId')}
                </p>
                <p className="mt-1 font-mono text-sm">{merchantId}</p>
              </div>
            )}
            {serviceId && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('serviceId')}
                </p>
                <p className="mt-1 font-mono text-sm">{serviceId}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('platformFee')}
              </p>
              <p className="mt-1 text-sm">
                {(organization.platform_fee_bps / 100).toFixed(2)}%
              </p>
            </div>
            {organization.onboarded_at && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('verifiedSince')}
                </p>
                <p className="mt-1 text-sm">
                  {new Date(organization.onboarded_at).toLocaleDateString('nl-NL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick links to finance pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('financeTitle')}</CardTitle>
          <CardDescription>{t('financeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href={`/mosque-admin/${organization.slug}/transactions`}
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">{t('transactionsTitle')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('transactionsDescription')}
              </p>
            </a>
            <a
              href={`/mosque-admin/${organization.slug}/campaigns`}
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">{t('campaignsTitle')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('campaignsDescription')}
              </p>
            </a>
            <a
              href={`/donate/${organization.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">{t('donatePageTitle')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('donatePageDescription')}
              </p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General tab — read-only org info for now
// ---------------------------------------------------------------------------

function GeneralPanel({ organization }: { organization: OrganizationProp }) {
  const t = useTranslations('mosqueAdmin.settings.general');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Field label={t('name')} value={organization.name} />
        <Field label={t('slug')} value={organization.slug} mono />
        <Field label={t('city')} value={organization.city || '—'} />
        <Field label={t('country')} value={organization.country} />
        <Field label={t('contactEmail')} value={organization.contact_email || '—'} />
        {organization.description && (
          <Field label={t('descriptionField')} value={organization.description} multiline />
        )}

        <div className="pt-2">
          <a
            href={`/donate/${organization.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            <IconExternalLink className="h-4 w-4" />
            {t('viewDonateLanding')}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={cn(
          'sm:col-span-2',
          mono && 'font-mono text-xs',
          multiline && 'whitespace-pre-wrap',
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation tab — picker grid
// ---------------------------------------------------------------------------

function AnimationPanel({ organization }: { organization: OrganizationProp }) {
  const t = useTranslations('mosqueAdmin.settings.animation');
  const [selectedId, setSelectedId] = useState<string>(
    organization.thankyou_animation_id || DEFAULT_THANK_YOU_ANIMATION_ID,
  );
  const [, startTransition] = useTransition();
  const groups = groupAnimationsByCategory();

  const categoryLabel = (category: ThankYouAnimation['category']) => {
    switch (category) {
      case 'celebration':
        return t('categories.celebration');
      case 'islamic':
        return t('categories.islamic');
      case 'charity':
        return t('categories.charity');
      default:
        return category;
    }
  };

  function handleSelect(animationId: string) {
    if (animationId === selectedId) return;

    const previous = selectedId;
    setSelectedId(animationId); // optimistic

    startTransition(async () => {
      try {
        const res = await fetch(`/api/organizations/${organization.id}/donation-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thankyou_animation_id: animationId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('updateFailed'));
        }
        toast.success(t('updated'));
      } catch (err) {
        setSelectedId(previous); // rollback
        toast.error(err instanceof Error ? err.message : t('saveFailed'));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {(Object.keys(groups) as Array<ThankYouAnimation['category']>).map((category) => {
          const items = groups[category];
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {categoryLabel(category)}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((anim) => {
                  const isSelected = anim.id === selectedId;
                  return (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => handleSelect(anim.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'group relative flex flex-col items-center rounded-lg border bg-white p-4 text-center transition-all hover:shadow-md dark:bg-black',
                        isSelected
                          ? 'border-black ring-2 ring-black/20 dark:border-white dark:ring-white/20'
                          : 'border-[rgba(128,128,128,0.3)]',
                      )}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white dark:bg-white dark:text-black">
                          {t('selected')}
                        </span>
                      )}
                      <ThankYouAnimationPlayer
                        kind="paid"
                        animationId={anim.id}
                        size={120}
                        loop
                      />
                      <p className="mt-2 text-sm font-medium">{anim.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {anim.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LanguagePanel({ organization }: { organization: OrganizationProp }) {
  const t = useTranslations('mosqueAdmin.settings.language');
  const [selected, setSelected] = useState<Locale>(organization.preferred_locale);
  const [isPending, startTransition] = useTransition();

  function handleChange(locale: Locale) {
    if (locale === selected) return;
    const previous = selected;
    setSelected(locale);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      const result = await updateOrganizationLocale(formData);
      if (result.success) {
        toast.success(t('updated'));
      } else {
        setSelected(previous);
        toast.error(result.error || t('updateFailed'));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Label htmlFor="preferred-locale">{t('selectLabel')}</Label>
          <Select
            value={selected}
            onValueChange={(value) => handleChange(value as Locale)}
            disabled={isPending}
          >
            <SelectTrigger id="preferred-locale" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {localeLabels[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
