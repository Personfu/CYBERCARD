# Hardening Checklist

## Backend

- [ ] rotate Supabase service role key quarterly
- [ ] enable pgaudit or equivalent audit extension
- [ ] rate-limit `/api/tap`, `/api/challenge`, `/api/gov`
- [ ] verify Stripe webhook signatures
- [ ] add idempotency handling for Stripe events
- [ ] publish privacy notice
- [ ] review all RLS policies before production

## Firmware

- [ ] enable Secure Boot v2
- [ ] enable flash encryption
- [ ] sign OTA images
- [ ] lock JTAG/debug in production
- [ ] encrypt microSD telemetry cache if used
- [ ] expose RF TX only in explicit lab build

## Hardware

- [ ] VNA tune NFC loop at 13.56 MHz
- [ ] pre-compliance scan for 2.4 GHz and sub-GHz harmonics
- [ ] validate LiPo thermal behavior
- [ ] add ESD protection to external/user-touch ports
- [ ] validate USB-C CC resistors and shield grounding

## Blue-Team Admin

- [ ] no hidden admin accounts
- [ ] no hardcoded secrets
- [ ] break-glass tokens expire quickly
- [ ] every admin action emits `audit_events`
- [ ] every break-glass event notifies owner
