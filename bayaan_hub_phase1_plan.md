# Bayaan Hub × Pay. — Phase 1 Integration Plan

**For:** Claude Code  
**Project:** Bayaan Hub donation platform  
**Phase:** 1 — Sandbox build (single mosque, no Alliance sub-merchant API yet)  
**Stack:** Next.js (frontend + API routes), Supabase (database), Pay. REST API (payments)

---

## Context

Bayaan Hub is a multi-tenant donation platform for mosques. It integrates with Pay.nl as an Alliance partner, meaning each mosque will eventually be a Pay. sub-merchant managed via API. In Phase 1, we build and test the full payment flow in sandbox against a single Pay. account (Bayaan Hub's own), before Alliance rights are granted. When Alliance is active, the only change is swapping `serviceId` values per mosque.

**Pay. API endpoints:**
- `https://connect.pay.nl` — TGU (Transaction Gateway Unit): orders, mandates, direct debits
- `https://rest.pay.nl` — GMS (Global Management System): merchant management, statistics, clearing

**Authentication:** Basic Auth — `AT-XXXX-XXXX` (token code) as username, API token (40-char hash) as password. Alternatively `SL-XXXX-XXXX` (service ID) as username, secret as password.

**Sandbox activation:** Pass `"integration": { "test": true }` in any Order:Create request, OR toggle the sales location to Test mode in my.pay.nl, OR use `paymentMethod.id: 613`.

---

## Environment Variables Required

```env
# Pay. credentials (from my.pay.nl → Merchant → Company information)
PAYNL_TOKEN_CODE=AT-XXXX-XXXX
PAYNL_API_TOKEN=<40-char hash>

# Pay. sales location (from my.pay.nl → Settings → Sales locations)
PAYNL_SERVICE_ID=SL-XXXX-XXXX
PAYNL_SERVICE_SECRET=<40-char hash>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx

# App
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
PAYNL_EXCHANGE_SECRET=<random string for webhook verification>
```

---

## Supabase Schema

Run these migrations in order.

### Table: `campaigns`

```sql
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null,           -- future: references mosques(id)
  slug text not null unique,         -- used in URL: /donate/[mosque]/[slug]
  title text not null,
  description text,
  goal_amount integer,               -- in cents
  cause_type text,                   -- e.g. 'zakat', 'sadaqah', 'renovation'
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### Table: `transactions`

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  paynl_order_id text unique,        -- e.g. "47601470092X44e6"
  paynl_service_id text,             -- SL-code used
  amount integer not null,           -- in cents
  currency text default 'EUR',
  payment_method text,               -- 'ideal', 'card', 'bancontact', etc.
  status text default 'PENDING',     -- PENDING | PAID | CANCEL | EXPIRED
  donor_name text,
  donor_email text,
  stats_extra1 text,                 -- campaign ID
  stats_extra2 text,                 -- cause type
  stats_extra3 text,                 -- mosque code
  is_test boolean default false,
  created_at timestamptz default now(),
  paid_at timestamptz
);
```

### Table: `mandates`

```sql
create table mandates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  paynl_mandate_id text unique,      -- IO-XXXX-XXXX-XXXX
  mandate_type text default 'FLEXIBLE', -- SINGLE | RECURRING | FLEXIBLE
  donor_name text not null,
  donor_email text,
  iban_owner text not null,          -- name on bank account
  -- NOTE: Full IBAN is stored at Pay. only. We store nothing sensitive.
  status text default 'PENDING',     -- PENDING | ACTIVE | CANCELLED | EXPIRED
  monthly_amount integer,            -- in cents, for display purposes
  stats_extra1 text,
  stats_extra2 text,
  stats_extra3 text,
  created_at timestamptz default now(),
  first_debit_at timestamptz         -- set when first incassocollected received
);
```

### Table: `direct_debits`

```sql
create table direct_debits (
  id uuid primary key default gen_random_uuid(),
  mandate_id uuid references mandates(id),
  paynl_directdebit_id text unique,  -- IL-XXXX-XXXX-XXXX
  paynl_order_id text,
  amount integer not null,           -- in cents
  currency text default 'EUR',
  process_date date,
  status text default 'PENDING',     -- PENDING | COLLECTED | STORNO | DECLINED
  storno_at timestamptz,
  created_at timestamptz default now(),
  collected_at timestamptz
);
```

---

## Backend API Routes

All routes live under `/app/api/` (Next.js App Router) or `/pages/api/` depending on your setup.

---

### Route 1: `POST /api/donate/one-time`

**Purpose:** Create a one-time payment order, return the Pay. checkout URL.

**Request body:**
```json
{
  "campaign_id": "uuid",
  "amount": 2500,
  "currency": "EUR",
  "donor_name": "Ahmed Al-Farouq",
  "donor_email": "ahmed@example.com",
  "return_url": "https://bayaanhub.nl/thank-you",
  "locale": "nl_NL"
}
```

**Implementation:**

```typescript
// POST /api/donate/one-time

import { createClient } from '@supabase/supabase-js'

const PAYNL_BASE = 'https://connect.pay.nl'
const auth = Buffer.from(`${process.env.PAYNL_TOKEN_CODE}:${process.env.PAYNL_API_TOKEN}`).toString('base64')

export async function POST(req: Request) {
  const body = await req.json()
  const { campaign_id, amount, currency = 'EUR', donor_name, donor_email, return_url, locale = 'nl_NL' } = body

  // Fetch campaign for stats fields
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).single()
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })

  // Call Pay. Order:Create
  const payload = {
    serviceId: process.env.PAYNL_SERVICE_ID,
    amount: { value: amount, currency },
    description: campaign.title.slice(0, 32), // max 32 chars for bank statement
    reference: `CAMPAIGN-${campaign_id.slice(0, 8)}`,
    returnUrl: return_url,
    exchangeUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/pay`,
    customer: {
      firstName: donor_name.split(' ')[0],
      lastName: donor_name.split(' ').slice(1).join(' ') || '',
      email: donor_email,
      locale,
    },
    stats: {
      extra1: campaign_id,               // campaign ID
      extra2: campaign.cause_type,       // e.g. 'zakat'
      extra3: campaign.mosque_id,        // mosque reference
      info: campaign.title,
    },
    integration: {
      test: true  // REMOVE THIS when going live
    }
  }

  const payResponse = await fetch(`${PAYNL_BASE}/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  })

  const payData = await payResponse.json()
  if (!payResponse.ok) return Response.json({ error: payData }, { status: 400 })

  // Store pending transaction in Supabase
  await supabase.from('transactions').insert({
    campaign_id,
    paynl_order_id: payData.orderId,
    paynl_service_id: process.env.PAYNL_SERVICE_ID,
    amount,
    currency,
    status: 'PENDING',
    donor_name,
    donor_email,
    stats_extra1: campaign_id,
    stats_extra2: campaign.cause_type,
    stats_extra3: campaign.mosque_id,
    is_test: true, // REMOVE when live
  })

  return Response.json({ checkout_url: payData.links.redirect })
}
```

---

### Route 2: `POST /api/donate/recurring`

**Purpose:** Create a SEPA flexible mandate and trigger the first direct debit.

**Request body:**
```json
{
  "campaign_id": "uuid",
  "amount": 1000,
  "currency": "EUR",
  "donor_name": "Fatima Benali",
  "donor_email": "fatima@example.com",
  "iban": "NL69INGB0123456789",
  "bic": "INGBNL2A",
  "iban_owner": "F. Benali",
  "process_date": "2025-05-01"
}
```

**Implementation:**

```typescript
// POST /api/donate/recurring

export async function POST(req: Request) {
  const body = await req.json()
  const { campaign_id, amount, currency = 'EUR', donor_name, donor_email, iban, bic, iban_owner, process_date } = body

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).single()
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })

  // Step 1: Create FLEXIBLE mandate
  const mandatePayload = {
    serviceId: process.env.PAYNL_SERVICE_ID,
    reference: `MANDATE-${campaign_id.slice(0, 8)}-${Date.now()}`,
    description: campaign.title.slice(0, 32),
    processDate: process_date,
    type: 'FLEXIBLE',
    customer: {
      ipAddress: '0.0.0.0', // replace with actual IP from request
      email: donor_email,
      bankAccount: { iban, bic, owner: iban_owner },
    },
    amount: { value: amount, currency },
    stats: {
      extra1: campaign_id,
      extra2: campaign.cause_type,
      extra3: campaign.mosque_id,
    },
  }

  const mandateResponse = await fetch(`https://rest.pay.nl/v2/directdebits/mandates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(mandatePayload),
  })

  const mandateData = await mandateResponse.json()
  if (!mandateResponse.ok) return Response.json({ error: mandateData }, { status: 400 })

  // Store mandate in Supabase
  const { data: mandate } = await supabase.from('mandates').insert({
    campaign_id,
    paynl_mandate_id: mandateData.code, // IO-XXXX-XXXX-XXXX
    mandate_type: 'FLEXIBLE',
    donor_name,
    donor_email,
    iban_owner,
    status: 'PENDING',
    monthly_amount: amount,
    stats_extra1: campaign_id,
    stats_extra2: campaign.cause_type,
    stats_extra3: campaign.mosque_id,
  }).select().single()

  // NOTE: First DirectDebit is processed automatically on mandate creation.
  // Subsequent debits are triggered via POST /api/mandates/[mandate_id]/debit
  // The mandate becomes ACTIVE only after first incassocollected webhook is received.

  return Response.json({
    mandate_id: mandate?.id,
    paynl_mandate_id: mandateData.code,
    status: 'PENDING',
    message: 'Mandate created. First debit will process on ' + process_date,
  })
}
```

---

### Route 3: `POST /api/mandates/[mandate_id]/debit`

**Purpose:** Trigger a subsequent debit on an active flexible mandate (for monthly recurring).

**Request body:**
```json
{
  "amount": 1000,
  "process_date": "2025-06-01",
  "description": "Monthly donation June 2025"
}
```

**Implementation:**

```typescript
// POST /api/mandates/[mandate_id]/debit

export async function POST(req: Request, { params }: { params: { mandate_id: string } }) {
  const body = await req.json()
  const { amount, process_date, description } = body

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: mandate } = await supabase.from('mandates').select('*').eq('id', params.mandate_id).single()

  if (!mandate) return Response.json({ error: 'Mandate not found' }, { status: 404 })
  if (mandate.status !== 'ACTIVE') return Response.json({ error: 'Mandate not active yet' }, { status: 400 })

  const debitPayload = {
    mandate: mandate.paynl_mandate_id,    // IO-XXXX-XXXX-XXXX
    isLastOrder: false,
    description: description || 'Monthly donation',
    processDate: process_date,
    amount: { value: amount, currency: 'EUR' },
    stats: {
      extra1: mandate.stats_extra1,
      extra2: mandate.stats_extra2,
      extra3: mandate.stats_extra3,
    },
  }

  const debitResponse = await fetch(`https://rest.pay.nl/v2/directdebits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(debitPayload),
  })

  const debitData = await debitResponse.json()
  if (!debitResponse.ok) return Response.json({ error: debitData }, { status: 400 })

  // Store direct debit record
  await supabase.from('direct_debits').insert({
    mandate_id: params.mandate_id,
    paynl_directdebit_id: debitData.id,  // IL-XXXX-XXXX-XXXX
    paynl_order_id: debitData.orderId,
    amount,
    process_date,
    status: 'PENDING',
  })

  return Response.json({ directdebit_id: debitData.id, status: 'PENDING' })
}
```

---

### Route 4: `POST /api/webhook/pay`

**Purpose:** Receive all Pay. exchange calls and update Supabase accordingly.

**This is the most critical route.** Pay. sends a POST to this URL for every payment event. It must respond with HTTP 200 quickly (within 5 seconds) or Pay. will retry.

**Exchange actions to handle:**

| Action | Meaning |
|--------|---------|
| `new_ppt` | Order paid |
| `cancel` | Order cancelled/expired |
| `incassopending` | Direct debit added to bank batch |
| `incassosend` | Direct debit sent to bank |
| `incassocollected` | Funds arrived — mandate now ACTIVE |
| `incassostorno` | Reversal — funds returned to donor |

**Implementation:**

```typescript
// POST /api/webhook/pay

export async function POST(req: Request) {
  // Pay. sends form-encoded or JSON depending on exchange method configured
  // Default is legacy key-value pairs. Parse accordingly:
  const contentType = req.headers.get('content-type') || ''
  let body: Record<string, string>

  if (contentType.includes('application/json')) {
    body = await req.json()
  } else {
    const text = await req.text()
    body = Object.fromEntries(new URLSearchParams(text))
  }

  const { action, order_id, amount, mandateId, referenceId } = body

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  switch (action) {
    case 'new_ppt': {
      // One-time payment confirmed paid
      await supabase.from('transactions')
        .update({ status: 'PAID', paid_at: new Date().toISOString() })
        .eq('paynl_order_id', order_id)
      break
    }

    case 'cancel': {
      await supabase.from('transactions')
        .update({ status: 'CANCEL' })
        .eq('paynl_order_id', order_id)
      break
    }

    case 'incassopending': {
      // First debit added to batch — link IL-code to mandate
      if (mandateId && referenceId) {
        const { data: mandate } = await supabase.from('mandates')
          .select('id').eq('paynl_mandate_id', mandateId).single()

        if (mandate) {
          await supabase.from('direct_debits').insert({
            mandate_id: mandate.id,
            paynl_directdebit_id: referenceId,
            paynl_order_id: order_id,
            amount: Math.round(parseFloat(amount) * 100), // Pay. sends decimal euros
            status: 'PENDING',
          })
        }
      }
      break
    }

    case 'incassocollected': {
      // Funds arrived — activate mandate, mark debit collected
      if (referenceId) {
        await supabase.from('direct_debits')
          .update({ status: 'COLLECTED', collected_at: new Date().toISOString() })
          .eq('paynl_directdebit_id', referenceId)
      }
      if (mandateId) {
        await supabase.from('mandates')
          .update({ status: 'ACTIVE', first_debit_at: new Date().toISOString() })
          .eq('paynl_mandate_id', mandateId)
      }
      break
    }

    case 'incassostorno': {
      // Reversal — donor got money back (can happen up to 56 days after collected)
      if (referenceId) {
        await supabase.from('direct_debits')
          .update({ status: 'STORNO', storno_at: new Date().toISOString() })
          .eq('paynl_directdebit_id', referenceId)
      }
      // TODO: Notify mosque admin via your notification system
      break
    }
  }

  // Pay. requires a 200 response. Any non-200 triggers retry.
  return new Response('TRUE', { status: 200 })
}
```

**Important:** Configure retry scheme in my.pay.nl → Settings → Sales locations → Edit → Repeat call: "6 times within 2 hours". This ensures webhook delivery even if Render/Vercel has a brief outage.

---

## Frontend: Donation Page

**Route:** `/donate/[mosque]/[campaign]`

**Page structure:**

```
┌─────────────────────────────────────┐
│  [Mosque logo + name]               │
│  Campaign title                     │
│  Campaign description               │
│                                     │
│  ┌── Amount picker ──────────────┐  │
│  │  €10  │  €25  │  €50  │ Other│  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌── Frequency toggle ───────────┐  │
│  │  One-time  │  Monthly         │  │
│  └───────────────────────────────┘  │
│                                     │
│  [If Monthly: IBAN input form]      │
│   Name on account: ___________      │
│   IBAN: ______________________      │
│   Email: _____________________      │
│                                     │
│  [If One-time: Name + Email only]   │
│                                     │
│  [ Donate Now ]                     │
└─────────────────────────────────────┘
```

**Behaviour:**

- One-time: `POST /api/donate/one-time` → receive `checkout_url` → `window.location.href = checkout_url` (redirect to Pay. hosted checkout)
- Monthly: `POST /api/donate/recurring` → show confirmation screen with mandate details

**Thank-you page:** `/thank-you?order_id=XXX` — show confirmation, handle both one-time and recurring contexts.

---

## Pay. Account Setup Checklist (do this first manually)

Before writing any code, complete these steps in my.pay.nl:

1. Register at `https://signup.pay.nl` with Bayaan Hub B.V. details
2. Get credentials: Merchant → Company information → API tokens → note `AT-` code and API token
3. Create a sales location: Settings → Sales locations → Add → note `SL-` code and secret
4. Toggle sales location to **Test mode** for sandbox development
5. Enable SEPA Direct Debit: Merchant → Company information → Contract → Change contract & features → enable Direct debit
6. Enable Direct Debit on the sales location: Settings → Sales locations → [your SL] → Alternative payment methods → enable SEPA Direct Debit → add T&C URL and bank statement descriptor
7. Set up exchange webhook URL: Settings → Sales locations → [your SL] → Exchange → set URL to `https://your-ngrok-url/api/webhook/pay` (use ngrok locally)
8. Set retry scheme: Settings → Sales locations → [your SL] → Edit → Repeat call → "6 times within 2 hours"

---

## Local Development

Use `ngrok` to expose your local webhook endpoint to Pay.:

```bash
ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok.io
# Set as exchange URL in my.pay.nl: https://abc123.ngrok.io/api/webhook/pay
```

---

## Test Scenarios to Validate in Sandbox

Run these in order to confirm the integration is working end to end:

| # | Test | Expected result |
|---|------|----------------|
| 1 | POST `/api/donate/one-time` with €10 | Returns `checkout_url`, transaction row created in Supabase with status PENDING |
| 2 | Open `checkout_url`, complete sandbox payment | Webhook fires `new_ppt`, transaction status → PAID |
| 3 | Open `checkout_url`, click cancel | Webhook fires `cancel`, transaction status → CANCEL |
| 4 | POST `/api/donate/recurring` with test IBAN `NL69INGB0123456789` | Mandate row created with status PENDING, IO-code stored |
| 5 | Wait for `incassopending` webhook | Direct debit row created in Supabase |
| 6 | Wait for `incassocollected` webhook | Mandate status → ACTIVE, direct debit → COLLECTED |
| 7 | POST `/api/mandates/[id]/debit` (second debit) | New IL-code created, second direct_debits row inserted |
| 8 | Simulate storno in sandbox | `incassostorno` webhook fires, direct debit → STORNO |

---

## What Is NOT in Phase 1 (deferred to Phase 2 / Alliance)

These require Alliance rights — build the architecture to support them but do not implement yet:

- `Merchant:Create` — programmatic mosque sub-merchant onboarding
- `Merchant:AddInvoice` — deducting Bayaan Hub platform fee from mosque balance
- `Merchant:AddClearing` — manual settlement triggers
- `Statistics:Management` — cross-mosque analytics
- Per-mosque `serviceId` routing — all Phase 1 transactions use one SL-code
- Trademark registration per mosque
- Virtual IBAN assignment per mosque (DBT flow)
- Mosque admin dashboard

---

## File Structure

```
/app
  /api
    /donate
      /one-time/route.ts
      /recurring/route.ts
    /mandates
      /[mandate_id]
        /debit/route.ts
    /webhook
      /pay/route.ts
  /donate
    /[mosque]
      /[campaign]
        /page.tsx
  /thank-you
    /page.tsx

/lib
  /paynl.ts          -- shared Pay. API client (auth headers, base URLs)
  /supabase.ts       -- Supabase client helpers

/supabase
  /migrations
    /001_campaigns.sql
    /002_transactions.sql
    /003_mandates.sql
    /004_direct_debits.sql
```

---

## Notes for Claude Code

- All amounts are in **cents** (integers) throughout. Pay. accepts and returns cents. Display by dividing by 100.
- The `exchange_url` in every API call must be the publicly accessible webhook URL — use ngrok locally.
- Never log or store the full IBAN. The `iban_owner` name is fine to store.
- The `integration.test: true` flag must be removed before going live. Wrap this in an env check: `process.env.NODE_ENV !== 'production'`.
- Pay.'s sandbox payment method ID is `613`. When using `integration.test: true`, you don't need to specify this — the sandbox screen appears automatically.
- Webhook responses must be `200 OK` with body `TRUE`. Anything else triggers Pay.'s retry scheme.
- The mandate is only active after `incassocollected` — do not allow a second debit call until `mandate.status === 'ACTIVE'`.
- For the SEPA T&C URL required for direct debit activation, use `https://bayaanhub.nl/terms/sepa` (create this page with basic SEPA mandate terms before enabling the feature).
