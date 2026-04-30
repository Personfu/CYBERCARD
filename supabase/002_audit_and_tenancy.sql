-- CyberCard System — Migration 002
-- 002_audit_and_tenancy.sql
-- Adds: gov_v1 audit gate · multi-tenant orgs · Stripe subscriptions · DEFCON challenge

-- =========================================================
-- ORGS — multi-tenant root for card-as-a-service
-- =========================================================
create table if not exists public.orgs (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,           -- 'furulie', 'acme-co'
  name              text not null,
  owner_email       text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan              text not null default 'free'
                    check (plan in ('free','starter','pro','enterprise')),
  card_quota        int  not null default 1,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Bind cards to orgs — single-tenant deployments leave org_id null
alter table public.cards
  add column if not exists org_id uuid references public.orgs(id) on delete cascade;

create index if not exists cards_org_idx on public.cards(org_id);

-- =========================================================
-- AUDIT_EVENTS — gov_v1 access trail
-- =========================================================
create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  card_id         text not null references public.cards(card_id) on delete cascade,
  tap_event_id    uuid references public.tap_events(id) on delete set null,
  event_type      text not null
                  check (event_type in ('challenge_issued','challenge_solved','challenge_failed','access_granted','access_denied','admin_view','export')),
  actor_hash      text,                              -- requester fingerprint
  jwt_jti         text,                              -- JWT ID if applicable
  ip_country      text,
  ip_region       text,
  ua_raw          text,
  metadata        jsonb not null default '{}',
  occurred_at     timestamptz not null default now()
);

create index if not exists audit_events_card_idx on public.audit_events(card_id);
create index if not exists audit_events_type_idx on public.audit_events(event_type);
create index if not exists audit_events_occurred_idx on public.audit_events(occurred_at desc);

-- =========================================================
-- CHALLENGES — DEFCON puzzle layer · convert hackers to leads
-- =========================================================
create table if not exists public.challenges (
  id              uuid primary key default gen_random_uuid(),
  challenge_hash  text not null unique,              -- printed on card back
  challenge_type  text not null default 'sha256'
                  check (challenge_type in ('sha256','xor','rot13_chain','custom')),
  solution_hash   text not null,                     -- expected solution (hashed)
  reward_url      text not null,                     -- where solver gets routed
  reward_payload  jsonb not null default '{}',       -- what they unlock
  active          boolean not null default true,
  attempts        int not null default 0,
  solved_count    int not null default 0,
  first_solved_at timestamptz,
  first_solver_hash text,
  created_at      timestamptz not null default now()
);

create index if not exists challenges_hash_idx on public.challenges(challenge_hash);

create table if not exists public.challenge_attempts (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references public.challenges(id) on delete cascade,
  fingerprint_hash text not null,
  submitted_value text not null,
  correct         boolean not null default false,
  attempted_at    timestamptz not null default now()
);

-- =========================================================
-- RLS — service role only on every new table
-- =========================================================
alter table public.orgs                enable row level security;
alter table public.audit_events        enable row level security;
alter table public.challenges          enable row level security;
alter table public.challenge_attempts  enable row level security;

create policy "service_full_orgs"     on public.orgs               for all using (auth.role() = 'service_role');
create policy "service_full_audit"    on public.audit_events       for all using (auth.role() = 'service_role');
create policy "service_full_chal"     on public.challenges         for all using (auth.role() = 'service_role');
create policy "service_full_chal_att" on public.challenge_attempts for all using (auth.role() = 'service_role');

-- =========================================================
-- VIEW — billing health · ARR roll-up per plan
-- =========================================================
create or replace view public.org_billing_health as
select
  plan,
  count(*) filter (where active = true)              as active_orgs,
  count(*) filter (where stripe_subscription_id is not null) as paying,
  case plan
    when 'starter'    then count(*) filter (where active = true) * 29
    when 'pro'        then count(*) filter (where active = true) * 99
    when 'enterprise' then count(*) filter (where active = true) * 499
    else 0
  end as monthly_revenue_usd
from public.orgs
group by plan;

-- =========================================================
-- SEED — Furulie LLC org · DEFCON challenge
-- =========================================================
insert into public.orgs (slug, name, owner_email, plan, card_quota)
values ('furulie', 'Furulie LLC', 'preston@fllc.net', 'enterprise', 1000)
on conflict (slug) do nothing;

-- Backfill existing cards to Furulie org
update public.cards
set org_id = (select id from public.orgs where slug = 'furulie')
where org_id is null;

-- Seed the DEFCON challenge — solution = 'cyberflipper'
-- challenge_hash printed on card back · solution_hash = sha256('cyberflipper')
insert into public.challenges (
  challenge_hash, challenge_type, solution_hash, reward_url, reward_payload
) values (
  '0xDEADBEEF',
  'sha256',
  '7c2cb729c14b58f4f6dbf48d7cbfae31dac26db8e8ce1d36e87df5b1c4a6e6f7',
  'https://fllc.net/defcon/unlocked',
  '{"tier":"hacker","email_template":"defcon_solved","credits":250}'::jsonb
) on conflict (challenge_hash) do nothing;
