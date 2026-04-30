-- CyberCard System - Migration 004
-- Consent-based risk awareness events for /risk.
-- This stores limited, safe browser context after explicit consent.

create table if not exists public.risk_events (
  id                uuid primary key default gen_random_uuid(),
  actor_hash        text not null,
  scenario          text not null default 'risk_awareness',
  url_path          text not null default '/risk',
  referrer_present  boolean not null default false,
  ip_country        text,
  ua_family         text,
  safe_snapshot     jsonb not null default '{}',
  indicators        text[] not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists risk_events_actor_idx on public.risk_events(actor_hash, created_at desc);
create index if not exists risk_events_scenario_idx on public.risk_events(scenario, created_at desc);
create index if not exists risk_events_created_idx on public.risk_events(created_at desc);

alter table public.risk_events enable row level security;

create policy "service_full_risk_events" on public.risk_events
  for all using (auth.role() = 'service_role');
