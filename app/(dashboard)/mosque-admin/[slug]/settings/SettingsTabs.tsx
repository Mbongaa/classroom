'use client';
/* eslint-disable react/no-unescaped-entities */

import { useState, useTransition, useCallback, useEffect } from 'react';
import Link from 'next/link';
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
  birth_country: string | null;
  ubo_type: string | null;
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
  const [docs, setDocs] = useState<OrganizationKycDocument[]>(organization.kyc_documents);
  const [persons, setPersons] = useState<OrganizationPerson[]>(organization.persons);
  // True while the initial on-mount compliance check is in flight.
  const [isInitialChecking, setIsInitialChecking] = useState(!!organization.paynl_merchant_id);

  // Refresh status from Pay.nl — also refreshes docs and persons so new
  // Pay.nl requirements and license data become visible without page reload.
  const handleStatusRefresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organization.id}/merchant/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.kycStatus) setKycStatus(data.kycStatus);
      if (data.merchantId) setMerchantId(data.merchantId);
      if (data.serviceId) setServiceId(data.serviceId);
      if (data.donationsActive !== undefined) setDonationsActive(data.donationsActive);
      if (Array.isArray(data.documents)) setDocs(data.documents);
      if (Array.isArray(data.persons)) setPersons(data.persons);
    } catch {
      // silent — the UI already shows current state
    }
  }, [organization.id]);

  // Auto-check compliance on page load whenever a merchant exists.
  // This covers both the "under review" (submitted) and "approved" states so
  // admins always see live Pay.nl data without pressing a button first.
  useEffect(() => {
    if (!organization.paynl_merchant_id) return;
    handleStatusRefresh().finally(() => setIsInitialChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDocUpdated(doc: OrganizationKycDocument) {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)));
  }

  function handlePersonUpdated(person: OrganizationPerson) {
    setPersons((prev) => prev.map((p) => (p.id === person.id ? { ...p, ...person } : p)));
  }

  // No merchant yet → direct to the isolated onboarding wizard.
  if (!merchantId) {
    return <OnboardingCta slug={organization.slug} />;
  }

  // Rejected → rejection notice
  if (kycStatus === 'rejected') {
    return <KycRejectedCard onRefresh={handleStatusRefresh} />;
  }

  const hasOutstandingDocs = docs.some((d) => d.paynl_required && d.status === 'requested');
  const hasMissingPersonData = persons.some(
    (p) => p.paynl_license_code && !p.birth_country,
  );
  const showDocuments = hasOutstandingDocs || hasMissingPersonData;

  // Approved → merchant status + finance links.
  // Still show the documents panel if Pay.nl has outstanding requirements
  // (can happen when Pay.nl requests additional docs post-approval).
  if (kycStatus === 'approved') {
    return (
      <div className="space-y-4">
        <MerchantStatusCard
          organization={organization}
          merchantId={merchantId}
          serviceId={serviceId}
          donationsActive={donationsActive}
          onRefresh={handleStatusRefresh}
          isLoading={isInitialChecking}
        />
        {!isInitialChecking && showDocuments && (
          <DocumentsPanel
            organization={organization}
            docs={docs}
            persons={persons}
            onDocUpdated={handleDocUpdated}
            onPersonUpdated={handlePersonUpdated}
          />
        )}
      </div>
    );
  }

  // Default (submitted OR pending-with-merchant) → waiting screen +
  // documents panel so the admin can finish uploading KYC files.
  return (
    <div className="space-y-4">
      <KycPendingCard onRefresh={handleStatusRefresh} isLoading={isInitialChecking} />
      {!isInitialChecking && (
        <DocumentsPanel
          organization={organization}
          docs={docs}
          persons={persons}
          onDocUpdated={handleDocUpdated}
          onPersonUpdated={handlePersonUpdated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding CTA — links to the distraction-free wizard at /onboarding/[slug]
// ---------------------------------------------------------------------------

function OnboardingCta({ slug }: { slug: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Building2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Set up payments</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          Complete a short KYC flow — mosque details, signees &amp; UBOs, review.
          It takes a few minutes and opens in a focused setup screen.
        </p>
        <Link
          href={`/onboarding/${slug}`}
          className="mt-6 inline-flex items-center rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Start payment setup
        </Link>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Onboarding form — legacy inline form, superseded by /onboarding/[slug].
// Kept here for superadmin access until fully retired.
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

function KycPendingCard({
  onRefresh,
  isLoading,
}: {
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}) {
  const t = useTranslations('mosqueAdmin.settings.kycPending');
  const [refreshing, setRefreshing] = useState(false);
  const busy = isLoading || refreshing;

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
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 dark:text-amber-400" />
          ) : (
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t('title')}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {busy ? t('checking') : t('description')}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={handleRefresh}
          disabled={busy}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? t('checking') : t('checkStatus')}
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

function DocumentsPanel({
  organization,
  docs,
  persons,
  onDocUpdated,
  onPersonUpdated,
}: {
  organization: OrganizationProp;
  docs: OrganizationKycDocument[];
  persons: OrganizationPerson[];
  onDocUpdated: (doc: OrganizationKycDocument) => void;
  onPersonUpdated: (person: OrganizationPerson) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const locale = organization.preferred_locale ?? 'en';

  // Group docs: org-scoped (no person_id) vs per-person.
  const orgDocs = docs.filter((d) => !d.person_id);
  const docsByPerson = new Map<string, OrganizationKycDocument[]>();
  for (const d of docs) {
    if (!d.person_id) continue;
    const list = docsByPerson.get(d.person_id) ?? [];
    list.push(d);
    docsByPerson.set(d.person_id, list);
  }

  // Show per-person section for persons that have a license code AND either
  // have documents OR are missing birth_country (compliance data field).
  const personsWithCompliance = persons.filter(
    (p) => p.paynl_license_code && ((docsByPerson.get(p.id)?.length ?? 0) > 0 || !p.birth_country),
  );

  const outstandingRequired = docs.filter(
    (d) => d.paynl_required && d.status === 'requested',
  );
  const missingBirthCountry = persons.filter(
    (p) => p.paynl_license_code && !p.birth_country,
  );
  const canSubmit =
    docs.length > 0 &&
    outstandingRequired.length === 0 &&
    missingBirthCountry.length === 0 &&
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

  const hasAnything = docs.length > 0 || personsWithCompliance.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg">KYC compliance</CardTitle>
            <CardDescription>
              Pay.nl needs these before donations can go live. Files are private and
              forwarded directly to Pay.nl.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnything && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pay.nl has not yet reported any required documents. This usually syncs
            automatically after onboarding. If this persists, click Refresh Status.
          </p>
        )}

        {orgDocs.map((d) =>
          d.doc_type === 'agreement' ? (
            <AgreementSignRow
              key={d.id}
              organizationId={organization.id}
              doc={d}
              onUpdated={onDocUpdated}
            />
          ) : (
            <DocumentRow
              key={d.id}
              organizationId={organization.id}
              doc={d}
              locale={locale}
              onUpdated={onDocUpdated}
            />
          ),
        )}

        {personsWithCompliance.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Per-person compliance
              </p>
              <div className="space-y-4">
                {personsWithCompliance.map((person) => {
                  const rows = docsByPerson.get(person.id) ?? [];
                  return (
                    <div
                      key={person.id}
                      className="rounded-lg border border-[rgba(128,128,128,0.3)] p-4 space-y-3"
                    >
                      <p className="text-sm font-medium">
                        {person.full_name}
                        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                          {[
                            person.is_signee ? 'signee' : null,
                            person.is_ubo ? 'UBO' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {person.ubo_type && (
                          <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs">
                            {person.ubo_type}
                          </span>
                        )}
                      </p>

                      <BirthCountryField
                        organizationId={organization.id}
                        person={person}
                        onUpdated={onPersonUpdated}
                      />

                      {rows.map((d) => (
                        <DocumentRow
                          key={d.id}
                          organizationId={organization.id}
                          doc={d}
                          locale={locale}
                          onUpdated={onDocUpdated}
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

        {hasAnything && (
          <div className="border-t border-[rgba(128,128,128,0.2)] pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Submit for review</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {outstandingRequired.length > 0
                    ? `${outstandingRequired.length} required document${outstandingRequired.length === 1 ? '' : 's'} still outstanding.`
                    : missingBirthCountry.length > 0
                      ? `${missingBirthCountry.length} person${missingBirthCountry.length === 1 ? '' : 's'} missing birth country.`
                      : organization.paynl_boarding_status === 'ACCEPTED'
                        ? 'Pay.nl has already accepted this merchant.'
                        : 'All required information is complete. Submit to Pay.nl Compliance.'}
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

// Common EU/world countries relevant for Dutch mosque admins.
const COUNTRY_OPTIONS = [
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'TR', label: 'Turkey' },
  { value: 'MA', label: 'Morocco' },
  { value: 'IQ', label: 'Iraq' },
  { value: 'SY', label: 'Syria' },
  { value: 'AF', label: 'Afghanistan' },
  { value: 'SO', label: 'Somalia' },
  { value: 'ER', label: 'Eritrea' },
  { value: 'EG', label: 'Egypt' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'IN', label: 'India' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'SD', label: 'Sudan' },
  { value: 'SS', label: 'South Sudan' },
  { value: 'LY', label: 'Libya' },
  { value: 'TN', label: 'Tunisia' },
  { value: 'DZ', label: 'Algeria' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'YE', label: 'Yemen' },
  { value: 'OTHER', label: 'Other country' },
];

/**
 * Inline field for a person's country of birth. Shows current value (if set)
 * or a country selector (if not). Submits to PATCH /merchant/license.
 */
function BirthCountryField({
  organizationId,
  person,
  onUpdated,
}: {
  organizationId: string;
  person: OrganizationPerson;
  onUpdated: (person: OrganizationPerson) => void;
}) {
  const [editing, setEditing] = useState(!person.birth_country);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(person.birth_country ?? '');

  const countryLabel =
    COUNTRY_OPTIONS.find((c) => c.value === person.birth_country)?.label ??
    person.birth_country;

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/merchant/license`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id, birthCountry: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onUpdated({ ...person, birth_country: selected });
      setEditing(false);
      toast.success('Birth country saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!editing && person.birth_country) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[rgba(128,128,128,0.2)] p-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Country of birth
          </p>
          <p className="mt-0.5 text-sm font-medium">{countryLabel}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wider">
        Country of birth required
      </p>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select country…" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleSave} disabled={!selected || saving}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Save
        </Button>
        {person.birth_country && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agreement sign row — replaces the generic DocumentRow for doc_type=agreement
//
// Shows the pre-filled Sub-Merchant Services Agreement inline. The admin
// reviews it, types their name + title, checks "I have read…", and clicks
// Sign. A PDF is generated server-side and uploaded to Pay.nl automatically.
// ---------------------------------------------------------------------------

const AGREEMENT_SUMMARY_ITEMS = [
  'Cyberlife B.V. registers your organisation as a Pay.nl sub-merchant under the Bayaan platform.',
  'All payment processing and settlement is performed by Pay.nl (licensed by DNB). Cyberlife holds no client funds.',
  'A monthly platform fee of €39.99 (excl. VAT) is deducted automatically from your Pay.nl balance.',
  'You consent to Pay.nl performing KYC/AML checks and sharing the required compliance documents.',
  'Either party may terminate with 30 days\' written notice. Cyberlife may terminate immediately on material breach.',
  'Governed by Dutch law. Disputes are submitted to the competent court in the Netherlands.',
];

function AgreementSignRow({
  organizationId,
  doc,
  onUpdated,
}: {
  organizationId: string;
  doc: OrganizationKycDocument;
  onUpdated: (doc: OrganizationKycDocument) => void;
}) {
  const [expanded, setExpanded] = useState(doc.status === 'requested');
  const [signeeName, setSigneeName] = useState('');
  const [signeeTitle, setSigneeTitle] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const isSigned = doc.status !== 'requested';

  async function handleSign() {
    if (!signeeName.trim() || !signeeTitle.trim() || !agreed) return;
    setSigning(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/merchant/sign-agreement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentCode: doc.paynl_document_code,
          signeeName: signeeName.trim(),
          signeeTitle: signeeTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signing failed');
      onUpdated({ ...doc, status: data.status ?? 'uploaded', uploaded_at: data.uploadedAt ?? new Date().toISOString() });
      setExpanded(false);
      toast.success('Agreement signed and submitted to Pay.nl');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="rounded-md border border-[rgba(128,128,128,0.2)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 justify-between p-3">
        <div className="flex items-center gap-3">
          {isSigned ? (
            <FileCheck2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Upload className="h-5 w-5 flex-shrink-0 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium">
              Sub-Merchant Services Agreement
              <span className="ml-1 text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Required legal agreement — read and sign digitally. No upload needed.
            </p>
            <p className="mt-1 text-xs">
              Status:{' '}
              <span className="font-medium">
                {isSigned ? (doc.status === 'accepted' ? 'accepted by Pay.nl ✓' : 'signed & submitted') : 'signature required'}
              </span>
            </p>
          </div>
        </div>
        {!isSigned && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Collapse' : 'Review & Sign'}
          </Button>
        )}
      </div>

      {/* Expanded agreement + signature form */}
      {expanded && !isSigned && (
        <div className="border-t border-[rgba(128,128,128,0.2)] p-4 space-y-4">
          {/* Key terms summary */}
          <div className="rounded-md bg-slate-50 dark:bg-slate-900 border border-[rgba(128,128,128,0.15)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Key terms summary
            </p>
            <ul className="space-y-1.5">
              {AGREEMENT_SUMMARY_ITEMS.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <span className="mt-0.5 flex-shrink-0 text-slate-400">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Full agreement text — scrollable, verbatim */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Full agreement</p>
            <div className="h-72 overflow-y-auto rounded-md border border-[rgba(128,128,128,0.2)] bg-white dark:bg-black p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-bold text-center text-sm">CYBERLIFE B.V. Sub-Merchant Services Agreement</p>
              <p className="text-center text-slate-500">Payment Facilitation via Pay.nl Alliance</p>

              <p className="font-semibold pt-2">AGREEMENT PARTIES</p>
              <p><strong>Service Provider:</strong> Cyberlife B.V., registered in the Netherlands (KvK: 80663052), contact: info@bayaan.ai, hereinafter referred to as "Cyberlife" or "the Platform".</p>
              <p><strong>Merchant:</strong> [your organisation — pre-filled from your account data], hereinafter referred to as "the Merchant".</p>
              <p><strong>Agreement Date:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

              <p className="font-semibold pt-2">RECITALS</p>
              <p>WHEREAS, Cyberlife B.V. holds a Pay.nl Alliance account and is authorised to onboard sub-merchants onto the Pay.nl payment platform pursuant to its agreement with Pay. B.V. ("Pay.nl"), a licensed payment institution regulated under the Dutch Financial Supervision Act (Wet op het financieel toezicht, Wft);</p>
              <p>WHEREAS, the Merchant wishes to use Cyberlife's multilingual voice translation SaaS platform ("the Cyberlife Platform") and to process payments through Pay.nl via Cyberlife's Alliance integration;</p>
              <p>WHEREAS, Pay.nl, as a licensed financial institution, is required to perform Know Your Customer (KYC) and Anti-Money Laundering (AML) checks on all sub-merchants prior to and during the business relationship;</p>
              <p>NOW, THEREFORE, in consideration of the mutual covenants set out herein, the parties agree as follows:</p>

              <p className="font-semibold pt-2">ARTICLE 1 — DEFINITIONS</p>
              <p>"Agreement" means this Sub-Merchant Services Agreement, including any addenda or amendments. "Alliance Account" means Cyberlife's licensed partner account with Pay.nl that enables the onboarding and management of sub-merchants. "Bayaan Platform" means the multilingual AI voice translation software-as-a-service provided by Cyberlife, enabling real-time translation and communication between speakers of different languages. "Book Balance" means the total amount of funds held by Pay.nl on behalf of the Merchant, through Stichting Derdengelden Pay.nl, net of applicable fees and deductions. "KYC" means Know Your Customer procedures, including identity verification, business verification (KYB), and AML/CFT checks required by applicable law and Pay.nl's policies. "Monthly Platform Fee" means the recurring fee of €39.99 (excl. VAT) per calendar month charged by Cyberlife for access to the Cyberlife Platform. "Pay.nl" means Pay. B.V., a payment institution licensed by De Nederlandsche Bank (DNB), registered in the Netherlands, which provides the underlying payment processing and settlement infrastructure. "Pay.nl Terms" means the general terms and conditions of Pay. B.V. as published at www.pay.nl/en/terms-conditions, as amended from time to time. "Settlement" means the transfer of processed transaction funds to the Merchant's designated IBAN bank account, net of Pay.nl fees and the Monthly Platform Fee. "Sub-Merchant Account" means the merchant account created for the Merchant within Pay.nl's platform under Cyberlife's Alliance Account. "Transaction" means any payment initiated by an end customer of the Merchant and processed through the Pay.nl payment gateway.</p>

              <p className="font-semibold pt-2">ARTICLE 2 — SCOPE OF SERVICES</p>
              <p>2.1 <em>Cyberlife Platform Services</em> — Cyberlife shall provide the Merchant with access to the Cyberlife Platform, including real-time multilingual voice translation services, tenant onboarding, and technical integration support, subject to the subscription terms set out in this Agreement.</p>
              <p>2.2 <em>Payment Facilitation</em> — Cyberlife shall, acting as a Pay.nl Alliance partner, facilitate the creation and management of the Merchant's Sub-Merchant Account with Pay.nl. Cyberlife's role is limited to: Registering the Merchant as a sub-merchant under Cyberlife's Alliance Account; Configuring the technical integration between the Merchant's environment and the Pay.nl payment gateway; Deducting the Monthly Platform Fee from the Merchant's Book Balance via the Pay.nl Alliance invoice mechanism (settleBalance); Providing first-line technical support for the payment integration. Cyberlife does not itself process, clear, or settle payment transactions. All payment processing, clearing, and settlement to the Merchant's bank account is performed exclusively by Pay.nl, subject to Pay.nl's Terms and applicable Dutch and EU payment services law.</p>
              <p>2.3 <em>Cyberlife is Not a Payment Institution</em> — The Merchant acknowledges and agrees that Cyberlife is acting as a technical platform and commercial intermediary only. Cyberlife is not a payment institution, does not hold client funds, and does not guarantee the availability of payment processing services. Payment services are provided by Pay.nl as the licensed payment institution.</p>

              <p className="font-semibold pt-2">ARTICLE 3 — MERCHANT ONBOARDING & KYC CONSENT</p>
              <p>3.1 <em>Sub-Merchant Registration</em> — By signing this Agreement, the Merchant expressly authorises Cyberlife to: Register the Merchant as a sub-merchant under Cyberlife's Pay.nl Alliance Account; Submit the Merchant's business and personal information to Pay.nl for the purposes of account creation, KYC verification, and ongoing compliance monitoring; Access the Merchant's Sub-Merchant Account, transaction statistics, and book balance solely for the purpose of deducting the Monthly Platform Fee and providing technical support.</p>
              <p>3.2 <em>KYC Obligations</em> — The Merchant acknowledges that Pay.nl, as a licensed financial institution, is legally required to perform KYC and AML/CFT checks on all sub-merchants. The Merchant agrees to: Provide accurate, complete, and up-to-date information and documentation as requested by Pay.nl or Cyberlife for KYC purposes, including but not limited to: an extract from the Chamber of Commerce (KvK uittreksel), identification documents of directors and UBOs, proof of bank account (IBAN confirmation), and proof of business address; Promptly notify Cyberlife of any material changes to the Merchant's business, legal structure, beneficial ownership, or bank account details; Cooperate fully with Pay.nl's onboarding team and comply with any enhanced due diligence requests; Accept that Pay.nl may suspend or terminate the Sub-Merchant Account if KYC requirements are not met within a reasonable timeframe.</p>
              <p>3.3 <em>Acceptance of Pay.nl Terms</em> — The Merchant acknowledges that by being onboarded as a sub-merchant under Pay.nl, the Merchant is subject to the Pay.nl Terms (www.pay.nl/en/terms-conditions) as they apply to merchants. The Merchant agrees to comply with the Pay.nl Terms and all applicable card scheme rules, PSD2 requirements, and Dutch and EU payment regulations. In the event of conflict between this Agreement and the Pay.nl Terms regarding payment processing, clearing, and settlement obligations, the Pay.nl Terms shall prevail.</p>

              <p className="font-semibold pt-2">ARTICLE 4 — FEES, SETTLEMENT & BALANCE DEDUCTIONS</p>
              <p>4.1 <em>Monthly Platform Fee</em> — In consideration for access to the Cyberlife Platform, the Merchant shall pay Cyberlife a Monthly Platform Fee of €39.99 (excl. VAT) per calendar month. Dutch VAT (BTW) at the current rate (21%) applies where applicable under Dutch tax law. Billing is monthly, deducted from the Merchant's Book Balance on or after the 1st day of each calendar month.</p>
              <p>4.2 <em>Deduction from Book Balance (settleBalance)</em> — The Merchant expressly authorises Cyberlife to deduct the Monthly Platform Fee directly from the Merchant's Pay.nl Book Balance using the Pay.nl Alliance invoice mechanism ("settleBalance"). This means: Cyberlife will submit an invoice to Pay.nl through the Alliance API for the amount of €39.99 (excl. VAT) per month; Pay.nl will deduct this amount from the Merchant's Book Balance prior to Settlement to the Merchant's bank account; Cyberlife will provide the Merchant with a corresponding invoice document by email for accounting and administration purposes. The Merchant confirms that this deduction method has been explained and is agreed to as the primary billing mechanism. The Merchant will not dispute Book Balance deductions made in accordance with this clause provided the fee amount matches this Agreement.</p>
              <p>4.3 <em>Pay.nl Transaction Fees</em> — Transaction fees, interchange fees, and any other costs charged by Pay.nl for payment processing are separate from and in addition to the Monthly Platform Fee. These are charged by Pay.nl directly against the Merchant's Book Balance in accordance with the Pay.nl Terms and the Merchant's Pay.nl pricing agreement. Cyberlife has no control over and accepts no responsibility for Pay.nl's transaction fee structure.</p>
              <p>4.4 <em>Disputed Deductions</em> — If the Merchant believes a deduction has been made in error, the Merchant shall notify Cyberlife in writing within fourteen (14) days of the deduction. Cyberlife shall investigate and respond within ten (10) business days. Undisputed fees are deemed accepted by the Merchant.</p>

              <p className="font-semibold pt-2">ARTICLE 5 — SETTLEMENT & MONEY FLOW</p>
              <p>5.1 <em>Settlement by Pay.nl</em> — Settlement of transaction funds to the Merchant's IBAN bank account is performed exclusively by Pay.nl through Stichting Derdengelden Pay.nl, in accordance with the Pay.nl Terms and the settlement schedule agreed between the Merchant and Pay.nl. Cyberlife is not a party to the settlement process and does not hold, transmit, or guarantee Merchant funds.</p>
              <p>5.2 <em>Net Settlement</em> — Funds settled to the Merchant's bank account will be net of: Pay.nl's applicable transaction fees and costs; The Monthly Platform Fee deducted by Cyberlife pursuant to Article 4.2; Any chargebacks, refunds, or penalties as defined by Pay.nl's Terms.</p>
              <p>5.3 <em>Merchant IBAN</em> — The Merchant shall provide and maintain a valid IBAN bank account registered in the Merchant's own name for settlement purposes. The Merchant is responsible for ensuring the accuracy of the IBAN provided to Pay.nl. Cyberlife accepts no liability for settlement delays or errors arising from incorrect IBAN information.</p>

              <p className="font-semibold pt-2">ARTICLE 6 — DATA SHARING, PRIVACY & GDPR</p>
              <p>6.1 <em>Data Sharing with Pay.nl</em> — The Merchant acknowledges and consents to the following personal and business data being shared with Pay.nl for the purposes of sub-merchant registration, KYC verification, and payment processing: Company name, registration number (KvK), and registered address; Name, date of birth, nationality, and identity documents of directors and UBOs; Bank account details (IBAN); Business description, website URL, and transaction volumes; Any additional documents requested by Pay.nl's compliance team. Pay.nl's processing of this data is governed by Pay.nl's privacy policy. Cyberlife processes Merchant data as a data processor under its own privacy policy and Data Processing Agreement (DPA), available upon request.</p>
              <p>6.2 <em>GDPR Compliance</em> — Both parties shall comply with the General Data Protection Regulation (EU) 2016/679 (GDPR) and the Dutch Implementation Act (UAVG). Cyberlife maintains appropriate technical and organisational measures to protect Merchant data. Data is stored on EU-based infrastructure (Frankfurt, Germany) and is not transferred outside the EEA without appropriate safeguards.</p>
              <p>6.3 <em>Confidentiality</em> — Each party agrees to treat the other party's confidential business information, technical data, and pricing as strictly confidential and not to disclose such information to third parties, except as required by law or to Pay.nl for the purposes of this Agreement.</p>

              <p className="font-semibold pt-2">ARTICLE 7 — MERCHANT OBLIGATIONS & WARRANTIES</p>
              <p>The Merchant represents, warrants, and agrees that: It is a duly registered legal entity with authority to enter into this Agreement; All information and documents provided to Cyberlife and Pay.nl are accurate, complete, and genuine; It will operate its business in compliance with all applicable laws, regulations, and card scheme rules; It will not use the payment integration for any prohibited business activities as defined in Pay.nl's Terms or applicable law (including but not limited to: money laundering, terrorist financing, fraud, or prohibited goods and services); It will promptly notify Cyberlife of any changes to its business, legal structure, beneficial ownership, or bank account; It will maintain adequate chargeback and dispute handling procedures and respond promptly to any chargeback notifications from Pay.nl; It will comply with PCI-DSS requirements to the extent applicable to its payment processing activities; It accepts the Pay.nl Terms as binding upon it as a sub-merchant.</p>

              <p className="font-semibold pt-2">ARTICLE 8 — LIABILITY & INDEMNIFICATION</p>
              <p>8.1 <em>Limitation of Liability</em> — Cyberlife's liability to the Merchant under or in connection with this Agreement shall be limited to direct damages not exceeding the total Monthly Platform Fees paid by the Merchant in the three (3) months immediately preceding the event giving rise to the claim. Cyberlife shall not be liable for: Any interruption, suspension, or termination of Pay.nl's services; Any failure by Pay.nl to settle funds to the Merchant's bank account; Chargebacks, fraud losses, or disputes arising from the Merchant's transactions; Indirect, consequential, punitive, or special damages of any kind.</p>
              <p>8.2 <em>Indemnification by Merchant</em> — The Merchant shall indemnify, defend, and hold harmless Cyberlife from and against any claims, losses, damages, fines, and costs (including legal fees) arising from: (i) the Merchant's breach of this Agreement; (ii) the Merchant's breach of the Pay.nl Terms; (iii) fraud, chargebacks, or prohibited activities by the Merchant; or (iv) incorrect information provided by the Merchant during KYC.</p>
              <p>8.3 <em>Force Majeure</em> — Neither party shall be liable for any delay or failure to perform its obligations under this Agreement to the extent caused by circumstances beyond its reasonable control, including but not limited to acts of God, government actions, cyberattacks, or failure of third-party infrastructure (including Pay.nl's systems).</p>

              <p className="font-semibold pt-2">ARTICLE 9 — TERM & TERMINATION</p>
              <p>9.1 <em>Term</em> — This Agreement commences on the Agreement Date and continues on a monthly rolling basis unless terminated in accordance with this Article.</p>
              <p>9.2 <em>Termination by Either Party</em> — Either party may terminate this Agreement at any time by providing thirty (30) days' written notice to the other party. Written notice may be given by email to the addresses set out in Article 11.</p>
              <p>9.3 <em>Immediate Termination</em> — Cyberlife may terminate this Agreement with immediate effect, without prior notice, if: The Merchant is in material breach of this Agreement or the Pay.nl Terms; Pay.nl suspends or terminates the Merchant's Sub-Merchant Account; The Merchant engages in fraudulent, illegal, or prohibited activities; The Merchant becomes insolvent, is placed in administration, or enters into a debt restructuring process.</p>
              <p>9.4 <em>Effects of Termination</em> — Upon termination of this Agreement: (i) access to the Cyberlife Platform shall cease; (ii) Cyberlife shall instruct Pay.nl to close the Merchant's Sub-Merchant Account subject to Pay.nl's procedures; (iii) any outstanding Monthly Platform Fees accrued up to the termination date shall remain due and payable; (iv) the Merchant's right to receive settlement payments for transactions processed before termination is not affected. Clauses relating to confidentiality, liability, indemnification, and governing law shall survive termination.</p>

              <p className="font-semibold pt-2">ARTICLE 10 — GOVERNING LAW & DISPUTE RESOLUTION</p>
              <p>10.1 <em>Governing Law</em> — This Agreement is governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law provisions.</p>
              <p>10.2 <em>Disputes</em> — In the event of a dispute arising out of or in connection with this Agreement, the parties shall first attempt to resolve the dispute amicably through good-faith negotiations within thirty (30) days of written notice of the dispute. If the dispute cannot be resolved amicably, it shall be submitted to the exclusive jurisdiction of the competent court in the Netherlands (Rechtbank).</p>

              <p className="font-semibold pt-2">ARTICLE 11 — GENERAL PROVISIONS</p>
              <p>11.1 <em>Notices</em> — All notices under this Agreement shall be in writing and sent by email or registered post to: Cyberlife: info@bayaan.ai / registered address. Merchant: the email address and registered address set out in the Agreement Parties section above.</p>
              <p>11.2 <em>Entire Agreement</em> — This Agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior discussions, representations, and agreements. Any amendments must be made in writing and signed by both parties.</p>
              <p>11.3 <em>Severability</em> — If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be replaced with a valid provision that most closely reflects the original intent.</p>
              <p>11.4 <em>Assignment</em> — The Merchant may not assign or transfer its rights or obligations under this Agreement without Cyberlife's prior written consent. Cyberlife may assign this Agreement to an affiliate or successor entity upon thirty (30) days' written notice.</p>
              <p>11.5 <em>Waiver</em> — No failure or delay by either party to enforce any right under this Agreement shall constitute a waiver of that right. Any waiver must be in writing.</p>
              <p>11.6 <em>Language</em> — This Agreement is drawn up in English. In the event of a dispute regarding interpretation, the English version shall prevail. A Dutch translation may be provided for information purposes only.</p>

              <p className="pt-2 text-[10px] text-slate-400">NOTICE: This Agreement is a template for use between Cyberlife B.V. and each individual Merchant. Each signed copy constitutes a separate binding agreement. Cyberlife recommends that the Merchant seeks independent legal advice before signing. This Agreement does not replace or supersede the Merchant's direct obligations under the Pay.nl Terms and Conditions. Pay.nl Terms: www.pay.nl/en/terms-conditions</p>
            </div>
          </div>

          {/* Signature form */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Your signature
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sig-name" className="text-xs">Full name</Label>
                <Input
                  id="sig-name"
                  value={signeeName}
                  onChange={(e) => setSigneeName(e.target.value)}
                  placeholder="e.g. Ahmed Al-Rashidi"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sig-title" className="text-xs">Title / role</Label>
                <Input
                  id="sig-title"
                  value={signeeTitle}
                  onChange={(e) => setSigneeTitle(e.target.value)}
                  placeholder="e.g. Director / Bestuurder"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 flex-shrink-0"
              />
              <span className="text-slate-700 dark:text-slate-300">
                I confirm that I have read, understood, and agree to be bound by the full Sub-Merchant Services Agreement on behalf of the organisation. I understand this constitutes a legally binding digital signature.
              </span>
            </label>

            <Button
              onClick={handleSign}
              disabled={!signeeName.trim() || !signeeTitle.trim() || !agreed || signing}
              size="sm"
            >
              {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {signing ? 'Signing & uploading…' : 'Sign agreement'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const ID_TYPES = [
  {
    value: 'passport',
    label: 'Passport',
    hint: 'Upload the full data page (photo page) as one file.',
    needsBack: false,
  },
  {
    value: 'id_card',
    label: 'Identity card',
    hint: 'Combine front and back into one PDF or image file.',
    needsBack: true,
  },
  {
    value: 'drivers_licence',
    label: "Driver's licence (Dutch only)",
    hint: 'Only a Dutch rijbewijs is accepted. Combine front and back into one file.',
    needsBack: true,
  },
  {
    value: 'residence_permit',
    label: 'Residence permit',
    hint: 'Upload the full residence permit as one file.',
    needsBack: false,
  },
] as const;

type IdTypeValue = (typeof ID_TYPES)[number]['value'];

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
  const [idType, setIdType] = useState<IdTypeValue | ''>('');

  const isIdentification = doc.doc_type === 'identification';
  const { label, description } = resolveDocLabel(doc, locale);
  const documentCode = doc.paynl_document_code;

  const selectedIdType = ID_TYPES.find((t) => t.value === idType);

  // For identification docs, require the admin to select the type first.
  const uploadReady = !isIdentification || !!idType;

  function buildFileName(originalName: string): string {
    if (!isIdentification || !idType) return originalName;
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'pdf';
    return `${idType}.${ext}`;
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!documentCode) {
      toast.error('This document is missing its Pay.nl code — refresh merchant info.');
      return;
    }
    if (isIdentification && !idType) {
      toast.error('Please select the document type before uploading.');
      return;
    }

    setUploading(true);
    try {
      const renamedFile = new File([file], buildFileName(file.name), { type: file.type });
      const formData = new FormData();
      formData.append('documentCode', documentCode);
      formData.append('file', renamedFile);

      const res = await fetch(
        `/api/organizations/${organizationId}/merchant/documents`,
        { method: 'POST', body: formData },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onUpdated({ ...doc, status: data.status, uploaded_at: data.uploadedAt });
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
    <div className="rounded-md border border-[rgba(128,128,128,0.2)] p-3 space-y-2">
      <div className="flex items-start gap-3 justify-between">
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

        {!isIdentification && (
          <div className="shrink-0">
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
        )}
      </div>

      {/* Identification-specific type selector + upload */}
      {isIdentification && doc.status !== 'accepted' && (
        <div className="pt-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            {ID_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setIdType(t.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  idType === t.value
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-[rgba(128,128,128,0.4)] text-slate-600 hover:border-slate-400 dark:text-slate-300',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {selectedIdType && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedIdType.hint}
              {selectedIdType.needsBack && (
                <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
                  Front + back required — combine into one file.
                </span>
              )}
            </p>
          )}

          <div>
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={handleChange}
              disabled={uploading || effectiveDisabled || !uploadReady}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || effectiveDisabled || !uploadReady}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!idType
                ? 'Select type first'
                : hasUpload
                  ? 'Replace'
                  : `Upload ${selectedIdType?.label ?? ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Already accepted — show green check state for identification */}
      {isIdentification && doc.status === 'accepted' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          Identification accepted by Pay.nl ✓
        </p>
      )}
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
  isLoading,
}: {
  organization: OrganizationProp;
  merchantId: string | null;
  serviceId: string | null;
  donationsActive: boolean;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}) {
  const t = useTranslations('mosqueAdmin.settings.merchantStatus');
  const [refreshing, setRefreshing] = useState(false);
  const busy = isLoading || refreshing;

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
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
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
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
