import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/email-service';
import { ContactSubmissionEmail } from '@/lib/email/templates/ContactSubmissionEmail';

const MAX_NAME_LEN = 200;
const MAX_ORG_LEN = 200;
const MAX_EMAIL_LEN = 320;
const MAX_MESSAGE_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Recipient for contact-form notifications. Falls back to support@bayaan.ai
 * so the form still routes somewhere if the env var is unset.
 */
const CONTACT_RECIPIENT = process.env.CONTACT_RECIPIENT || 'support@bayaan.ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const name = String(body.name ?? '').trim();
    const organization = String(body.organization ?? '').trim();
    const email = String(body.email ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!name || name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    if (organization.length > MAX_ORG_LEN) {
      return NextResponse.json({ error: 'Invalid organization' }, { status: 400 });
    }
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!message || message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    // Persist first — this is the durable record. Email is best-effort on top.
    const supabase = createAdminClient();
    const { error } = await supabase.from('contact_submissions').insert({
      name,
      organization: organization || null,
      email,
      message,
      source: 'marketing-landing',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    if (error) {
      console.error('[Contact API] Failed to insert submission:', error);
      return NextResponse.json({ error: 'Could not save submission' }, { status: 500 });
    }

    // Notify the team inbox. Failures here don't fail the request — the
    // submission is already persisted, so the user gets their success state
    // and we just log for ops to investigate.
    const submittedAt = new Date().toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }) + ' (Europe/Amsterdam)';

    void sendEmail({
      to: CONTACT_RECIPIENT,
      // Pre-fill the visitor's address so a single reply lands in their inbox.
      replyTo: email,
      subject: `[bayaan.ai contact] ${name}${organization ? ` · ${organization}` : ''}`,
      react: ContactSubmissionEmail({
        name,
        email,
        organization: organization || null,
        message,
        submittedAt,
      }),
      tags: [{ name: 'category', value: 'marketing-contact' }],
    }).catch((err) => {
      console.error('[Contact API] Email notification failed:', err);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Contact API] Handler error:', err);
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}
