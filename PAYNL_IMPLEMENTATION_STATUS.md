# Pay.nl Implementation Status

**Last updated:** 2026-04-08
**Current phase:** Phase 2 built, untested. Phase 1 done + tested.
**Tenant model:** `organizations` (consolidated — `mosques` table no longer exists)

This is the **canonical reference** for where the Pay.nl integration stands. For
the original Phase 1 design rationale (sandbox build, single-mosque, why we use
TGU vs GMS, idempotency strategy etc.) see `bayaan_hub_phase1_plan.md` — that
document is historical but still accurate for the protocol-level decisions.

---

## TL;DR — what works right now

| Capability | Status | Tested? |
|---|---|---|
| One-time donation flow (Pay.nl Order create + redirect + webhook → PAID) | ✅ Built | ✅ Yes (sandbox, end-to-end) |
| Recurring donation flow (FLEXIBLE mandate + first debit → ACTIVE) | ✅ Built | ✅ Yes (sandbox, end-to-end) |
| Subsequent debits against active mandates | ✅ Built | ✅ Yes (sandbox) |
| Webhook handler (TGU + GMS shapes, idempotent, audit log) | ✅ Built | ✅ Yes (84 unit tests pass) |
| Per-org Pay.nl service-id resolver (Phase 2 multi-tenant routing) | ✅ Built | ❌ Not tested |
| Pay.nl Alliance API client (createMerchant, addInvoice, addClearing, stats) | ✅ Built | ❌ Not tested (Alliance not yet activated by Pay.nl) |
| Org-admin dashboard at `/mosque-admin/[slug]` (donations, transactions, status) | ✅ Built | ❌ Not tested |
| Org settings — thank-you animation picker | ✅ Built | ❌ Not tested |
| Translation ↔ Finance dashboard toggle in header | ✅ Built | ❌ Not tested |

**Bikinini is the test org.** It has `donations_active=true`, `kyc_status='approved'`,
`platform_fee_bps=200`, no `paynl_service_id` (uses env-var fallback).

---

## Architecture overview

### One tenant table

There is **one** tenant entity: `public.organizations`. It owns:

- Stripe billing (`stripe_*`, `subscription_*`) — independent feature
- Classrooms / sessions / members — the existing translation product
- Pay.nl donations — the new donation infrastructure (this doc)

Pay.nl-specific columns on `organizations`:

```
description, contact_email, contact_phone, city, country,
bank_iban, bank_account_holder,
paynl_service_id, paynl_merchant_id, paynl_secret,
platform_fee_bps, kyc_status, donations_active,
onboarded_at, thankyou_animation_id
```

`donations_active` is the feature flag — donor-facing pages filter by this. It
is **independent** of `subscription_status` (Stripe).

### Membership / authorization

`organization_members` with role `'admin' | 'teacher' | 'student'` is the
single source of truth for tenant membership. There is no `mosque_members`.

`requireOrgAdmin(orgId, allowedRoles)` in `lib/api-auth.ts` is the API-route
guard. Superadmins (`profiles.is_superadmin = true`) bypass org checks.

### Donation flow (end-to-end)

```
Donor visits /donate/[orgSlug]/[campaignSlug]
        ↓ submits DonationForm
POST /api/donate/one-time   (or /recurring)
        ↓ resolveOrganizationServiceIdForCampaign() picks SL- (org or env)
        ↓ createOrder() / createMandate() to Pay.nl TGU
        ↓ insert PENDING transactions / mandates row
        ↓ return checkout_url
Donor completes payment at Pay.nl hosted checkout
        ↓ Pay.nl redirects to /donate/[orgSlug]/thank-you?statusAction=PAID
        ↓ Pay.nl POSTs/GETs /api/webhook/pay?token=...
        ↓ parseWebhookEvent() → typed event union
        ↓ idempotent UPDATE on transactions / mandates / direct_debits
        ↓ exchange_events row inserted as audit log
```

### Multi-tenant Pay.nl routing (Phase 2)

`lib/paynl-organization-resolver.ts`:

1. Load campaign + its `organizations` row
2. If `donations_active && paynl_service_id` → use the org's own SL- (multi-tenant)
3. Else fall back to `process.env.PAYNL_SERVICE_ID` (Phase 1 single location)

When Alliance is fully rolled out and every org has its own service id, the
env var fallback can be retired.

---

## File inventory

### Library code (`lib/`)

| File | Lines | Purpose |
|---|---:|---|
| `lib/paynl.ts` | 436 | Core TGU/GMS HTTP client. Auth caching, sandbox toggle, `createOrder`, `createMandate`, `triggerDirectDebit`, `fetchOrderStatus`, `fetchMandateStatus`, `parseExchangeBody`, `redactPII`, `parseAmountToCents`, `PayNLError` |
| `lib/paynl-webhook.ts` | 217 | Webhook event parser. `parseWebhookEvent()` returns a discriminated union (`order.paid`, `order.cancelled`, `directdebit.pending/sent/collected/storno`, `ignored`, `unknown`). `auditFieldsFor()` extracts log fields |
| `lib/paynl-alliance.ts` | 261 | Pay.nl Alliance API client. `createMerchant`, `getMerchant`, `addInvoice`, `addClearing`, `getMerchantStats`. Throws `PayNLAllianceNotActivatedError` when Alliance is not yet enabled on the account |
| `lib/paynl-organization-resolver.ts` | 105 | Per-org → SL- resolver with env-var fallback. Used by both donation routes |
| `lib/rate-limit.ts` | 68 | In-memory IP rate limiter (10 req/min). Donation routes only. Replace with Redis/Upstash before production |
| `lib/api-auth.ts` | 327 | Route guards: `requireAuth`, `requireTeacher`, `requireAdmin`, `requireSuperAdmin`, `requireOrgMember`, `requireOrgAdmin` |
| `lib/thankyou-animations.ts` | 110 | dotLottie animation catalog for the thank-you page. `THANK_YOU_ANIMATIONS`, `DEFAULT_THANK_YOU_ANIMATION_ID`, `CANCELLED_ANIMATION` |

### API routes (`app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/api/donate/one-time` | POST | Public. Create Pay.nl Order, return checkout URL. Rate-limited |
| `/api/donate/recurring` | POST | Public. Create FLEXIBLE SEPA mandate. Rate-limited. **PII rule:** full IBAN/BIC forwarded to Pay.nl, never stored locally |
| `/api/webhook/pay` | GET, POST | Pay.nl exchange. Token-secured, idempotent, audit-logged. Always returns `200 TRUE\|` |
| `/api/mandates/[mandate_id]/debit` | POST | Trigger a subsequent debit on an ACTIVE mandate. Superadmin only (Phase 2 will switch to org admin) |
| `/api/organizations/[id]/donation-settings` | GET, PATCH | Read/update donation-related org fields. Org admin OR superadmin. Animation picker calls this. Superadmin-only fields: `platform_fee_bps`, `donations_active`, `kyc_status`, `paynl_service_id`, `paynl_merchant_id` |

### UI routes (`app/`)

| Route | Purpose |
|---|---|
| `/donate/[mosque]/[campaign]` | Public donation page. Anon Supabase client. `mosque` = org slug |
| `/donate/[mosque]/thank-you` | Org-scoped post-payment page. Branches on `?statusAction=` |
| `/thank-you` | Generic post-payment fallback (no org branding) |
| `/mosque-admin/[slug]` | Finance dashboard. Donations summary, recent transactions, Pay.nl routing status |
| `/mosque-admin/[slug]/settings` | Settings tabs: General (read-only) + Thank-You Animation picker |
| `/mosque-admin/[slug]/layout.tsx` | Wraps the finance dashboard in `DashboardHeader` with the translation↔finance toggle |
| `/dashboard/*` | Existing translation dashboard. `DashboardHeader` now has the same toggle, fetched orgSlug from `profiles.organization_id` |

### Components

| Component | Purpose |
|---|---|
| `components/dashboard-mode-toggle.tsx` | Segmented pill: translation icon ↔ finance icon. Disabled finance side when user has no primary org |
| `components/thankyou-animation.tsx` | dotLottie player wrapper (`ssr: false`) for paid/cancelled animations |
| `app/dashboard/dashboard-header.tsx` | Shared header used by both translation and finance layouts. Props: `currentMode`, `orgSlug`, `showSidebarTrigger` |

### Database migrations

| Migration | What it does |
|---|---|
| `20260407_01_create_campaigns.sql` | `campaigns` (originally with loose `mosque_id`) |
| `20260407_02_create_transactions.sql` | `transactions`, RLS enabled with no policies (service role only) |
| `20260407_03_create_mandates.sql` | `mandates`, service-role only. **No IBAN persisted** |
| `20260407_04_create_direct_debits.sql` | `direct_debits`, service-role only |
| `20260407_05_create_exchange_events.sql` | `exchange_events` audit log, service-role only |
| `20260408_01_create_mosques.sql` | ⚠️ **Superseded** — created the now-removed `mosques` table |
| `20260408_02_link_campaigns_and_mosque_rls.sql` | ⚠️ **Superseded** — added FK + mosque-based RLS, all torn down by `_03` |
| `20260408_03_consolidate_mosques_into_organizations.sql` | **Current state.** Adds Pay.nl columns to `organizations`, drops `mosques` + `mosque_members`, repoints `campaigns.mosque_id → organization_id`, replaces all RLS with `organization_members`-based versions, adds public `donations_active` SELECT policy |

> The two superseded migrations are kept on disk for the historical record but
> their effects are fully reversed by `_03`. New environments only need `_03`
> applied after `_01` and `_02` ran (or you can squash the three into one).

### Tests

- `lib/paynl.test.ts` — 26 tests
- `lib/paynl-webhook.test.ts` — 48 tests
- `test-webhook.ps1`, `test-cancel-webhook.ps1` — manual webhook smoke tests

**All 84 paynl unit tests passing.** Run with `pnpm test -- --run lib/paynl`.

---

## Database schema (current)

### `organizations` (Pay.nl-relevant columns only)

```sql
paynl_service_id     text UNIQUE              -- SL-XXXX-XXXX. NULL → env fallback
paynl_merchant_id    text UNIQUE              -- Pay.nl Alliance merchant id
paynl_secret         text                     -- ⚠️ Phase 2.5: encrypt at rest with pgcrypto
platform_fee_bps     integer NOT NULL DEFAULT 200   -- 200 bps = 2.00%
kyc_status           text NOT NULL DEFAULT 'pending'
                     CHECK IN ('pending','submitted','approved','rejected')
donations_active     boolean NOT NULL DEFAULT false  -- feature flag (NOT subscription_status)
onboarded_at         timestamptz
thankyou_animation_id text                    -- slug from THANK_YOU_ANIMATIONS catalog
contact_email, contact_phone, city, country, description,
bank_iban, bank_account_holder
```

### `campaigns`

```sql
id, organization_id (FK → organizations, ON DELETE RESTRICT), slug UNIQUE,
title, description, goal_amount, cause_type, is_active, created_at, updated_at
```

### `transactions`, `mandates`, `direct_debits`, `exchange_events`

Schemas unchanged from Phase 1. RLS enabled with **no INSERT/UPDATE/DELETE
policies** — these tables are mutated only by webhook handlers running with
the service role. Mosque admins / org members can SELECT via the policies
created in `_03`, scoped through `campaign → organization → organization_members`.

---

## Environment variables

```env
# Pay.nl credentials (my.pay.nl → Merchant → Company information)
PAYNL_TOKEN_CODE=AT-XXXX-XXXX
PAYNL_API_TOKEN=<40-char hash>

# Pay.nl sales location (my.pay.nl → Settings → Sales locations)
# This is the platform-wide fallback. Per-org SL-codes live on
# organizations.paynl_service_id once Alliance is enabled.
PAYNL_SERVICE_ID=SL-XXXX-XXXX
PAYNL_SERVICE_SECRET=<40-char hash>

# Webhook auth (random string, used in ?token= query param)
PAYNL_EXCHANGE_SECRET=<random string>

# Sandbox toggle — set to "true" while developing
PAYNL_SANDBOX_MODE=true

# Pay.nl base URLs (rarely overridden)
PAYNL_CONNECT_BASE_URL=https://connect.pay.nl
PAYNL_REST_BASE_URL=https://rest.pay.nl

# App URL (used to build the exchangeUrl Pay.nl posts back to)
NEXT_PUBLIC_SITE_URL=https://bayaan.app
```

---

## What's left

### Phase 2 verification (NEXT — not yet done)

1. **End-to-end test on bikinini.** Create a campaign, donate via the donate
   page, verify the dashboard at `/mosque-admin/bikinini` shows the
   transaction, verify the thank-you page renders with the picked animation
2. **Verify the toggle.** Translation → finance and back, on both dashboards
3. **Settings PATCH.** Pick a different thank-you animation as an org admin,
   confirm the picker writes to `/api/organizations/[id]/donation-settings`
   and the value persists to `organizations.thankyou_animation_id`

### Phase 2.5 — security/UX polish before public launch

- **Encrypt `paynl_secret` at rest** with pgcrypto. Currently stored as plain
  text on `organizations`
- **Replace in-memory rate limiter** with Redis/Upstash. The current one is
  per-instance and won't survive horizontal scaling
- **IP allowlist for `/api/webhook/pay`.** `exchange_events.remote_ip` is
  already captured for this purpose — add the check once Pay.nl publishes
  their production IP range
- **Make `requireOrgAdmin` the gate on `/api/mandates/[id]/debit`** instead of
  `requireSuperAdmin`. The mandate's campaign already exposes `organization_id`,
  so the check is one extra query
- **Editable General tab** on `/mosque-admin/[slug]/settings`. Currently
  read-only — `description`, `contact_email`, `city`, etc. should be editable
  by org admins. The PATCH endpoint already accepts these fields
- **Re-enable order re-verification** in `handleOrderPaid` by persisting the
  Pay.nl internal UUID alongside the public orderId on the transactions row.
  Currently disabled because `/v1/orders/{id}` requires the UUID, not the
  short orderId from the webhook

### Phase 3 — Pay.nl Alliance activation

When Pay.nl enables Alliance rights on the account:

1. Build a public org-signup flow that calls `paynl-alliance.createMerchant`
   and persists the returned `serviceId` / `merchantId` / `serviceSecret`
   onto the org row, then sets `kyc_status='approved'`, `donations_active=true`,
   `onboarded_at=now()`
2. After every successful donation, schedule a `paynl-alliance.addInvoice`
   call to deduct `platform_fee_bps` from the org's wallet into Bayaan Hub's
3. Build the storno notification path (TODO comment in
   `lib/api/webhook/pay/route.ts → handleDirectDebitStorno`) — email org
   admin via Resend when a debit is reversed

### Phase 4+ — deferred

- Refunds (Pay.nl `/v1/orders/{orderId}/refund`)
- Reconciliation job to backfill transactions when the insert fails after
  Pay.nl already accepted the order (see the comments in
  `app/api/donate/one-time/route.ts` around `insertError`)
- Org-admin email notifications on every donation
- CSV export of transactions from the dashboard
- Multiple sales locations per org (e.g. one per cause)

---

## Decisions worth remembering

1. **One tenant table.** `mosques` was a mistake — it duplicated
   `organizations`. The consolidation migration (`_03`) fixes this. Never
   re-introduce a parallel tenant table for any feature
2. **Stripe and Pay.nl are independent.** `subscription_status` /
   `subscription_tier` (Stripe) have nothing to do with `donations_active` /
   `kyc_status` (Pay.nl). An org can have one without the other
3. **The route is `/mosque-admin/[slug]` even though the table is
   `organizations`.** "Mosque" is the user-facing label; the underlying
   entity is generic. Don't rename the route
4. **Webhook always returns `200 TRUE|`** — even on handler errors. Non-200
   triggers Pay.nl's retry scheme which would mask bugs. Log structured
   errors for alerting instead
5. **Donor PII never lives in our DB.** Full IBAN/BIC are forwarded to Pay.nl
   in the same request and forgotten. We store `iban_owner` (the name on the
   account) only. Pay.nl is the system of record
6. **Idempotency via `WHERE status = <previous>` guards.** Pay.nl retries up
   to 6× in 2h; every webhook UPDATE has a status guard so replays are
   no-ops. Unique constraints on `paynl_order_id` / `paynl_mandate_id` /
   `paynl_directdebit_id` handle the INSERT case
7. **No HMAC on Pay.nl webhooks.** Defense-in-depth is: timing-safe `?token=`
   check on the URL, server-side re-verification via `fetchMandateStatus`
   before mutating, IP capture in `exchange_events` for future allowlisting
