import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { sendEmail } from '@/lib/email/email-service';
import { ConfirmSignupEmail } from '@/lib/email/templates/ConfirmSignupEmail';
import { PasswordResetEmail } from '@/lib/email/templates/PasswordResetEmail';
import { EmailChangeEmail } from '@/lib/email/templates/EmailChangeEmail';
import { MagicLinkEmail } from '@/lib/email/templates/MagicLinkEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase Send Email Hook receiver.
 *
 * Supabase POSTs here whenever a transactional auth email needs to be sent
 * (signup, recovery, magiclink, email_change). We verify the HMAC signature,
 * pick the matching branded React Email template, and send via Resend.
 *
 * Configure in Supabase Dashboard:
 *   Authentication → Hooks → Send Email Hook → enable HTTP, point at this URL,
 *   paste the same secret as SUPABASE_AUTH_HOOK_SECRET.
 *
 * Payload shape (from Supabase docs):
 *   {
 *     user: { id, email, ... },
 *     email_data: {
 *       token: string,
 *       token_hash: string,
 *       redirect_to: string,
 *       email_action_type: 'signup' | 'recovery' | 'invite' | 'magiclink'
 *                        | 'email_change' | 'email_change_current'
 *                        | 'email_change_new' | 'reauthentication',
 *       site_url: string,
 *       token_new?: string,
 *       token_hash_new?: string,
 *     }
 *   }
 */

interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    new_email?: string;
    user_metadata?: { full_name?: string; [key: string]: unknown };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | 'signup'
      | 'recovery'
      | 'invite'
      | 'magiclink'
      | 'email_change'
      | 'email_change_current'
      | 'email_change_new'
      | 'reauthentication';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error('[email-hook] SUPABASE_AUTH_HOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Standard Webhooks signature verification.
  // Supabase uses the standardwebhooks spec: webhook-id, webhook-timestamp, webhook-signature.
  const headers = {
    'webhook-id': req.headers.get('webhook-id') ?? '',
    'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': req.headers.get('webhook-signature') ?? '',
  };

  const rawBody = await req.text();

  let payload: AuthHookPayload;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, headers) as AuthHookPayload;
  } catch (err) {
    console.error('[email-hook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { user, email_data } = payload;
  const userName = (user.user_metadata?.full_name as string | undefined) ?? undefined;

  // Build the absolute URL the user clicks in the email.
  // Supabase passes site_url and redirect_to; we route through /api/auth/confirm
  // which calls verifyOtp() server-side and then redirects to `next`.
  const siteUrl = email_data.site_url.replace(/\/$/, '');
  const next = email_data.redirect_to || '/dashboard';
  const buildUrl = (tokenHash: string, type: string) =>
    `${siteUrl}/api/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(
      type,
    )}&next=${encodeURIComponent(next)}`;

  try {
    switch (email_data.email_action_type) {
      case 'signup': {
        const url = buildUrl(email_data.token_hash, 'signup');
        await sendEmail({
          to: user.email,
          subject: 'Confirm your Bayaan Classroom account',
          react: ConfirmSignupEmail({ userName, confirmationUrl: url }),
          tags: [{ name: 'type', value: 'signup_confirmation' }],
        });
        break;
      }

      case 'recovery': {
        const url = buildUrl(email_data.token_hash, 'recovery');
        await sendEmail({
          to: user.email,
          subject: 'Reset your Bayaan Classroom password',
          react: PasswordResetEmail({ userName, resetUrl: url }),
          tags: [{ name: 'type', value: 'password_reset' }],
        });
        break;
      }

      case 'magiclink': {
        const url = buildUrl(email_data.token_hash, 'magiclink');
        await sendEmail({
          to: user.email,
          subject: 'Sign in to Bayaan Classroom',
          react: MagicLinkEmail({ userName, magicLinkUrl: url }),
          tags: [{ name: 'type', value: 'magic_link' }],
        });
        break;
      }

      // Sent to the NEW email address — confirms ownership of the new mailbox.
      case 'email_change':
      case 'email_change_new': {
        const url = buildUrl(email_data.token_hash_new ?? email_data.token_hash, 'email_change');
        await sendEmail({
          to: user.new_email ?? user.email,
          subject: 'Confirm your new Bayaan Classroom email',
          react: EmailChangeEmail({
            userName,
            oldEmail: user.email,
            newEmail: user.new_email ?? user.email,
            confirmationUrl: url,
            recipient: 'new',
          }),
          tags: [{ name: 'type', value: 'email_change_new' }],
        });
        break;
      }

      // Sent to the CURRENT (old) email — security notice, no action required.
      case 'email_change_current': {
        const url = buildUrl(email_data.token_hash, 'email_change');
        await sendEmail({
          to: user.email,
          subject: 'Your Bayaan Classroom email is being changed',
          react: EmailChangeEmail({
            userName,
            oldEmail: user.email,
            newEmail: user.new_email ?? '',
            confirmationUrl: url,
            recipient: 'current',
          }),
          tags: [{ name: 'type', value: 'email_change_current' }],
        });
        break;
      }

      // Not handled in this phase. Returning 200 so Supabase doesn't retry,
      // but we log so we know if these start firing.
      case 'invite':
      case 'reauthentication':
      default:
        console.warn(
          `[email-hook] Unhandled email_action_type: ${email_data.email_action_type}`,
        );
        break;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[email-hook] Failed to send email:', err);
    // Return 500 so Supabase retries — better to retry than silently drop.
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}
