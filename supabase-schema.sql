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
  status text not null default 'draft' check (status in ('draft','quoted','approved','installed')),
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
