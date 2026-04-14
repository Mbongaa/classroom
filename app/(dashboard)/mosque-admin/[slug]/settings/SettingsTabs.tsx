'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
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
import { Loader2, CheckCircle2, Clock, XCircle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  donations_active: boolean;
  onboarded_at: string | null;
  platform_fee_bps: number;
}

interface SettingsTabsProps {
  organization: OrganizationProp;
}

const CATEGORY_LABELS: Record<ThankYouAnimation['category'], string> = {
  celebration: 'Celebration',
  islamic: 'Islamic',
  charity: 'Charity',
};

export function SettingsTabs({ organization }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="payments" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="animation">Thank-You Animation</TabsTrigger>
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

  // Default (submitted OR pending-with-merchant) → waiting screen.
  // Covers the edge case where Pay.nl's createMerchant response returns
  // kycStatus='pending' rather than 'submitted' — we still have a merchantId,
  // so the application is in review, not un-submitted.
  return <KycPendingCard onRefresh={handleStatusRefresh} />;
}

// ---------------------------------------------------------------------------
// Onboarding form — collects KYC data and submits to the onboard endpoint
// ---------------------------------------------------------------------------

interface OnboardingFormProps {
  organization: OrganizationProp;
  onSuccess: (result: { merchantId: string; serviceId: string; kycStatus: string }) => void;
}

function OnboardingForm({ organization, onSuccess }: OnboardingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from org data where available
  const [form, setForm] = useState({
    legalName: organization.name,
    tradingName: organization.name,
    kvkNumber: '',
    vatNumber: '',
    contactEmail: organization.contact_email || '',
    contactPhone: organization.contact_phone || '',
    iban: organization.bank_iban || '',
    ibanOwner: organization.bank_account_holder || '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: organization.city || '',
    country: organization.country || 'NL',
    businessDescription: organization.description || '',
    websiteUrl: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        legalName: form.legalName,
        tradingName: form.tradingName,
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
      };

      const res = await fetch(`/api/organizations/${organization.id}/merchant/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      toast.success('Merchant application submitted successfully');
      onSuccess(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
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
            <CardTitle className="text-lg">Set up payment processing</CardTitle>
            <CardDescription>
              Register as a merchant to receive donations directly into your bank account
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business details */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Business details
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal name (as registered with KvK) *</Label>
                <Input
                  id="legalName"
                  value={form.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradingName">Trading name (shown to donors) *</Label>
                <Input
                  id="tradingName"
                  value={form.tradingName}
                  onChange={(e) => updateField('tradingName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kvkNumber">KvK number (8 digits) *</Label>
                <Input
                  id="kvkNumber"
                  value={form.kvkNumber}
                  onChange={(e) => updateField('kvkNumber', e.target.value)}
                  placeholder="12345678"
                  maxLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT number (optional)</Label>
                <Input
                  id="vatNumber"
                  value={form.vatNumber}
                  onChange={(e) => updateField('vatNumber', e.target.value)}
                  placeholder="NL123456789B01"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="businessDescription">
                Business description *
              </Label>
              <Textarea
                id="businessDescription"
                value={form.businessDescription}
                onChange={(e) => updateField('businessDescription', e.target.value)}
                placeholder="Describe what your organization does and what donations are used for..."
                rows={3}
                required
              />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="websiteUrl">Website (optional)</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={form.websiteUrl}
                onChange={(e) => updateField('websiteUrl', e.target.value)}
                placeholder="https://www.example.nl"
              />
            </div>
          </section>

          <Separator />

          {/* Contact information */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Contact information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone number</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  placeholder="+31 6 12345678"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Address */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered address
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="street">Street *</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={(e) => updateField('street', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="houseNumber">House number *</Label>
                <Input
                  id="houseNumber"
                  value={form.houseNumber}
                  onChange={(e) => updateField('houseNumber', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code *</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder="1234 AB"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country code *</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  placeholder="NL"
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
              Bank account (for settlements)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN *</Label>
                <Input
                  id="iban"
                  value={form.iban}
                  onChange={(e) => updateField('iban', e.target.value)}
                  placeholder="NL91 ABNA 0417 1643 00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibanOwner">Account holder name *</Label>
                <Input
                  id="ibanOwner"
                  value={form.ibanOwner}
                  onChange={(e) => updateField('ibanOwner', e.target.value)}
                  required
                />
              </div>
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
              {submitting ? 'Submitting...' : 'Submit application'}
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
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Status refreshed');
    } catch {
      toast.error('Could not refresh status');
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
        <h3 className="mt-4 text-lg font-semibold">Application under review</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          Your merchant application has been submitted and is being reviewed by
          Pay.nl. This typically takes 1-3 business days. Once approved, you&apos;ll
          be able to receive donations directly.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {refreshing ? 'Checking...' : 'Check status'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KYC Rejected — show rejection notice
// ---------------------------------------------------------------------------

function KycRejectedCard({ onRefresh }: { onRefresh: () => Promise<void> }) {
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
        <h3 className="mt-4 text-lg font-semibold">Application rejected</h3>
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
          Your merchant application was not approved by Pay.nl. This may be due
          to incomplete or incorrect information. Please contact our support team
          to resolve the issue and re-submit your application.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Re-check status
          </Button>
        </div>
      </CardContent>
    </Card>
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
      toast.success('Status refreshed');
    } catch {
      toast.error('Could not refresh status');
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
                <CardTitle className="text-lg">Merchant verified</CardTitle>
                <CardDescription>
                  Your organization is set up to receive donations
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
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={donationsActive ? 'default' : 'outline'}>
                  {donationsActive ? 'Donations active' : 'Donations inactive'}
                </Badge>
              </div>
            </div>
            {merchantId && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Merchant ID
                </p>
                <p className="mt-1 font-mono text-sm">{merchantId}</p>
              </div>
            )}
            {serviceId && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Service ID
                </p>
                <p className="mt-1 font-mono text-sm">{serviceId}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Platform fee
              </p>
              <p className="mt-1 text-sm">
                {(organization.platform_fee_bps / 100).toFixed(2)}%
              </p>
            </div>
            {organization.onboarded_at && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Verified since
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
          <CardTitle className="text-lg">Finance</CardTitle>
          <CardDescription>Manage your donations and campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href={`/mosque-admin/${organization.slug}/transactions`}
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">Transactions</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                View all donations
              </p>
            </a>
            <a
              href={`/mosque-admin/${organization.slug}/campaigns`}
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">Campaigns</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Manage donation causes
              </p>
            </a>
            <a
              href={`/donate/${organization.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center rounded-lg border border-[rgba(128,128,128,0.3)] p-4 text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <p className="text-sm font-medium">Donate page</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Preview public page
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">General information</CardTitle>
        <CardDescription>
          Basic details about your organization. Editing will be available in a future update.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Field label="Name" value={organization.name} />
        <Field label="Slug" value={organization.slug} mono />
        <Field label="City" value={organization.city || '—'} />
        <Field label="Country" value={organization.country} />
        <Field label="Contact email" value={organization.contact_email || '—'} />
        {organization.description && (
          <Field label="Description" value={organization.description} multiline />
        )}

        <div className="pt-2">
          <a
            href={`/donate/${organization.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            <IconExternalLink className="h-4 w-4" />
            View donate landing page
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
  const [selectedId, setSelectedId] = useState<string>(
    organization.thankyou_animation_id || DEFAULT_THANK_YOU_ANIMATION_ID,
  );
  const [, startTransition] = useTransition();
  const groups = groupAnimationsByCategory();

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
          throw new Error(data.error || 'Failed to update animation');
        }
        toast.success('Thank-you animation updated');
      } catch (err) {
        setSelectedId(previous); // rollback
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Thank-you animation</CardTitle>
        <CardDescription>
          Choose the animation donors will see after completing a successful donation. The
          cancelled-donation page is the same for everyone and is not configurable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {(Object.keys(groups) as Array<ThankYouAnimation['category']>).map((category) => {
          const items = groups[category];
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {CATEGORY_LABELS[category]}
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
                          Selected
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
