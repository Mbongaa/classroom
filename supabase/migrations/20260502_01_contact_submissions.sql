-- Inbound contact form submissions from the marketing landing page.
-- Service-role inserts only (the API route uses the admin client).
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  email text not null,
  message text not null,
  source text default 'marketing-landing',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_submissions_created_at
  on public.contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;

-- No public policies — only service role can read/write.
