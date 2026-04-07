/**
 * /thank-you
 *
 * Fully static thank-you page. Intentionally does NOT read query params or
 * look up transaction details: an unauthenticated read of the transactions
 * table by order_id would violate the "no policies, service-role only" RLS
 * rule and expose a public API surface over donor data. Phase 2 can add a
 * mosque-admin receipt view tied to authenticated sessions.
 */
export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold leading-tight">Thank you for your donation</h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
          Your support helps the mosque continue its work. A confirmation from our payment
          provider should reach your inbox shortly.
        </p>
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Bayaan Hub</p>
      </div>
    </main>
  );
}
