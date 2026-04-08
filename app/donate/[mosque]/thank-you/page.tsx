import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ThankYouAnimationPlayer } from '@/components/thankyou-animation';

/**
 * /donate/[mosque]/thank-you
 *
 * Org-scoped thank-you / cancelled / unknown page that the donation form
 * sends Pay.nl as the `returnUrl`. After completion (paid OR cancelled),
 * Pay.nl redirects the donor here with a status query parameter:
 *
 *   /donate/<slug>/thank-you?id=...&statusAction=PAID&statusCode=100
 *   /donate/<slug>/thank-you?id=...&statusAction=CANCEL&statusCode=-90
 *
 * The page fetches the organization by slug (via the public RLS policy on
 * `organizations` for donations-active rows), so the donor sees a message
 * personalized to the org they donated to — different orgs get different
 * copy even though they share the same code path.
 *
 * Security note: we ONLY read the status from the URL — we never query the
 * `transactions` table. The transactions table contains donor PII and has
 * RLS enabled with no policies (service-role only). Reading by order_id
 * from an unauthenticated endpoint would leak donor data to anyone who
 * guessed an id. The statusAction query param is already public (Pay.nl
 * puts it in the URL itself, visible to anyone who saw the redirect), so
 * branching on it does not leak anything new.
 *
 * Phase 2 may add an authenticated org-admin receipt view that DOES query
 * the DB, scoped via organization_members RLS.
 */

interface PageProps {
  params: Promise<{ mosque: string }>;
  searchParams: Promise<{
    statusAction?: string;
    statusCode?: string;
    id?: string;
    reference?: string;
  }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  thankyou_animation_id: string | null;
}

type Outcome = 'paid' | 'cancelled' | 'unknown';

function classifyStatus(statusAction: string | undefined): Outcome {
  const action = (statusAction || '').toUpperCase();
  if (action === 'PAID') return 'paid';
  if (
    action === 'CANCEL' ||
    action === 'CANCELLED' ||
    action === 'CANCELED' ||
    action === 'EXPIRED' ||
    action === 'DENIED' ||
    action === 'FAILURE' ||
    action === 'REFUND' ||
    action === 'CHARGEBACK'
  ) {
    return 'cancelled';
  }
  return 'unknown';
}

function copyFor(outcome: Outcome, orgName: string): { title: string; body: string } {
  switch (outcome) {
    case 'paid':
      return {
        title: `Thank you for supporting ${orgName}`,
        body: `Your donation has been received. ${orgName} thanks you for your generosity — a confirmation from our payment provider should reach your inbox shortly.`,
      };
    case 'cancelled':
      return {
        title: `Your donation to ${orgName} was cancelled`,
        body: `No payment has been taken. If this was a mistake, you can return to ${orgName}'s page and try again whenever you're ready.`,
      };
    case 'unknown':
      return {
        title: `Welcome to ${orgName}`,
        body: `If you were in the middle of a donation, please return to a campaign page to finish it.`,
      };
  }
}

export default async function MosqueThankYouPage({ params, searchParams }: PageProps) {
  const { mosque: slug } = await params;
  const sp = await searchParams;
  const outcome = classifyStatus(sp.statusAction);

  // Fetch organization via the public RLS policy on donation-active orgs.
  const supabase = await createClient();
  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, description, city, thankyou_animation_id')
    .eq('slug', slug)
    .eq('donations_active', true)
    .single();

  if (!organization) {
    notFound();
  }

  const copy = copyFor(outcome, organization.name);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full text-center duration-700 ease-out animate-in fade-in slide-in-from-bottom-4">
          {outcome === 'paid' && (
            <div className="mx-auto mb-4 flex justify-center delay-150 duration-500 animate-in fade-in zoom-in-50">
              <ThankYouAnimationPlayer
                kind="paid"
                animationId={organization.thankyou_animation_id}
                size={320}
              />
            </div>
          )}

          {outcome === 'cancelled' && (
            <div className="mx-auto mb-4 flex justify-center delay-150 duration-500 animate-in fade-in zoom-in-50">
              <ThankYouAnimationPlayer kind="cancelled" size={560} />
            </div>
          )}

          <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {organization.city ? `${organization.city} · Bayaan Hub` : 'Bayaan Hub'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{copy.title}</h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">{copy.body}</p>

          {outcome === 'cancelled' && (
            <div className="mt-8 delay-300 duration-500 animate-in fade-in">
              <Link
                href={`/donate/${organization.slug}`}
                className="inline-flex items-center rounded-md border border-[rgba(128,128,128,0.3)] bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-slate-100 dark:bg-black dark:text-white dark:hover:bg-slate-900"
              >
                Try again
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
