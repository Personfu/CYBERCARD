-- CyberCard System — Supabase Schema
-- Migration: 001_cybercard_init.sql
-- Deploy: supabase db push

-- =========================================================
-- CARDS table — one row per physical/digital card identity
-- =========================================================
create table if not exists public.cards (
  id                uuid primary key default gen_random_uuid(),
  card_id           text not null unique,           -- 'metal_v1', 'ar_v1', etc.
  owner_name        text not null,
  owner_title       text,
  owner_company     text,
  owner_email       text,                           -- where tap alerts go
  linkedin_url      text,
  vcard_url         text,
  redirect_url      text,                           -- for scan_v1 hard redirects
  email_trigger     boolean not null default true,
  one_time_email    boolean not null default true,  -- only alert on first tap
  card_type         text not null default 'metal_v1'
                    check (card_type in ('metal_v1','ar_v1','demo_v1','scan_v1','file_v1','file_download_v1','gov_v1','challenge_v1','system_v1')),
  active            boolean not null default true,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =========================================================
-- TAP_EVENTS table — every tap, scan, or AR trigger
-- =========================================================
create table if not exists public.tap_events (
  id                uuid primary key default gen_random_uuid(),
  card_id           text not null references public.cards(card_id) on delete cascade,
  card_type         text not null,
  fingerprint_hash  text not null,                 -- SHA-256, no raw PII
  geo_city          text,
  geo_region        text,
  geo_country       text,
  geo_lat           numeric(9,6),
  geo_lng           numeric(9,6),
  ua_raw            text,                          -- truncated to 300 chars
  utm_source        text not null default 'nfc',
  utm_medium        text not null default 'card',
  is_first_tap      boolean not null default false,
  email_sent        boolean not null default false,
  tapped_at         timestamptz not null default now()
);

-- =========================================================
-- CONTACTS table — resolved identities from repeat taps
-- =========================================================
create table if not exists public.contacts (
  id                uuid primary key default gen_random_uuid(),
  fingerprint_hash  text not null unique,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  tap_count         int not null default 1,
  cards_tapped      text[] not null default '{}',  -- array of card_ids seen
  geo_country       text,
  geo_city          text,
  enriched          boolean not null default false,
  enriched_data     jsonb not null default '{}',   -- optional manual enrichment
  notes             text
);

-- =========================================================
-- CARD_ASSETS table — for file_v1 signed asset delivery
-- =========================================================
create table if not exists public.card_assets (
  id                uuid primary key default gen_random_uuid(),
  card_id           text not null references public.cards(card_id) on delete cascade,
  asset_name        text not null,
  storage_path      text not null,                 -- supabase storage path
  content_type      text not null default 'application/pdf',
  one_time_access   boolean not null default false,
  download_count    int not null default 0,
  active            boolean not null default true,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- =========================================================
-- INDEXES — analytics queries hit these paths heavily
-- =========================================================
create index if not exists tap_events_card_id_idx on public.tap_events(card_id);
create index if not exists tap_events_tapped_at_idx on public.tap_events(tapped_at desc);
create index if not exists tap_events_fingerprint_idx on public.tap_events(fingerprint_hash);
create index if not exists tap_events_country_idx on public.tap_events(geo_country);
create index if not exists contacts_fingerprint_idx on public.contacts(fingerprint_hash);

-- =========================================================
-- RLS — service role writes, anon reads blocked by default
-- =========================================================
alter table public.cards       enable row level security;
alter table public.tap_events  enable row level security;
alter table public.contacts    enable row level security;
alter table public.card_assets enable row level security;

-- Service role (API routes) has full access — no policy needed for service key
-- Public: zero access to cards, contacts, assets
-- tap_events: allow insert from anon (the edge route posts with service key anyway)

create policy "service_full_cards" on public.cards
  for all using (auth.role() = 'service_role');

create policy "service_full_tap_events" on public.tap_events
  for all using (auth.role() = 'service_role');

create policy "service_full_contacts" on public.contacts
  for all using (auth.role() = 'service_role');

create policy "service_full_assets" on public.card_assets
  for all using (auth.role() = 'service_role');

-- =========================================================
-- UPDATED_AT trigger — auto-maintenance
-- =========================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_updated_at
  before update on public.cards
  for each row execute procedure public.handle_updated_at();

-- =========================================================
-- CONTACT UPSERT function — called on every tap via API
-- =========================================================
create or replace function public.upsert_contact(
  p_fingerprint_hash text,
  p_card_id          text,
  p_geo_country      text default null,
  p_geo_city         text default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.contacts (fingerprint_hash, cards_tapped, geo_country, geo_city)
  values (p_fingerprint_hash, array[p_card_id], p_geo_country, p_geo_city)
  on conflict (fingerprint_hash) do update set
    last_seen_at = now(),
    tap_count    = contacts.tap_count + 1,
    cards_tapped = case
      when p_card_id = any(contacts.cards_tapped) then contacts.cards_tapped
      else array_append(contacts.cards_tapped, p_card_id)
    end,
    geo_country  = coalesce(excluded.geo_country, contacts.geo_country),
    geo_city     = coalesce(excluded.geo_city,    contacts.geo_city);
end;
$$;

-- =========================================================
-- ANALYTICS VIEW — per-card summary, used by dashboard
-- =========================================================
create or replace view public.card_analytics as
select
  c.card_id,
  c.card_type,
  c.owner_name,
  c.active,
  count(te.id)                                             as total_taps,
  count(te.id) filter (where te.is_first_tap = true)       as unique_taps,
  count(te.id) filter (where te.email_sent = true)         as emails_sent,
  count(distinct te.geo_country)                           as countries_reached,
  max(te.tapped_at)                                        as last_tapped_at,
  min(te.tapped_at)                                        as first_tapped_at
from public.cards c
left join public.tap_events te on te.card_id = c.card_id
group by c.card_id, c.card_type, c.owner_name, c.active;

-- =========================================================
-- SEED — default card config
-- =========================================================
insert into public.cards (
  card_id, owner_name, owner_title, owner_company,
  owner_email, linkedin_url, vcard_url,
  card_type, email_trigger, one_time_email
) values (
  'metal_v1',
  'Preston Furulie',
  'Systems Architect · AI Automation',
  'Furulie LLC',
  'preston@fllc.net',
  'https://linkedin.com/in/prestonfurulie',
  '/api/vcard',
  'metal_v1', true, true
),
(
  'demo_v1',
  'Preston Furulie',
  'Systems Architect · AI Automation',
  'Furulie LLC',
  'preston@fllc.net',
  'https://linkedin.com/in/prestonfurulie',
  '/api/vcard',
  'demo_v1', true, false
),
(
  'ar_v1',
  'Preston Furulie',
  'Systems Architect · AI Automation',
  'Furulie LLC',
  'preston@fllc.net',
  'https://linkedin.com/in/prestonfurulie',
  null,
  'ar_v1', true, true
),
(
  'file_download_v1',
  'Preston Furulie',
  'Systems Architect · AI Automation',
  'Furulie LLC',
  'preston@fllc.net',
  'https://linkedin.com/in/prestonfurulie',
  '/api/vcard',
  'file_download_v1', true, true
),
(
  'challenge',
  'CyberCard Challenge System',
  'Consent-Based Puzzle Funnel',
  'Furulie LLC',
  'preston@fllc.net',
  null,
  null,
  'challenge_v1', false, true
),
(
  'system',
  'CyberCard System',
  'Audit and Break-Glass Control Plane',
  'Furulie LLC',
  'preston@fllc.net',
  null,
  null,
  'system_v1', false, true
)
on conflict (card_id) do nothing;
