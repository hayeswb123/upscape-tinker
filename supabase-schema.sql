-- Run this in your Supabase SQL editor

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default '',
  address text not null default '',
  homeowner text not null default '',
  phone text not null default '',
  email text not null default '',
  lat double precision,
  lng double precision,
  status text not null default 'draft' check (status in ('draft','quoted','approved','installed','bidding')),
  selected_tier text not null default 'premium' check (selected_tier in ('budget','mid','premium')),
  markers jsonb not null default '[]',
  wires jsonb not null default '[]',
  zones jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- RLS: users see only their own projects
alter table public.projects enable row level security;

create policy "users manage own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for listing
create index if not exists projects_user_created on public.projects(user_id, created_at desc);

-- ─────────────────────────────────────────────
-- Bidding system
-- ─────────────────────────────────────────────

-- One row per licensed electrician
create table if not exists public.electrician_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null unique,
  name       text not null,
  company    text,
  license    text,
  phone      text,
  bio        text,
  verified   boolean default false,
  created_at timestamptz default now()
);

alter table public.electrician_profiles enable row level security;

create policy "electrician owns profile"
  on public.electrician_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Contractors can read all profiles (to display winner info)
create policy "contractors read profiles"
  on public.electrician_profiles for select
  using (true);

-- A project put out to bid
create table if not exists public.bid_jobs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null,
  owner_id      uuid references auth.users(id) on delete cascade not null,
  labor_ceiling numeric not null,
  deadline      timestamptz not null,
  status        text default 'open' check (status in ('open','closed','awarded')),
  winner_id     uuid references public.electrician_profiles(id),
  created_at    timestamptz default now()
);

alter table public.bid_jobs enable row level security;

create policy "owner manages job"
  on public.bid_jobs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Electricians see all open jobs (but labor_ceiling is excluded via app layer)
create policy "electricians see open jobs"
  on public.bid_jobs for select
  using (status = 'open');

create index if not exists bid_jobs_project on public.bid_jobs(project_id);
create index if not exists bid_jobs_deadline on public.bid_jobs(deadline);

-- Individual sealed bids
create table if not exists public.bids (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references public.bid_jobs(id) on delete cascade not null,
  electrician_id uuid references public.electrician_profiles(id) on delete cascade not null,
  amount         numeric not null check (amount > 0),
  submitted_at   timestamptz default now(),
  unique(job_id, electrician_id)
);

alter table public.bids enable row level security;

-- Electricians see only their own bids
create policy "electrician sees own bids"
  on public.bids for all
  using (electrician_id in (select id from public.electrician_profiles where user_id = auth.uid()))
  with check (electrician_id in (select id from public.electrician_profiles where user_id = auth.uid()));

-- Contractors see bids on their jobs only after deadline
create policy "contractor sees closed bids"
  on public.bids for select
  using (
    job_id in (
      select id from public.bid_jobs
      where owner_id = auth.uid() and deadline < now()
    )
  );
