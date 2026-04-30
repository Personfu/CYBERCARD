-- CyberCard System — Migration 003
-- Adds visible break-glass admin workflow and device telemetry.
-- This is not a backdoor: every action is scoped, logged, and owner-notified by the app layer.

create table if not exists public.device_telemetry (
  id                uuid primary key default gen_random_uuid(),
  device_id         text not null,
  card_id           text references public.cards(card_id) on delete set null,
  firmware_version  text,
  mode              text,
  battery_percent   numeric(5,2),
  battery_mv        int,
  rssi_bucket       int,
  wifi_rssi         int,
  ble_seen_count    int,
  error_code        text,
  metadata          jsonb not null default '{}',
  reported_at       timestamptz not null default now()
);

create index if not exists device_telemetry_device_idx on public.device_telemetry(device_id, reported_at desc);
create index if not exists device_telemetry_card_idx on public.device_telemetry(card_id, reported_at desc);

create table if not exists public.break_glass_events (
  id                uuid primary key default gen_random_uuid(),
  requested_by      text not null,
  action            text not null check (action in ('revoke_card','pause_email','rotate_challenge','export_audit','note_only')),
  target_type       text not null check (target_type in ('card','challenge','org','system')),
  target_id         text not null,
  reason            text not null,
  approved          boolean not null default false,
  approved_by       text,
  expires_at        timestamptz not null default now() + interval '15 minutes',
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists break_glass_events_target_idx on public.break_glass_events(target_type, target_id, created_at desc);
create index if not exists break_glass_events_expiry_idx on public.break_glass_events(expires_at desc);

alter table public.device_telemetry   enable row level security;
alter table public.break_glass_events enable row level security;

create policy "service_full_device_telemetry" on public.device_telemetry
  for all using (auth.role() = 'service_role');

create policy "service_full_break_glass" on public.break_glass_events
  for all using (auth.role() = 'service_role');
