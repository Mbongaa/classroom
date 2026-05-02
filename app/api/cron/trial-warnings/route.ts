import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/email-service';
import { TrialEndingEmail } from '@/lib/email/templates/TrialEndingEmail';
import { formatBillingDate, getOrgAdminContact } from '@/lib/email/billing-utils';

/**
 * GET/POST /api/cron/trial-warnings
 *
 * Daily Vercel-cron job that sends two TrialEndingEmail nudges per beta
 * org: one ~7 days out and a second ~3 days out. Each nudge is gated by
 * an idempotency timestamp on the org row (`trial_warning_7d_sent_at`
 * and `trial_warning_3d_sent_at`) so a flaky retry never double-sends.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel cron sets
 * this automatically when CRON_SECRET is configured).
 */

const CRON_SECRET = process.env.CRON_SECRET;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

// Stage configuration. Each stage matches orgs whose trial_ends_at falls
// inside a 2-day window centred on `daysOut`, and stamps the row's
// `sentColumn` once the email is dispatched.
const STAGES = [
  {
    label: '7d',
    daysOut: 7,
    windowDays: 1, // matches 6–8 days out
    sentColumn: 'trial_warning_7d_sent_at' as const,
  },
  {
    label: '3d',
    daysOut: 3,
    windowDays: 1, // matches 2–4 days out
    sentColumn: 'trial_warning_3d_sent_at' as const,
  },
];

interface TrialOrg {
  id: string;
  name: string;
  trial_ends_at: string;
  trial_warning_7d_sent_at: string | null;
  trial_warning_3d_sent_at: string | null;
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.error('[Cron trial-warnings] CRON_SECRET not configured; refusing to run.');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  const summary: Record<string, { matched: number; sent: number; failed: number }> = {};

  for (const stage of STAGES) {
    const lower = new Date(Date.now() + (stage.daysOut - stage.windowDays) * 24 * 60 * 60 * 1000);
    const upper = new Date(Date.now() + (stage.daysOut + stage.windowDays) * 24 * 60 * 60 * 1000);

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select(
        'id, name, trial_ends_at, trial_warning_7d_sent_at, trial_warning_3d_sent_at',
      )
      .eq('subscription_status', 'trialing')
      .is('stripe_subscription_id', null)
      .is(stage.sentColumn, null)
      .gte('trial_ends_at', lower.toISOString())
      .lte('trial_ends_at', upper.toISOString())
      .returns<TrialOrg[]>();

    if (error) {
      console.error(`[Cron trial-warnings] fetch failed for stage ${stage.label}:`, error);
      summary[stage.label] = { matched: 0, sent: 0, failed: 0 };
      continue;
    }

    const list = orgs ?? [];
    const stat = { matched: list.length, sent: 0, failed: 0 };

    for (const org of list) {
      const contact = await getOrgAdminContact(supabase, { organizationId: org.id });
      if (!contact) {
        stat.failed += 1;
        continue;
      }

      try {
        await sendEmail({
          to: contact.email,
          subject: `Your Bayaan trial ends ${formatBillingDate(org.trial_ends_at)}`,
          react: TrialEndingEmail({
            userName: contact.fullName,
            organizationName: contact.organizationName,
            planName: 'Pro',
            trialEndDate: formatBillingDate(org.trial_ends_at),
            amount: '€199.99',
            // Beta orgs by definition have not added a card yet — once they
            // do, the Stripe webhook flips them to 'active' and they fall
            // out of this cron's filter on the next pass.
            hasPaymentMethod: false,
            billingPortalUrl: `${SITE_URL}/billing/required`,
          }),
          tags: [
            { name: 'type', value: `trial_warning_${stage.label}` },
            { name: 'organization_id', value: org.id },
          ],
        });

        const { error: stampError } = await supabase
          .from('organizations')
          .update({ [stage.sentColumn]: new Date().toISOString() })
          .eq('id', org.id);
        if (stampError) {
          // The mail went out — log but don't count as failure. Worst case,
          // the next run sees it as un-sent and the user gets a duplicate.
          console.error(
            `[Cron trial-warnings] Failed to stamp ${stage.sentColumn} for org ${org.id}:`,
            stampError,
          );
        }

        stat.sent += 1;
      } catch (err) {
        console.error(`[Cron trial-warnings] Send failed for org ${org.id}:`, err);
        stat.failed += 1;
      }
    }

    summary[stage.label] = stat;
  }

  return NextResponse.json({ ok: true, summary });
}
