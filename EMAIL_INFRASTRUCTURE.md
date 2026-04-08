# Email Infrastructure

How transactional email works in Bayaan Classroom, and what you need to do to
finish wiring it up.

## Architecture

We use **Supabase Auth's Send Email Hook** to route every auth-driven email
through **Resend** with branded React Email templates. Supabase still owns
tokens, expiry, and security; we just own presentation.

```
User action (signup / forgot password / etc.)
        │
        ▼
Supabase Auth (generates token, fires Send Email Hook)
        │
        ▼  HTTPS POST (signed)
/api/auth/email-hook        ← verifies HMAC, picks template
        │
        ▼
Resend API                  ← sends branded React Email
        │
        ▼
User clicks link in email
        │
        ▼
/api/auth/confirm           ← calls verifyOtp(), creates session
        │
        ▼
Redirected to `next` (e.g. /dashboard)
```

There are also **non-auth** emails (e.g. the existing `WelcomeEmail.tsx` for
post-Stripe-checkout subscription confirmations). Those bypass Supabase entirely
and call `sendEmail()` directly from the relevant webhook handler.

## File map

```
lib/email/
├── email-service.ts                    # sendEmail() wrapper around Resend
└── templates/
    ├── _layout.tsx                     # Shared brand wrapper (header, footer, styles)
    ├── WelcomeEmail.tsx                # Post-Stripe-checkout (non-auth)
    ├── ConfirmSignupEmail.tsx          # Auth: signup
    ├── PasswordResetEmail.tsx          # Auth: recovery
    ├── EmailChangeEmail.tsx            # Auth: email_change_current / email_change_new
    └── MagicLinkEmail.tsx              # Auth: magiclink

app/api/auth/
├── callback/route.ts                   # OAuth code exchange (existing)
├── confirm/route.ts                    # NEW: verifyOtp for email links
├── email-hook/route.ts                 # NEW: Supabase Send Email Hook receiver
└── signout/route.ts
```

## Environment variables

```bash
RESEND_API_KEY=re_...                       # Resend dashboard
EMAIL_FROM=noreply@bayaan.app               # Must be on verified Resend domain
EMAIL_FROM_NAME=Bayaan Classroom
SUPABASE_AUTH_HOOK_SECRET=v1,whsec_...      # Standard Webhooks format
NEXT_PUBLIC_SITE_URL=https://bayaan.app     # Used for email link bases
```

## Setup checklist (one-time)

### 1. Verify your sending domain in Resend

1. Go to <https://resend.com/domains> → **Add Domain** → enter `bayaan.app`
2. Resend shows you 3–4 DNS records (SPF, DKIM, optionally DMARC + return-path)
3. Add them in your DNS provider (Cloudflare, Vercel DNS, Namecheap, etc.)
4. Click **Verify** in Resend — usually propagates in a few minutes
5. Until verified, you can only send to your own Resend account email

> **Tip:** If you'd rather isolate transactional mail from your root domain,
> add `mail.bayaan.app` instead and update `EMAIL_FROM=noreply@mail.bayaan.app`.
> Most teams do this in production for deliverability hygiene.

### 2. Configure URLs in the Supabase dashboard

**Authentication → URL Configuration**:

- **Site URL**: `https://bayaan.app` (or your real production URL)
- **Redirect URLs** (add each as a separate entry):
  - `https://bayaan.app/**`
  - `https://classroom-umber.vercel.app/**` (current Vercel preview)
  - `http://localhost:3000/**` (local dev)

The `**` wildcard lets `/api/auth/confirm`, `/dashboard`, etc. all be valid
redirect targets. Supabase requires this allowlist to prevent open-redirect
abuse.

### 3. Enable the Send Email Hook

**Authentication → Hooks → Send Email Hook**:

1. Toggle **Enable**
2. Hook type: **HTTPS**
3. URL: `https://bayaan.app/api/auth/email-hook`
   *(Use your production URL here. The hook is global — it fires for ALL
   environments, so you can't run two of these at once with the same Supabase
   project. See "Local development" below.)*
4. Secret: paste the value of `SUPABASE_AUTH_HOOK_SECRET` from `.env.local`
   *(must include the `v1,whsec_` prefix)*
5. Save

### 4. Disable Supabase's built-in templates (optional but recommended)

Once the hook is live, Supabase still has its built-in email templates that
will be used as a fallback if the hook fails. They won't fire under normal
operation, but it's worth checking **Authentication → Email Templates** so
you know what the fallbacks look like.

You don't need to delete them; they're inert when the hook is enabled.

## Local development

The Send Email Hook is a single global URL per Supabase project, which means
you can't have local dev AND production both pointing at their own hook. Two
options:

**Option A: Use ngrok / cloudflared to tunnel localhost**

```bash
ngrok http 3000
# Then in Supabase dashboard, temporarily set hook URL to:
#   https://<your-ngrok-id>.ngrok.io/api/auth/email-hook
```

Switch back to production URL when done.

**Option B: Use a separate Supabase project for local dev**

Create a second Supabase project for development; point its hook at your
ngrok URL and leave the production project's hook pointed at production.

## Adding a new email template

1. Create `lib/email/templates/MyNewEmail.tsx` — wrap your content in
   `<EmailLayout preview="..." heading="...">` and use the shared `styles`
   tokens for visual consistency.

2. If it's an **auth** email, add a new `case` to the switch in
   `app/api/auth/email-hook/route.ts` for the matching `email_action_type`.

3. If it's a **transactional** email (e.g. payment receipt), import
   `sendEmail` from `lib/email/email-service` and call it from the relevant
   webhook handler / server action.

4. Tag the email in `tags: [{ name: 'type', value: 'my_email_type' }]` so
   you can filter by type in the Resend dashboard.

## Testing

### Smoke test the hook locally

```bash
# 1. Start dev server (Windows pnpm via cmd.exe — see CLAUDE.md)
cmd.exe /c "cd C:\Users\hassa\OneDrive\Desktop\Bayaan.ai\classroom && pnpm dev"

# 2. Tunnel localhost
ngrok http 3000

# 3. Update Supabase hook URL to ngrok URL (temporarily)

# 4. Trigger an auth flow:
#    - Sign up at /signup with a real email
#    - Or POST to supabase.auth.resetPasswordForEmail(email)

# 5. Check inbox + Resend dashboard for delivery
```

### Manual test plan

| Flow | Action | Expected |
|---|---|---|
| Signup | New user signs up | Branded `ConfirmSignupEmail` arrives, link → `/dashboard` |
| Password reset | Call `resetPasswordForEmail` | Branded `PasswordResetEmail` arrives, link → reset page |
| Magic link | Call `signInWithOtp` | Branded `MagicLinkEmail` arrives |
| Email change | Call `updateUser({ email })` | Two emails: one to old (notice), one to new (confirm) |

## What's NOT yet built

These are explicitly deferred — see Phase 3 in the original plan:

- **Forgot-password page** at `/forgot-password` — UI to trigger
  `resetPasswordForEmail`. The email works; the page to request it doesn't
  exist yet.
- **Reset-password page** at `/reset-password` — where users land after
  clicking the email link. Currently they'll hit `/dashboard` but be unable
  to actually change their password without a UI.
- **Email change UI** in profile/settings.
- **Payment dashboard emails** (Stripe renewal, cancellation, refund failures;
  PayNL donation receipts) — separate phase.
- **Resend webhook receiver** for delivery / bounce / complaint events.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid signature` 401 in hook logs | Secret mismatch | Verify `SUPABASE_AUTH_HOOK_SECRET` matches the secret pasted in Supabase dashboard, including the `v1,whsec_` prefix |
| Email never arrives but hook returns 200 | Domain not verified in Resend | Check `https://resend.com/domains` |
| User clicks email link → "Invalid token" | Token expired (default 1h) or already used | Request a new email |
| Hook is never called | Hook disabled OR Supabase still using built-in SMTP | Re-check Auth → Hooks toggle in Supabase dashboard |
| Email arrives but link points at wrong domain | `Site URL` in Supabase dashboard wrong | Update Auth → URL Configuration |
| Local dev doesn't get emails | Hook URL points at production | Use ngrok (see Local development) |
