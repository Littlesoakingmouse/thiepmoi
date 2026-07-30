create extension if not exists pgcrypto;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invited_name text not null,
  name text not null,
  attendance text not null check (attendance in ('yes', 'maybe', 'no')),
  message text default '',
  page_url text default '',
  saved_at timestamptz not null default now()
);

create index if not exists invites_created_at_idx on public.invites (created_at desc);
create index if not exists rsvps_saved_at_idx on public.rsvps (saved_at desc);

alter table public.invites enable row level security;
alter table public.rsvps enable row level security;
