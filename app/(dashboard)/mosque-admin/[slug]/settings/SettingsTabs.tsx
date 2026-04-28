'use client';
/* eslint-disable react/no-unescaped-entities */

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
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
import { SignaturePad, type SignaturePadHandle } from '@/components/signature-pad';
import {
  AGREEMENT_ARTICLES,
  ALLIANCE_PARTY,
  PAY_PARTY,
  buildMerchantParagraph,
  buildPayParagraph,
} from '@/lib/agreement-text';

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
  gender: 'M' | 'F' | null;
  birth_country: string | null;
  birth_city: string | null;
  ubo_type: string | null;
  // Extra fields used when prefilling the placeholder form from an orphan.
  date_of_birth: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  ubo_percentage: number | null;
}

interface RemoteLicenseSummary {
  code: string;
  /** Display name from Pay.nl (often null for placeholder licenses). */
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  birthCountry: string | null;
  birthPlace: string | null;
  uboType: string | null;
  documentCount: number;
  /** At least one document has status APPROVED/ACCEPTED at Pay.nl. */
  hasAcceptedDoc: boolean;
  /** True when Pay.nl-side data is empty / placeholder shape (no name, no
   * accepted doc, default uboPercentage). The UI auto-expands the fill-in
   * form for blank licenses. */
  isBlank: boolean;
  /** Wire-name list of fields Pay.nl Compliance is still missing for this
   * license. Computed from /v2/licenses complianceData + doc status. Surfaced
   * to the admin so they know exactly what to fill in. */
  missingFields: string[];
  complianceData: {
    authorizedToSign?: string;
    pep?: boolean;
    pepDescription?: string | null;
    ubo?: string;
    uboPercentage?: number;
    relationshipDescription?: string | null;
    dateOfBirth?: string | null;
    nationality?: string | null;
  };
  isPlaceholder: boolean;
  localPersonId: string | null;
}

interface MerchantClearingAccountSummary {
  code: string;
  status?: string;
  method?: string;
  iban?: string;
  bic?: string;
  owner?: string;
}

interface LiveMerchantState {
  boardingStatus:
    | 'REGISTERED'
    | 'ONBOARDING'
    | 'ACCEPTED'
    | 'SUSPENDED'
    | 'OFFBOARDED'
    | null;
  status: 'ACTIVE' | 'INACTIVE' | null;
  payoutStatus: 'ENABLED' | 'DISABLED' | null;
  contractPackage: string | null;
  accountManager: string | null;
  acceptedAt: string | null;
  suspendedAt: string | null;
  nextReviewDate: string | null;
  contractLanguage: string | null;
  website: string | null;
  clearingAccounts: MerchantClearingAccountSummary[];
  remoteLicenses: RemoteLicenseSummary[];
}

const EMPTY_LIVE_STATE: LiveMerchantState = {
  boardingStatus: null,
  status: null,
  payoutStatus: null,
  contractPackage: null,
  accountManager: null,
  acceptedAt: null,
  suspendedAt: null,
  nextReviewDate: null,
  contractLanguage: null,
  website: null,
  clearingAccounts: [],
  remoteLicenses: [],
};

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
  const [liveState, setLiveState] = useState<LiveMerchantState>({
    ...EMPTY_LIVE_STATE,
    boardingStatus: organization.paynl_boarding_status,
  });
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
      setLiveState((prev) => ({
        ...prev,
        boardingStatus: data.boardingStatus ?? prev.boardingStatus,
        status: data.status ?? prev.status,
        payoutStatus: data.payoutStatus ?? prev.payoutStatus,
        contractPackage: data.contractPackage ?? prev.contractPackage,
        accountManager: data.accountManager ?? prev.accountManager,
        acceptedAt: data.acceptedAt ?? prev.acceptedAt,
        suspendedAt: data.suspendedAt ?? prev.suspendedAt,
        nextReviewDate: data.nextReviewDate ?? prev.nextReviewDate,
        contractLanguage: data.contractLanguage ?? prev.contractLanguage,
        website: data.website ?? prev.website,
        clearingAccounts: Array.isArray(data.clearingAccounts)
          ? data.clearingAccounts
          : prev.clearingAccounts,
        remoteLicenses: Array.isArray(data.remoteLicenses)
          ? data.remoteLicenses
          : prev.remoteLicenses,
      }));
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

  const hasOutstandingDocs = docs.some(
    (d) => d.paynl_required && (d.status === 'requested' || d.status === 'rejected'),
  );
  const hasPlaceholderLicenses = liveState.remoteLicenses.some(
    (lic) => lic.isPlaceholder,
  );
  const hasOrphanPersons = persons.some((p) => !p.paynl_license_code);
  // The documents panel earns its place when there's any outstanding Pay.nl
  // work — outstanding docs, placeholder licenses awaiting person data, or
  // local persons that never got linked to a Pay.nl license. Do NOT gate on
  // "local birth_country missing": V2 doesn't expose that field, persons can
  // be fully verified at Pay.nl with local nulls.
  const showDocuments = hasOutstandingDocs || hasPlaceholderLicenses || hasOrphanPersons;

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
        <MerchantStateOverview
          merchantId={merchantId}
          state={liveState}
          isLoading={isInitialChecking}
        />
        {!isInitialChecking && showDocuments && (
          <DocumentsPanel
            organization={organization}
            docs={docs}
            persons={persons}
            liveState={liveState}
            onDocUpdated={handleDocUpdated}
            onPersonUpdated={handlePersonUpdated}
            onPlaceholderResolved={handleStatusRefresh}
          />
        )}
      </div>
    );
  }

  // Default (submitted OR pending-with-merchant) → waiting screen + live state
  // overview + documents panel so the admin can finish uploading KYC files.
  return (
    <div className="space-y-4">
      <KycPendingCard onRefresh={handleStatusRefresh} isLoading={isInitialChecking} />
      <MerchantStateOverview
        merchantId={merchantId}
        state={liveState}
        isLoading={isInitialChecking}
      />
      {!isInitialChecking && (
        <DocumentsPanel
          organization={organization}
          docs={docs}
          persons={persons}
          liveState={liveState}
          onDocUpdated={handleDocUpdated}
          onPersonUpdated={handlePersonUpdated}
          onPlaceholderResolved={handleStatusRefresh}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MerchantStateOverview — always visible whenever a merchant exists.
// Surfaces live Pay.nl state (boarding/payout/contract/clearing) so admins
// can see exactly where the application is, not just a generic "submitted"
// message.
// ---------------------------------------------------------------------------

function MerchantStateOverview({
  merchantId,
  state,
  isLoading,
}: {
  merchantId: string | null;
  state: LiveMerchantState;
  isLoading?: boolean;
}) {
  if (!merchantId) return null;

  const boardingTone = boardingBadgeTone(state.boardingStatus);
  const payoutTone = state.payoutStatus === 'ENABLED' ? 'emerald' : 'amber';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg">Merchant status at Pay.nl</CardTitle>
            <CardDescription>
              Live snapshot of your Pay.nl merchant record. Updates each time you
              refresh.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <ToneBadge tone={boardingTone} label="Boarding">
            {state.boardingStatus ?? '—'}
          </ToneBadge>
          {state.status && (
            <ToneBadge
              tone={state.status === 'ACTIVE' ? 'emerald' : 'slate'}
              label="Account"
            >
              {state.status}
            </ToneBadge>
          )}
          {state.payoutStatus && (
            <ToneBadge tone={payoutTone} label="Payouts">
              {state.payoutStatus}
            </ToneBadge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Merchant code" value={merchantId} mono />
          {state.contractPackage && (
            <FieldRow label="Package" value={state.contractPackage} />
          )}
          {state.accountManager && (
            <FieldRow label="Account manager" value={state.accountManager} />
          )}
          {state.acceptedAt && (
            <FieldRow
              label="Contract signed"
              value={new Date(state.acceptedAt).toLocaleString('nl-NL')}
            />
          )}
          {state.nextReviewDate && (
            <FieldRow
              label="Next compliance review"
              value={new Date(state.nextReviewDate).toLocaleDateString('nl-NL')}
            />
          )}
          {state.suspendedAt && (
            <FieldRow
              label="Suspended on"
              value={new Date(state.suspendedAt).toLocaleString('nl-NL')}
            />
          )}
        </div>

        {state.clearingAccounts.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Settlement bank accounts
            </p>
            <ul className="space-y-1">
              {state.clearingAccounts.map((acc) => (
                <li
                  key={acc.code}
                  className="flex items-center justify-between rounded-md border border-[rgba(128,128,128,0.2)] px-3 py-2 text-sm"
                >
                  <span className="font-mono">{acc.iban ?? acc.code}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {acc.owner && <span>{acc.owner}</span>}
                    {acc.status && (
                      <ToneBadge
                        tone={acc.status === 'APPROVED' ? 'emerald' : 'amber'}
                        small
                      >
                        {acc.status}
                      </ToneBadge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.boardingStatus === 'ONBOARDING' && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            Pay.nl is reviewing your application. Boarding sits in <strong>ONBOARDING</strong>{' '}
            until <em>every</em> license has full person data plus an accepted ID document.
            Fill in any placeholders below to clear the gate.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function boardingBadgeTone(
  s: LiveMerchantState['boardingStatus'],
): 'emerald' | 'amber' | 'red' | 'slate' {
  switch (s) {
    case 'ACCEPTED':
      return 'emerald';
    case 'REGISTERED':
    case 'ONBOARDING':
      return 'amber';
    case 'SUSPENDED':
    case 'OFFBOARDED':
      return 'red';
    default:
      return 'slate';
  }
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function ToneBadge({
  tone,
  label,
  small,
  children,
}: {
  tone: 'emerald' | 'amber' | 'red' | 'slate';
  label?: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  const palette = {
    emerald:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    amber:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    red: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200',
    slate:
      'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium',
        small ? 'text-[11px]' : 'text-xs',
        palette,
      )}
    >
      {label && <span className="opacity-60">{label}:</span>} {children}
    </span>
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
  liveState,
  onDocUpdated,
  onPersonUpdated,
  onPlaceholderResolved,
}: {
  organization: OrganizationProp;
  docs: OrganizationKycDocument[];
  persons: OrganizationPerson[];
  liveState: LiveMerchantState;
  onDocUpdated: (doc: OrganizationKycDocument) => void;
  onPersonUpdated: (person: OrganizationPerson) => void;
  onPlaceholderResolved: () => Promise<void>;
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

  // Per-person split, driven by Pay.nl signal not local field completeness:
  //
  //   needsPersonAction — has outstanding docs (requested/rejected) on this
  //                       license; admin must upload/replace files.
  //   verifiedPersons   — has at least one accepted doc, no outstanding work.
  //                       Render as a small read-only "✓ verified" line.
  //   dormantPersons    — has paynl_license_code but no docs at all. Pay.nl
  //                       hasn't asked us for anything; show passive summary.
  //   orphanPersons     — no paynl_license_code (insert succeeded locally but
  //                       Pay.nl never returned a personCode for them).
  //                       These can't be edited or upload docs until linked;
  //                       surface as a warning row.
  //
  // We deliberately do NOT key off "missing local gender/birth_country/birth_city"
  // anymore. Those fields aren't part of the Pay.nl V2 wire (zero hits across
  // the swagger), so a NULL there says nothing about Pay.nl-side completeness.
  const personsWithLicense = persons.filter((p) => !!p.paynl_license_code);
  const orphanPersons = persons.filter((p) => !p.paynl_license_code);

  function personState(
    p: OrganizationPerson,
  ): 'outstanding' | 'verified' | 'dormant' {
    const personDocs = docsByPerson.get(p.id) ?? [];
    if (
      personDocs.some(
        (d) => d.status === 'requested' || d.status === 'rejected',
      )
    ) {
      return 'outstanding';
    }
    if (personDocs.some((d) => d.status === 'accepted')) {
      return 'verified';
    }
    return 'dormant';
  }

  const personsByState = personsWithLicense.reduce(
    (acc, p) => {
      acc[personState(p)].push(p);
      return acc;
    },
    {
      outstanding: [] as OrganizationPerson[],
      verified: [] as OrganizationPerson[],
      dormant: [] as OrganizationPerson[],
    },
  );

  const outstandingRequired = docs.filter(
    (d) => d.paynl_required && (d.status === 'requested' || d.status === 'rejected'),
  );

  // Placeholder licenses: ones Pay.nl reported via /info that we have no
  // local row for (Pay.nl auto-creates these from the KvK board listing).
  const placeholderLicenses = liveState.remoteLicenses.filter(
    (lic) => lic.isPlaceholder,
  );

  // /v2/boarding/{code}/ready can only be called once, while the merchant is
  // still in REGISTERED. After that, Pay.nl drives the lifecycle and another
  // call is rejected. Gate on that + on outstanding docs + on placeholder
  // licenses still being unfilled. Local birth/gender nulls are NOT a gate.
  const submitGated =
    liveState.boardingStatus !== 'REGISTERED' ||
    outstandingRequired.length > 0 ||
    placeholderLicenses.length > 0 ||
    orphanPersons.length > 0;
  const canSubmit = docs.length > 0 && !submitGated;

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

  const hasAnything =
    docs.length > 0 ||
    personsWithLicense.length > 0 ||
    placeholderLicenses.length > 0 ||
    orphanPersons.length > 0;

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
              organization={organization}
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

        {personsByState.outstanding.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Awaiting your action ({personsByState.outstanding.length})
              </p>
              <div className="space-y-4">
                {personsByState.outstanding.map((person) => (
                  <PersonOutstandingCard
                    key={person.id}
                    organization={organization}
                    person={person}
                    docs={docsByPerson.get(person.id) ?? []}
                    locale={locale}
                    onDocUpdated={onDocUpdated}
                    onPersonUpdated={onPersonUpdated}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {personsByState.verified.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Verified at Pay.nl ({personsByState.verified.length})
              </p>
              <ul className="space-y-2">
                {personsByState.verified.map((person) => (
                  <PersonVerifiedRow key={person.id} person={person} />
                ))}
              </ul>
            </div>
          </>
        )}

        {personsByState.dormant.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                On file at Pay.nl ({personsByState.dormant.length})
              </p>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                These persons have a Pay.nl license but no document requests yet
                — Pay.nl Compliance hasn&apos;t flagged them as needing anything.
              </p>
              <ul className="space-y-2">
                {personsByState.dormant.map((person) => (
                  <PersonVerifiedRow key={person.id} person={person} dormant />
                ))}
              </ul>
            </div>
          </>
        )}

        {orphanPersons.length > 0 && (
          <>
            <Separator />
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-700 dark:bg-red-950/30">
              <p className="font-semibold text-red-800 dark:text-red-200">
                Local-only persons ({orphanPersons.length}) — not registered at
                Pay.nl
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                These rows exist in your dashboard but Pay.nl never returned a
                license code for them. They cannot upload ID copies or count
                toward Pay.nl boarding until they&apos;re re-submitted. Open
                any placeholder license below and pick the matching local
                person from the &ldquo;Use existing person&rdquo; dropdown to
                pre-fill it.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-red-800 dark:text-red-200">
                {orphanPersons.map((p) => {
                  const detailParts = [
                    p.is_signee ? 'signee' : null,
                    p.is_ubo ? 'UBO' : null,
                    p.date_of_birth ? `DOB ${p.date_of_birth}` : null,
                    p.nationality ? `nat ${p.nationality}` : null,
                    p.address_city
                      ? `${p.address_city}, ${p.address_country}`
                      : null,
                  ].filter(Boolean);
                  return (
                    <li key={p.id}>
                      • <strong>{p.full_name}</strong>
                      {detailParts.length > 0 && (
                        <span className="text-red-700 dark:text-red-300">
                          {' '}— {detailParts.join(' · ')}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {placeholderLicenses.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pay.nl is waiting on these {placeholderLicenses.length} board {placeholderLicenses.length === 1 ? 'member' : 'members'}
              </p>
              <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                Pay.nl pulled these license slots from your Chamber of Commerce
                extract. Pay.nl Compliance has each one open and is asking for{' '}
                <strong>specific person details</strong> (not documents): name,
                gender, date of birth, nationality, place of birth, country of
                birth, home address, ownership percentage — and afterwards a
                copy of their ID. Submitting the form here replaces the
                placeholder with a fully-populated license at Pay.nl in one
                step.
              </p>

              {orphanPersons.length > 0 && (
                <div className="mb-3 rounded-md border border-blue-300 bg-blue-50 p-3 text-xs dark:border-blue-700 dark:bg-blue-950/30">
                  <p className="font-semibold text-blue-800 dark:text-blue-200">
                    {orphanPersons.length} local person
                    {orphanPersons.length === 1 ? ' has' : 's have'} data on
                    file but no Pay.nl license
                  </p>
                  <p className="mt-1 text-blue-700 dark:text-blue-300">
                    Open the form for any placeholder below and click{' '}
                    <em>Use existing person</em> to pre-fill it from{' '}
                    {orphanPersons.map((p) => p.full_name).join(', ')}.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {placeholderLicenses.map((lic) => (
                  <PlaceholderLicenseRow
                    key={lic.code}
                    organization={organization}
                    license={lic}
                    orphanPersons={orphanPersons}
                    onCompleted={onPlaceholderResolved}
                  />
                ))}
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
                  {(() => {
                    const rejected = outstandingRequired.filter((d) => d.status === 'rejected').length;
                    const requested = outstandingRequired.length - rejected;
                    if (rejected > 0) {
                      return `${rejected} document${rejected === 1 ? '' : 's'} rejected by Pay.nl — re-upload required${requested > 0 ? ` (plus ${requested} still to upload)` : ''}.`;
                    }
                    if (requested > 0) {
                      return `${requested} required document${requested === 1 ? '' : 's'} still outstanding.`;
                    }
                    if (placeholderLicenses.length > 0) {
                      return `${placeholderLicenses.length} Pay.nl-created license${placeholderLicenses.length === 1 ? '' : 's'} still need person details + ID copy.`;
                    }
                    if (orphanPersons.length > 0) {
                      return `${orphanPersons.length} local person row${orphanPersons.length === 1 ? '' : 's'} not registered at Pay.nl — re-submit before review.`;
                    }
                    if (
                      liveState.boardingStatus &&
                      liveState.boardingStatus !== 'REGISTERED'
                    ) {
                      return `Already submitted — current state: ${liveState.boardingStatus}. Pay.nl will drive the next transition.`;
                    }
                    return 'All required information is complete. Submit to Pay.nl Compliance.';
                  })()}
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

// ---------------------------------------------------------------------------
// PersonOutstandingCard — full card for a person Pay.nl currently has open
// requests on (status requested or rejected). Shows the doc upload row(s) and
// a quiet read-only summary of locally-known compliance data with a small
// edit toggle for cases where the admin wants to backfill.
// ---------------------------------------------------------------------------

function PersonOutstandingCard({
  organization,
  person,
  docs,
  locale,
  onDocUpdated,
  onPersonUpdated,
}: {
  organization: OrganizationProp;
  person: OrganizationPerson;
  docs: OrganizationKycDocument[];
  locale: string;
  onDocUpdated: (doc: OrganizationKycDocument) => void;
  onPersonUpdated: (person: OrganizationPerson) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:border-amber-700 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{person.full_name}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {[
            person.is_signee ? 'signee' : null,
            person.is_ubo ? 'UBO' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {person.ubo_type && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
            {person.ubo_type}
          </span>
        )}
      </div>

      <BirthCountryField
        organizationId={organization.id}
        person={person}
        onUpdated={onPersonUpdated}
      />

      {docs.map((d) => (
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
}

// ---------------------------------------------------------------------------
// PersonVerifiedRow — single-line read-only summary for a person Pay.nl has
// already accepted (or has no open requests on). Just confirms presence;
// the admin can still hit Edit on the compliance summary if they want to
// backfill local-only fields.
// ---------------------------------------------------------------------------

function PersonVerifiedRow({
  person,
  dormant,
}: {
  person: OrganizationPerson;
  dormant?: boolean;
}) {
  const tone = dormant
    ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40'
    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30';
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
        tone,
      )}
    >
      <div>
        <span className="font-medium">{person.full_name}</span>
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
          {[
            person.is_signee ? 'signee' : null,
            person.is_ubo ? 'UBO' : null,
            person.ubo_type ? person.ubo_type : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <span className="text-xs">
        {dormant ? (
          <span className="text-slate-500 dark:text-slate-400">No requests</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Inline field for a person's compliance data: gender + place of birth +
 * country of birth. Submits to PATCH /merchant/license. Used inside
 * PersonOutstandingCard so the admin can backfill if Pay.nl explicitly asks.
 * Note: V2 doesn't actually expose birthCountry/birthPlace as wire fields —
 * we keep them locally as supporting context.
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
  const isSaved = !!(person.birth_country && person.birth_city && person.gender);
  const isEmpty = !person.birth_country && !person.birth_city && !person.gender;
  // Start collapsed by default — this field only matters when Pay.nl
  // explicitly requests it via portal feedback. Admin opens manually.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gender, setGender] = useState<'M' | 'F' | ''>(person.gender ?? '');
  const [country, setCountry] = useState(person.birth_country ?? '');
  const [city, setCity] = useState(person.birth_city ?? '');

  async function trySave(opts: {
    gender?: 'M' | 'F' | '';
    country?: string;
    city?: string;
  }) {
    const nextGender = opts.gender ?? gender;
    const nextCountry = opts.country ?? country;
    const nextCity = opts.city ?? city;
    if (saving) return;
    const payload: Record<string, string> = { personId: person.id };
    if (nextGender) payload.gender = nextGender;
    if (nextCountry) payload.birthCountry = nextCountry;
    if (nextCity.trim()) payload.birthPlace = nextCity.trim();
    if (Object.keys(payload).length === 1) return; // nothing to send
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/merchant/license`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onUpdated({
        ...person,
        gender: nextGender ? (nextGender as 'M' | 'F') : person.gender,
        birth_country: nextCountry || person.birth_country,
        birth_city: nextCity.trim() || person.birth_city,
      });
      if (nextGender && nextCountry && nextCity.trim()) setEditing(false);
      toast.success('Compliance details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    if (isSaved) {
      const countryLabel =
        COUNTRY_OPTIONS.find((c) => c.value === person.birth_country)?.label ??
        person.birth_country;
      return (
        <div className="flex items-center justify-between rounded-md border border-[rgba(128,128,128,0.2)] p-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Compliance details
            </p>
            <p className="mt-0.5 text-sm">
              {person.gender === 'M' ? 'Male' : 'Female'} · born in {person.birth_city},{' '}
              {countryLabel}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      );
    }
    if (isEmpty) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setEditing(true)}
        >
          Add compliance details
        </Button>
      );
    }
    // Partial data — show what we have plus an Edit affordance, no callout.
    return (
      <div className="flex items-center justify-between rounded-md border border-[rgba(128,128,128,0.2)] p-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Compliance details (partial)
          </p>
          <p className="mt-0.5 text-sm">
            {person.gender ? (person.gender === 'M' ? 'Male' : 'Female') : 'Gender —'}
            {' · '}
            {person.birth_city || 'place of birth —'}
            {', '}
            {person.birth_country ?? 'country —'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-900/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Pay.nl Compliance details
        </p>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={gender || undefined}
          onValueChange={(val) => {
            const g = val as 'M' | 'F';
            setGender(g);
            trySave({ gender: g });
          }}
          disabled={saving}
        >
          <SelectTrigger className="col-span-2 h-8 text-sm sm:col-span-1">
            <SelectValue placeholder="Gender…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="M">Male</SelectItem>
            <SelectItem value="F">Female</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="City / town of birth"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onBlur={() => trySave({ city })}
          className="col-span-2 h-8 text-sm sm:col-span-1"
          disabled={saving}
        />
        <Select
          value={country}
          onValueChange={(val) => {
            setCountry(val);
            trySave({ country: val });
          }}
          disabled={saving}
        >
          <SelectTrigger className="col-span-2 h-8 text-sm">
            <SelectValue placeholder="Country of birth…" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isSaved && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder license row — fills in a Pay.nl auto-created (KvK-derived)
// license. Submits to POST /api/.../merchant/persons with replaceLicenseCode
// set, which on the server side does DELETE /v2/licenses/{code} followed by
// POST /v2/licenses with full person data (the only V2-supported way to
// push firstName/lastName/gender/visitAddress onto an empty placeholder).
// ---------------------------------------------------------------------------

interface PlaceholderFormState {
  firstName: string;
  lastName: string;
  gender: '' | 'M' | 'F';
  dateOfBirth: string;
  nationality: string;
  placeOfBirth: string;
  birthCountry: string;
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

function emptyPlaceholderForm(defaultCountry: string): PlaceholderFormState {
  return {
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    nationality: defaultCountry,
    placeOfBirth: '',
    birthCountry: defaultCountry,
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    country: defaultCountry,
    isSignee: false,
    isUbo: true,
    uboPercentage: '',
  };
}

// Human label + Pay.nl V2 wire field grouping for the missing-field
// checklist shown above the placeholder form. We collapse the wire fields
// into the categories Pay.nl Compliance speaks in.
const MISSING_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  gender: 'Gender (M / F)',
  dateOfBirth: 'Date of birth',
  nationality: 'Nationality',
  visitAddress: 'Home address (street, number, postal code, city, country)',
  placeOfBirth: 'Place of birth (city)',
  birthCountry: 'Country of birth',
  uboPercentage: 'Ownership percentage',
  authorizedToSign: 'Authority to sign',
  identification: 'ID document copy',
};

function PlaceholderLicenseRow({
  organization,
  license,
  orphanPersons,
  onCompleted,
}: {
  organization: OrganizationProp;
  license: RemoteLicenseSummary;
  orphanPersons: OrganizationPerson[];
  onCompleted: () => Promise<void>;
}) {
  const defaultCountry = organization.country || 'NL';
  // Auto-expand for blank licenses (no name + no doc + default complianceData):
  // those are the ones the user explicitly came here to fix.
  const [open, setOpen] = useState(license.isBlank);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlaceholderFormState>(() =>
    emptyPlaceholderForm(defaultCountry),
  );

  function prefillFromOrphan(personId: string) {
    const p = orphanPersons.find((op) => op.id === personId);
    if (!p) return;
    const parts = p.full_name.trim().split(/\s+/);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : p.full_name;
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    setForm({
      firstName,
      lastName,
      gender: (p.gender as 'M' | 'F') ?? '',
      dateOfBirth: p.date_of_birth ?? '',
      nationality: p.nationality ?? defaultCountry,
      placeOfBirth: p.birth_city ?? '',
      birthCountry: p.birth_country ?? defaultCountry,
      email: p.email ?? '',
      phone: p.phone ?? '',
      street: p.address_street ?? '',
      houseNumber: p.address_house_number ?? '',
      postalCode: p.address_postal_code ?? '',
      city: p.address_city ?? '',
      country: p.address_country ?? defaultCountry,
      isSignee: p.is_signee,
      isUbo: p.is_ubo,
      uboPercentage: p.ubo_percentage != null ? String(p.ubo_percentage) : '',
    });
    setOpen(true);
  }

  function update<K extends keyof PlaceholderFormState>(
    key: K,
    value: PlaceholderFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    const required: Array<[string, string]> = [
      [form.firstName, 'first name'],
      [form.lastName, 'last name'],
      [form.gender, 'gender'],
      [form.dateOfBirth, 'date of birth'],
      [form.nationality, 'nationality'],
      [form.placeOfBirth, 'place of birth'],
      [form.birthCountry, 'country of birth'],
      [form.street, 'street'],
      [form.houseNumber, 'house number'],
      [form.postalCode, 'postal code'],
      [form.city, 'city'],
      [form.country, 'country'],
    ];
    for (const [val, label] of required) {
      if (!val || (typeof val === 'string' && val.trim() === '')) {
        return `${label} is required`;
      }
    }
    if (!form.isSignee && !form.isUbo) {
      return 'Mark the person as signee, UBO, or both';
    }
    if (form.isUbo) {
      const pct = Number(form.uboPercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return 'UBO ownership percentage must be between 0 and 100';
      }
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        nationality: form.nationality.toUpperCase(),
        placeOfBirth: form.placeOfBirth.trim(),
        birthCountry: form.birthCountry.toUpperCase(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: {
          street: form.street.trim(),
          houseNumber: form.houseNumber.trim(),
          postalCode: form.postalCode.trim(),
          city: form.city.trim(),
          country: form.country.toUpperCase(),
        },
        isSignee: form.isSignee,
        isUbo: form.isUbo,
        uboPercentage: form.isUbo ? Number(form.uboPercentage) : undefined,
        replaceLicenseCode: license.code,
      };
      const res = await fetch(
        `/api/organizations/${organization.id}/merchant/persons`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success(
        `${body.firstName} added — placeholder ${license.code} replaced`,
      );
      setOpen(false);
      await onCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Pretty list of what Pay.nl Compliance is asking for on this license.
  const askedFor = license.missingFields
    .map((f) => MISSING_FIELD_LABELS[f] ?? f)
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between px-3 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs">
            {license.code}
            {license.name && license.name.trim() && (
              <span className="ml-2 font-sans font-medium text-amber-900 dark:text-amber-100">
                {license.name}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {license.isBlank
              ? 'Pay.nl Compliance is asking for the following details:'
              : 'Some compliance fields are still missing:'}
          </p>
          {askedFor.length > 0 && (
            <ul className="mt-1 ml-4 list-disc text-xs text-amber-900 dark:text-amber-100">
              {askedFor.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
        </div>
        <span className="ml-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {license.documentCount > 0
            ? `${license.documentCount} doc${license.documentCount === 1 ? '' : 's'}`
            : 'No ID yet'}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-amber-200 dark:border-amber-800 px-3 py-4">
          {orphanPersons.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-300 bg-blue-50 p-2 text-xs dark:border-blue-700 dark:bg-blue-950/30">
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Use existing person:
              </span>
              <Select
                value=""
                onValueChange={(v) => prefillFromOrphan(v)}
              >
                <SelectTrigger className="h-7 w-auto min-w-[200px] text-xs">
                  <SelectValue placeholder="Select a local person…" />
                </SelectTrigger>
                <SelectContent>
                  {orphanPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-blue-700 dark:text-blue-300">
                — pre-fills the form below from local data
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="First name" required>
              <Input
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
              />
            </FormField>
            <FormField label="Last name" required>
              <Input
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
              />
            </FormField>
            <FormField label="Gender" required>
              <Select
                value={form.gender || undefined}
                onValueChange={(v) => update('gender', v as 'M' | 'F')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Date of birth" required>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => update('dateOfBirth', e.target.value)}
              />
            </FormField>
            <FormField label="Place of birth (city)" required>
              <Input
                value={form.placeOfBirth}
                onChange={(e) => update('placeOfBirth', e.target.value)}
              />
            </FormField>
            <FormField label="Country of birth" required>
              <Select
                value={form.birthCountry}
                onValueChange={(v) => update('birthCountry', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Nationality (ISO-2)" required>
              <Input
                value={form.nationality}
                maxLength={2}
                onChange={(e) =>
                  update('nationality', e.target.value.toUpperCase().slice(0, 2))
                }
              />
            </FormField>
            <FormField label="Email (optional)">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </FormField>
            <FormField label="Phone (optional)">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </FormField>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Street" required>
              <Input
                value={form.street}
                onChange={(e) => update('street', e.target.value)}
              />
            </FormField>
            <FormField label="House number" required>
              <Input
                value={form.houseNumber}
                onChange={(e) => update('houseNumber', e.target.value)}
              />
            </FormField>
            <FormField label="Postal code" required>
              <Input
                value={form.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
              />
            </FormField>
            <FormField label="City" required>
              <Input
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </FormField>
            <FormField label="Country (ISO-2)" required>
              <Input
                value={form.country}
                maxLength={2}
                onChange={(e) =>
                  update('country', e.target.value.toUpperCase().slice(0, 2))
                }
              />
            </FormField>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.isSignee}
                onChange={(e) => update('isSignee', e.target.checked)}
              />
              Signee
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.isUbo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isUbo: e.target.checked,
                    uboPercentage: e.target.checked ? prev.uboPercentage : '',
                  }))
                }
              />
              UBO / pseudo-UBO
            </label>
            {form.isUbo && (
              <FormField label="Ownership %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.uboPercentage}
                  onChange={(e) => update('uboPercentage', e.target.value)}
                />
              </FormField>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Replace placeholder &amp; save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
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
  'Drie partijen: uw organisatie (Merchant), TinTel BV (PAY, vergunninghouder betaalinstelling) en Cyberlife B.V. (Alliance).',
  'PAY levert de betaaldiensten via het Alliance-pakket voor onbeperkte duur; opzegging is op elk moment mogelijk via het PAY administratiepaneel.',
  'PAY belast de vergoedingen door aan Alliance zolang de overeenkomst tussen Merchant en Alliance loopt.',
  'Merchant verklaart kennis te hebben genomen van de Algemene Voorwaarden van PAY en deze te accepteren.',
  'Geïnde bedragen worden periodiek integraal doorgestort op de zakelijke bankrekening (SEPA) van Merchant.',
];

function AgreementSignRow({
  organization,
  doc,
  onUpdated,
}: {
  organization: OrganizationProp;
  doc: OrganizationKycDocument;
  onUpdated: (doc: OrganizationKycDocument) => void;
}) {
  const needsAction = doc.status === 'requested' || doc.status === 'rejected';
  const [expanded, setExpanded] = useState(needsAction);
  const [signeeName, setSigneeName] = useState('');
  const [signedPlace, setSignedPlace] = useState(organization.city ?? '');
  const [signing, setSigning] = useState(false);
  const [, forceRender] = useState(0);
  const sigRef = useRef<SignaturePadHandle>(null);

  const isRejected = doc.status === 'rejected';
  const isSigned = !needsAction;
  const hasSignature = !sigRef.current?.isEmpty();
  const canSign = signeeName.trim().length > 0 && signedPlace.trim().length > 0 && hasSignature && !signing;

  const merchantParagraph = buildMerchantParagraph(
    {
      name: organization.name,
      city: organization.city,
      address_street: organization.address_street,
      address_house_number: organization.address_house_number,
      kvk_number: organization.kvk_number,
    },
    signeeName.trim() || '[uw naam]',
  );

  const today = new Date().toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  async function handleSign() {
    const dataUrl = sigRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error('Teken uw handtekening in het vak.');
      return;
    }
    if (!signeeName.trim() || !signedPlace.trim()) return;
    setSigning(true);
    try {
      const res = await fetch(`/api/organizations/${organization.id}/merchant/sign-agreement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentCode: doc.paynl_document_code,
          signeeName: signeeName.trim(),
          signedPlace: signedPlace.trim(),
          signatureDataUrl: dataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ondertekenen mislukt');
      onUpdated({ ...doc, status: data.status ?? 'uploaded', uploaded_at: data.uploadedAt ?? new Date().toISOString() });
      setExpanded(false);
      toast.success('Overeenkomst ondertekend en verstuurd naar Pay.nl');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ondertekenen mislukt');
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="rounded-md border border-[rgba(128,128,128,0.2)] overflow-hidden">
      {/* Header row */}
      <div
        className={cn(
          'flex items-center gap-3 justify-between p-3',
          isRejected && 'bg-red-50 dark:bg-red-950/20',
        )}
      >
        <div className="flex items-center gap-3">
          {isRejected ? (
            <XCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          ) : isSigned ? (
            <FileCheck2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Upload className="h-5 w-5 flex-shrink-0 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium">
              Samenwerkingsovereenkomst (PAY × Alliance × Merchant)
              <span className="ml-1 text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dutch cooperation agreement — review and sign by drawing your signature. No upload needed.
            </p>
            <p className="mt-1 text-xs">
              Status:{' '}
              <span
                className={cn(
                  'font-medium',
                  isRejected && 'text-red-700 dark:text-red-400',
                )}
              >
                {isRejected
                  ? 'rejected — re-sign required'
                  : isSigned
                    ? doc.status === 'accepted'
                      ? 'accepted by Pay.nl ✓'
                      : 'signed & submitted'
                    : 'signature required'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {/* View signed PDF — visible whenever there's something to view */}
          {doc.status !== 'requested' && (
            <a
              href={`/api/organizations/${organization.id}/merchant/agreement/download?docId=${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            >
              View signed PDF
            </a>
          )}
          {needsAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Collapse' : isRejected ? 'Re-sign' : 'Review & Sign'}
            </Button>
          )}
        </div>
      </div>

      {/* Rejection banner */}
      {isRejected && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          Pay.nl heeft de overeenkomst afgewezen. Controleer de reden in uw Pay.nl
          dashboard en onderteken een nieuwe versie hieronder.
        </div>
      )}

      {/* Expanded agreement + signature form */}
      {expanded && needsAction && (
        <div className="border-t border-[rgba(128,128,128,0.2)] p-4 space-y-4">
          {/* Key terms summary */}
          <div className="rounded-md bg-slate-50 dark:bg-slate-900 border border-[rgba(128,128,128,0.15)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Kernvoorwaarden in het kort
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

          {/* Full agreement text — scrollable, verbatim Dutch (matches PDF) */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Volledige overeenkomst
            </p>
            <div className="h-72 overflow-y-auto rounded-md border border-[rgba(128,128,128,0.2)] bg-white dark:bg-black p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-bold text-center text-sm">SAMENWERKINGSOVEREENKOMST</p>

              <p className="font-semibold pt-2">ONDERGETEKENDEN</p>
              <p>{merchantParagraph}</p>
              <p>&amp;</p>
              <p>{buildPayParagraph()}</p>

              <p className="font-semibold pt-2">VERKLAREN TE ZIJN OVEREENGEKOMEN ALS VOLGT</p>
              {AGREEMENT_ARTICLES.map((a) => (
                <p key={a.id}>
                  <strong>{a.id}</strong>&nbsp;&nbsp;{a.body}
                </p>
              ))}

              <p className="font-semibold pt-2">ALDUS GELEZEN EN AKKOORD BEVONDEN</p>
              <p className="text-slate-500">
                Twee kolommen: Merchant (ondertekend door u hieronder) | PAY ({PAY_PARTY.representative}).
              </p>

              <p className="pt-3 text-[10px] text-slate-400">
                PAY contactgegevens: {PAY_PARTY.name} — KVK {PAY_PARTY.kvk} — BTW {PAY_PARTY.btw} — IBAN {PAY_PARTY.iban} — BIC {PAY_PARTY.bic} — TEL {PAY_PARTY.tel}. Alliance: {ALLIANCE_PARTY.name}, {ALLIANCE_PARTY.addressLine}, KvK {ALLIANCE_PARTY.kvk}.
              </p>
            </div>
          </div>

          {/* Signature form */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Uw handtekening
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sig-name" className="text-xs">Naam</Label>
                <Input
                  id="sig-name"
                  value={signeeName}
                  onChange={(e) => setSigneeName(e.target.value)}
                  placeholder="bv. Mohamed Suleyman"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sig-place" className="text-xs">Plaats</Label>
                <Input
                  id="sig-place"
                  value={signedPlace}
                  onChange={(e) => setSignedPlace(e.target.value)}
                  placeholder="bv. Eindhoven"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Datum: {today} (automatisch)
            </p>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Voor akkoord — teken hieronder</Label>
                <button
                  type="button"
                  onClick={() => {
                    sigRef.current?.clear();
                    forceRender((n) => n + 1);
                  }}
                  className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                >
                  Wissen
                </button>
              </div>
              <SignaturePad
                ref={sigRef}
                width={480}
                height={140}
                className="w-full max-w-[480px]"
                onStrokeStart={() => forceRender((n) => n + 1)}
              />
            </div>

            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Door te ondertekenen bevestig ik dat ik bevoegd ben om {organization.name} te binden en
              dat deze getekende handtekening dezelfde rechtskracht heeft als een handgeschreven
              handtekening onder Verordening (EU) Nr. 910/2014 (eIDAS).
            </p>

            <Button
              onClick={handleSign}
              disabled={!canSign}
              size="sm"
            >
              {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {signing
                ? 'Ondertekenen & uploaden…'
                : isRejected
                  ? 'Opnieuw ondertekenen & versturen'
                  : 'Ondertekenen & versturen naar Pay.nl'}
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

  const isRejected = doc.status === 'rejected';
  const hasUpload = doc.status !== 'requested' && !isRejected;
  const inputId = `doc-${doc.id}`;
  // Rejected docs must be re-uploaded — don't block on `status === 'accepted'`
  // if it was re-rejected after acceptance (Pay.nl can flip state back).
  const effectiveDisabled = disabled || !documentCode || doc.status === 'accepted';

  const statusLabel = (() => {
    switch (doc.status) {
      case 'requested':
        return 'awaiting upload';
      case 'uploaded':
        return 'uploaded';
      case 'forwarded':
        return 'sent to Pay.nl';
      case 'accepted':
        return 'accepted ✓';
      case 'rejected':
        return 'rejected — re-upload required';
      default:
        return doc.status;
    }
  })();

  return (
    <div
      className={cn(
        'rounded-md border p-3 space-y-2',
        isRejected
          ? 'border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10'
          : 'border-[rgba(128,128,128,0.2)]',
      )}
    >
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-start gap-3">
          {isRejected ? (
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          ) : hasUpload ? (
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
              Status:{' '}
              <span
                className={cn(
                  'font-medium',
                  isRejected && 'text-red-700 dark:text-red-400',
                  doc.status === 'accepted' && 'text-emerald-700 dark:text-emerald-400',
                )}
              >
                {statusLabel}
              </span>
            </p>
            {isRejected && (
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                Pay.nl asked for a new version. Check your Pay.nl dashboard for the reason, then upload a corrected file.
              </p>
            )}
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
              variant={isRejected ? 'default' : 'outline'}
              size="sm"
              disabled={uploading || effectiveDisabled}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {doc.status === 'accepted'
                ? 'Accepted'
                : isRejected
                  ? 'Re-upload'
                  : hasUpload
                    ? 'Replace'
                    : 'Upload'}
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
