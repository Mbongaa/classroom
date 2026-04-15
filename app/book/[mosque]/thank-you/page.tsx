import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

/**
 * /book/[mosque]/thank-you
 *
 * Pay.nl return target after an appointment booking. Same security model as
 * /donate/[mosque]/thank-you: the page only reads `statusAction` from the URL
 * (a value Pay.nl already put there in the open browser redirect). We never
 * query appointments or transactions from this public endpoint to avoid
 * leaking customer PII.
 */

interface PageProps {
  params: Promise<{ mosque: string }>;
  searchParams: Promise<{
    statusAction?: string;
    statusCode?: string;
    id?: string;
  }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
}

type Outcome = 'paid' | 'cancelled' | 'unknown';

function classify(statusAction: string | undefined): Outcome {
  const a = (statusAction || '').toUpperCase();
  if (a === 'PAID') return 'paid';
  if (
    a === 'CANCEL' ||
    a === 'CANCELLED' ||
    a === 'CANCELED' ||
    a === 'EXPIRED' ||
    a === 'DENIED' ||
    a === 'FAILURE'
  )
    return 'cancelled';
  return 'unknown';
}

function copyFor(outcome: Outcome, orgName: string) {
  switch (outcome) {
    case 'paid':
      return {
        title: `Your appointment with ${orgName} is booked`,
        body: `We've received your payment. A confirmation email is on its way, and the sheikh has been notified of your booking.`,
      };
    case 'cancelled':
      return {
        title: `Booking cancelled`,
        body: `No payment has been taken. You can pick another time whenever you're ready.`,
      };
    case 'unknown':
      return {
        title: orgName,
        body: `If you were in the middle of booking an appointment, please return to the booking page to finish.`,
      };
  }
}

export default async function BookingThankYouPage({ params, searchParams }: PageProps) {
  const { mosque: slug } = await params;
  const sp = await searchParams;
  const outcome = classify(sp.statusAction);

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from('organizations')
    .select<string, OrganizationRow>('id, slug, name, city')
    .eq('slug', slug)
    .eq('donations_active', true)
    .single();

  if (!organization) notFound();

  const copy = copyFor(outcome, organization.name);

  return (
    <div
      className="min-h-dvh bg-black text-foreground"
      style={
        {
          '--background': '222.2 84% 4.9%',
          '--foreground': '210 40% 98%',
          '--card': '222.2 84% 4.9%',
          '--card-foreground': '210 40% 98%',
          '--popover': '222.2 84% 4.9%',
          '--popover-foreground': '210 40% 98%',
          '--primary': '210 40% 98%',
          '--primary-foreground': '222.2 47.4% 11.2%',
          '--secondary': '217.2 32.6% 17.5%',
          '--secondary-foreground': '210 40% 98%',
          '--muted': '217.2 32.6% 17.5%',
          '--muted-foreground': '215 20.2% 65.1%',
          '--accent': '217.2 32.6% 17.5%',
          '--accent-foreground': '210 40% 98%',
          '--border': '217.2 32.6% 17.5%',
          '--input': '217.2 32.6% 17.5%',
          '--ring': '212.7 26.8% 83.9%',
        } as React.CSSProperties
      }
    >
      <main className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full text-center duration-700 ease-out animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto mb-4 flex justify-center delay-150 duration-500 animate-in fade-in zoom-in-50">
            {outcome === 'paid' && (
              <CheckCircle2Icon className="size-20 stroke-green-500" />
            )}
            {outcome === 'cancelled' && (
              <XCircleIcon className="size-20 stroke-red-500" />
            )}
          </div>

          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            {organization.city ? `${organization.city} · Bayaan Hub` : 'Bayaan Hub'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{copy.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">{copy.body}</p>

          {outcome !== 'paid' && (
            <div className="mt-8 delay-300 duration-500 animate-in fade-in">
              <Link
                href={`/book/${organization.slug}`}
                className="inline-flex items-center rounded-md border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {outcome === 'cancelled' ? 'Try again' : 'Book an appointment'}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
