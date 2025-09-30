-- =====================================================
-- Supabase B2B Authentication Schema
-- Educational Platform with Organizations and Classrooms
-- =====================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for slug lookups
create index organizations_slug_idx on public.organizations(slug);

-- =====================================================
-- 2. PROFILES TABLE (extends auth.users)
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid references public.organizations on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'student' check (role in ('admin', 'teacher', 'student')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for common queries
create index profiles_organization_id_idx on public.profiles(organization_id);
create index profiles_role_idx on public.profiles(role);

-- =====================================================
-- 3. ORGANIZATION_MEMBERS TABLE (user-org relationships)
-- =====================================================
create table public.organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('admin', 'teacher', 'student')),
  invited_by uuid references public.profiles(id),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Unique constraint: one user can only have one role per org
  unique(organization_id, user_id)
);

-- Indexes for relationships
create index organization_members_org_id_idx on public.organization_members(organization_id);
create index organization_members_user_id_idx on public.organization_members(user_id);

-- =====================================================
-- 4. CLASSROOMS TABLE (LiveKit room metadata)
-- =====================================================
create table public.classrooms (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations on delete cascade not null,
  room_code text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text,
  settings jsonb default '{
    "language": "en",
    "enable_recording": false,
    "enable_chat": true,
    "max_participants": 100
  }'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Unique room code per organization
  unique(organization_id, room_code)
);

-- Indexes for classroom queries
create index classrooms_org_id_idx on public.classrooms(organization_id);
create index classrooms_teacher_id_idx on public.classrooms(teacher_id);
create index classrooms_room_code_idx on public.classrooms(room_code);
create index classrooms_is_active_idx on public.classrooms(is_active) where is_active = true;

-- =====================================================
-- 5. CLASSROOM_PARTICIPANTS TABLE
-- =====================================================
create table public.classroom_participants (
  id uuid primary key default uuid_generate_v4(),
  classroom_id uuid references public.classrooms on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('teacher', 'student')),
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_attended_at timestamp with time zone,

  -- Unique constraint: one user per classroom
  unique(classroom_id, user_id)
);

-- Indexes for participant queries
create index classroom_participants_classroom_id_idx on public.classroom_participants(classroom_id);
create index classroom_participants_user_id_idx on public.classroom_participants(user_id);

-- =====================================================
-- 6. SESSION_RECORDINGS TABLE (for Phase 3)
-- =====================================================
create table public.session_recordings (
  id uuid primary key default uuid_generate_v4(),
  classroom_id uuid references public.classrooms on delete set null,
  livekit_egress_id text unique,
  storage_url text,
  duration_seconds integer,
  size_bytes bigint,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for recording queries
create index session_recordings_classroom_id_idx on public.session_recordings(classroom_id);
create index session_recordings_created_by_idx on public.session_recordings(created_by);
create index session_recordings_started_at_idx on public.session_recordings(started_at desc);

-- =====================================================
-- 7. INVITATIONS TABLE (for org invites)
-- =====================================================
create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'teacher', 'student')),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamp with time zone not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- One pending invitation per email per org
  unique(organization_id, email)
);

-- Index for invitation lookups
create index invitations_email_idx on public.invitations(email) where accepted_at is null;
create index invitations_expires_at_idx on public.invitations(expires_at) where accepted_at is null;

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is in an organization
create or replace function public.is_organization_member(org_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
    and user_id = auth.uid()
  );
$$;

-- Function to get user's role in organization
create or replace function public.get_user_org_role(org_id uuid)
returns text
language sql
security definer
as $$
  select role
  from public.organization_members
  where organization_id = org_id
  and user_id = auth.uid()
  limit 1;
$$;

-- Function to check if user is classroom participant
create or replace function public.is_classroom_participant(class_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.classroom_participants
    where classroom_id = class_id
    and user_id = auth.uid()
  );
$$;

-- =====================================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =====================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Apply triggers
create trigger organizations_updated_at before update on public.organizations
  for each row execute procedure public.handle_updated_at();

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger classrooms_updated_at before update on public.classrooms
  for each row execute procedure public.handle_updated_at();

-- =====================================================
-- 10. AUTOMATIC PROFILE CREATION
-- =====================================================

-- Trigger to auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

-- Trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_participants enable row level security;
alter table public.session_recordings enable row level security;
alter table public.invitations enable row level security;

-- Organizations RLS Policies
create policy "Users can view their own organization"
  on public.organizations for select
  to authenticated
  using (
    id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Admins can update their organization"
  on public.organizations for update
  to authenticated
  using (
    id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (true);

-- Profiles RLS Policies
create policy "Users can view profiles in their organization"
  on public.profiles for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
    or id = auth.uid() -- Users can always see their own profile
  );

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Organization Members RLS Policies
create policy "Users can view members in their organization"
  on public.organization_members for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

-- Separate policies for each operation to avoid infinite recursion
create policy "Users can insert themselves as members"
  on public.organization_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Admins can update member roles"
  on public.organization_members for update
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete members"
  on public.organization_members for delete
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Classrooms RLS Policies
create policy "Organization members can view classrooms"
  on public.classrooms for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Teachers and admins can create classrooms"
  on public.classrooms for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role in ('teacher', 'admin')
    )
  );

create policy "Teachers can update their own classrooms"
  on public.classrooms for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers can delete their own classrooms"
  on public.classrooms for delete
  to authenticated
  using (teacher_id = auth.uid());

-- Classroom Participants RLS Policies
create policy "Participants can view classroom participants"
  on public.classroom_participants for select
  to authenticated
  using (
    classroom_id in (
      select id from public.classrooms
      where organization_id in (
        select organization_id
        from public.organization_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Teachers can add participants"
  on public.classroom_participants for insert
  to authenticated
  with check (
    classroom_id in (
      select id from public.classrooms
      where teacher_id = auth.uid()
    )
    or user_id = auth.uid() -- Students can self-enroll
  );

create policy "Teachers can remove participants"
  on public.classroom_participants for delete
  to authenticated
  using (
    classroom_id in (
      select id from public.classrooms
      where teacher_id = auth.uid()
    )
  );

-- Session Recordings RLS Policies
create policy "Organization members can view recordings"
  on public.session_recordings for select
  to authenticated
  using (
    classroom_id in (
      select id from public.classrooms
      where organization_id in (
        select organization_id
        from public.organization_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Teachers can create recordings"
  on public.session_recordings for insert
  to authenticated
  with check (created_by = auth.uid());

-- Invitations RLS Policies
create policy "Admins can view invitations"
  on public.invitations for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can manage invitations"
  on public.invitations for all
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- =====================================================
-- NOTES
-- =====================================================
-- Run this migration in your Supabase SQL Editor
-- Or use: supabase db push (if using Supabase CLI)
--
-- After running, seed with test data:
-- INSERT INTO organizations (name, slug) VALUES ('Test School', 'test-school');
-- Then link your user profile to this organization in organization_members