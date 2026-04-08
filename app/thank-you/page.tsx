import { ThankYouAnimationPlayer } from '@/components/thankyou-animation';

/**
 * /thank-you
 *
 * Server component that branches the message based on the `statusAction`
 * query parameter Pay.nl appends to the returnUrl on redirect:
 *
 *   /thank-you?id=...&reference=...&statusAction=PAID&statusCode=100
 *   /thank-you?id=...&reference=...&statusAction=CANCEL&statusCode=-90
 *
 * Important security note: we ONLY read the status from the URL — we never
 * query the transactions table here. The transactions table contains donor
 * PII and has RLS enabled with no policies (service-role only). Reading by
 * order_id from an unauthenticated endpoint would expose donor data to
 * anyone who guessed an order id.
 *
 * The statusAction query param is public information (Pay.nl puts it in
 * the URL itself, visible to anyone who saw the redirect), so branching on
 * it does not leak anything.
 *
 * Phase 2 may add an authenticated mosque-admin receipt view that DOES
 * query the DB, scoped via organization_members RLS.
 */

interface ThankYouPageProps {
  searchParams: Promise<{
    statusAction?: string;
    statusCode?: string;
    id?: string;
    reference?: string;
  }>;
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

const COPY: Record<Outcome, { title: string; body: string }> = {
  paid: {
    title: 'Thank you for your donation',
    body: 'Your support helps the mosque continue its work. A confirmation from our payment provider should reach your inbox shortly.',
  },
  cancelled: {
    title: 'Your donation was cancelled',
    body: 'No payment has been taken. If this was a mistake, you can return to the mosque page and try again whenever you are ready.',
  },
  unknown: {
    title: 'Thank you for visiting',
    body: 'If you were in the middle of a donation, please return to the mosque page to finish it.',
  },
};

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const params = await searchParams;
  const outcome = classifyStatus(params.statusAction);
  const copy = COPY[outcome];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full text-center duration-700 ease-out animate-in fade-in slide-in-from-bottom-4">
          {outcome === 'paid' && (
            <div className="mx-auto mb-4 flex justify-center delay-150 duration-500 animate-in fade-in zoom-in-50">
              <ThankYouAnimationPlayer kind="paid" size={320} />
            </div>
          )}

          {outcome === 'cancelled' && (
            <div className="mx-auto mb-4 flex justify-center delay-150 duration-500 animate-in fade-in zoom-in-50">
              <ThankYouAnimationPlayer kind="cancelled" size={560} />
            </div>
          )}

          <h1 className="text-3xl font-semibold leading-tight">{copy.title}</h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">{copy.body}</p>
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Bayaan Hub</p>
        </div>
      </div>
    </main>
  );
}
