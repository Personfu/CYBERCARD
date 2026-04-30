# FLLC.net Site Content Reference

This file describes the public website pages for CyberCard / CyberFlipper and how they map to safe payloads, telemetry, and engineering intent.

## Page Catalog

| Page | Purpose | Safe Behavior | Notes |
|---|---|---|---|
| `/` | Public landing page | explains system model, links to tap, risk, challenge, dashboard | no data collection other than optional analytics |
| `/tap` | Card handoff page | records a tap event, updates contact status, renders profile actions | requires explicit card_id and safe UTM tags |
| `/risk` | Risk awareness lab | records only disclosed browser metadata after consent | no credentials, files, clipboard, or executable payloads |
| `/challenge/<hash>` | Puzzle engagement page | verifies challenge answer and issues JWT reward | audit event for each solver attempt |
| `/dashboard/cards` | Internal analytics dashboard | reads from admin-only Supabase views | not exposed to anonymous users |
| `/api/tap` | Tap ingestion endpoint | inserts `tap_events` and updates `contacts` | service-role Supabase server client only |
| `/api/risk` | Safe telemetry endpoint | inserts `risk_events` after consent | uses an allowlist of browser indicators |
| `/api/device/telemetry` | Device health intake | stores ESP32 telemetry in `device_telemetry` | requires token-based authorization |
| `/api/admin/break-glass` | Visible admin control | records explicit break-glass actions in audit events | only enabled when `BREAK_GLASS_ENABLED=true` |

## URL Matrix

The same FLLC.net URL schema is replicated across physical cards, QR prints, and Flipper payloads:

| Source | Example URL | Channel | Audit tag |
|---|---|---|---|
| Metal card NFC | `https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card` | NFC | `nfc` |
| Printed QR | `https://fllc.net/tap?card_id=metal_v1&utm_source=qr&utm_medium=card` | QR | `qr` |
| AR marker | `https://fllc.net/tap?card_id=ar_v1&utm_source=ar&utm_medium=marker` | AR | `ar` |
| Flipper NFC | `https://fllc.net/tap?card_id=demo_v1&utm_source=flipper_nfc&utm_medium=demo` | Flipper NFC | `flipper_nfc` |
| Wi-Fi portal | `https://fllc.net/tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper` | captive portal | `wifi_portal` |
| BadUSB demo | `https://fllc.net/tap?card_id=demo_v1&utm_source=badusb_demo&utm_medium=flipper` | USB HID | `badusb_demo` |
| Risk page | `https://fllc.net/risk` | consent lab | `risk_awareness` |
| Challenge | `https://fllc.net/challenge/0xDEADBEEF` | puzzle | `challenge` |

## Page Behavior Contracts

### `/tap`
- parses `card_id`, `utm_source`, and `utm_medium`
- records a tap event with a fingerprint hash, coarse geo, and browser context
- uses `redirect_url` only when configured for hard redirect cards
- offers LinkedIn connect, vCard download, and owner profile actions

### `/risk`
- does not collect IP address, clipboard, or raw credentials
- collects only a minimal safe snapshot after a visitor clicks consent
- records `actor_hash` from user agent, language, timezone, and screen size
- stores event indicators such as `browser_surface`, `link_context`, and `blue_team_detection`

### `/challenge/<hash>`
- validates challenge payloads against the backend
- issues a short-lived reward JWT on solve
- writes `challenge_attempts` and `audit_events` for each submission

## OWASP / Blue Team Alignment

This website is modeled as a defensive demonstration of the following classes:

- `A01:2021-Broken Access Control` — internal dashboard access is gated and audited
- `A03:2021-Sensitive Data Exposure` — sensitive keys are server-only and never sent to clients
- `A05:2021-Security Misconfiguration` — explicit environment variables control enabled features like break-glass
- `A07:2021-Identification and Authentication Failures` — challenge and gov gate use JWT proofs and fingerprint binding
- `A10:2021-Server-Side Request Forgery` — no untrusted server-side fetches from the public tap flow

## Signal and ISR Advisory

The repository includes RF and spectrum education but not active offensive signal injection:

- Quansheng UV-K5 notes in `docs/QUANSHENG_UVK5_BRIDGE.md` are receive-first guidance
- The CC1101 module is documented for authorized sub-GHz lab observation, not replay or jamming
- All RF demos are scoped to owned hardware and legal bands
- OSINT and signal ISR are treated as analytics/observation, not unauthorized interception

## Engineering Diagrams and Vectors

The FLLC.net site should support the same multi-channel identity model as the physical card:

```text
Identity = f(QR, NFC, Network)
```

That means a visitor arriving on `/tap` from QR, NFC, AR, or Wi-Fi portal should see a consistent profile experience and the backend should record the source in telemetry.

## Site Information Architecture

The FLLC.net site is a thin, fast, audit-rich shell. There is no marketing dark pattern, no email capture without consent, and no tracking pixel that fires before the visitor opts in.

```mermaid
flowchart LR
  Visitor((Visitor)) --> Root[/ home /]
  Root --> Tap[/tap?card_id=...&utm_*=...]
  Root --> Risk[/risk consent lab]
  Root --> Challenge[/challenge/<hash>]
  Root --> Dash[/dashboard/cards admin]
  Tap -->|POST| ApiTap[/api/tap]
  Risk -->|POST after consent| ApiRisk[/api/risk]
  Challenge -->|POST answer| ApiChallenge[/api/challenge]
  Dash -->|read view| SB[(Supabase RLS views)]
  ApiTap --> SB
  ApiRisk --> SB
  ApiChallenge --> SB
  ApiTap --> Resend[(Resend transactional email)]
  Stripe([Stripe webhook]) --> ApiStripe[/api/stripe]
  ApiStripe --> SB
  SB --> n8n[(n8n: tap-to-revenue automation)]
```

## Page Reference: Detailed Specs

### `/` Landing
- Above-the-fold: identity, last-tap counter, link to `/tap?card_id=demo_v1` for demo
- Below-the-fold: capability matrix, OWASP alignment, link to GitHub repo
- Static prerendered, no PII, deployable to a CDN

### `/tap`
- Server entry: `app/tap/page.tsx`
- Client entry: `app/tap/TapClient.tsx` (POSTs fingerprint + UTM to `/api/tap`)
- Failure mode: if `card_id` is missing, render a friendly explanation with link to `/`
- Redirect mode: if the card has a `redirect_url` (e.g., LinkedIn), the API responds with 200 and the client can `window.location` after recording

### `/risk`
- Renders a clear consent paragraph; nothing is sent before opt-in
- POST body fields are an explicit allowlist; unknown keys are rejected by the server
- Returns blue-team detection summary: are you blocking 3rd-party cookies, are you in private mode, do you have a tracker blocker
- Never logs raw IP; only stores a salted fingerprint

### `/challenge/<hash>`
- Loads challenge by hash, never reveals solution
- POSTs an answer; backend writes `challenge_attempts`, returns success or generic failure
- On success, issues a short-lived reward JWT bound to the visitor fingerprint
- Designed for DEFCON / job outreach engagement, scored on the dashboard

### `/dashboard/cards`
- Admin-only; gated by Supabase RLS + role claim
- Renders billing health, MRR, taps, and a realtime tap stream
- No download buttons, no PII export from the public dashboard

## API Reference

| Route | Method | Auth | Body | Returns |
|---|---|---|---|---|
| `/api/tap` | POST | none (public) | `{ card_id, utm_source, utm_medium, fingerprint }` | `{ ok, redirect_url? }` |
| `/api/risk` | POST | none (consent gate) | `{ consent: true, surface, browser_indicators }` | `{ ok, detections }` |
| `/api/challenge` | POST | none | `{ hash, answer }` | `{ ok, jwt? }` |
| `/api/gov` | POST | JWT | `{ jwt }` | `{ ok, claims }` |
| `/api/admin/break-glass` | POST | service token | `{ reason, actor }` | `{ ok, audit_id }` |
| `/api/device/telemetry` | POST | device token | `{ device_id, event, payload }` | `{ ok }` |
| `/api/stripe` | POST | Stripe sig | Stripe webhook | `{ received: true }` |
| `/api/vcard` | GET | none | `?card_id=...` | `text/vcard` |

## Public Copy Blocks

These short copy blocks can be reused across the site, social media, and printed cards.

```text
fllc.net/tap?card_id=metal_v1
"Tap any phone. The card responds. The backend learns. The owner verifies. No tricks."
```

```text
fllc.net/risk
"Voluntary blue-team awareness lab. Click consent, see what your browser advertises about you,
then close the tab. Nothing is stored in plain form."
```

```text
fllc.net/challenge/0xDEADBEEF
"Solve once, get a signed reward token. The point is engagement, not compromise."
```

## SEO and Trust Signals

- `og:image` references local SVGs only; no third-party trackers in the head
- `<meta name="referrer" content="strict-origin-when-cross-origin">` site-wide
- Content Security Policy: default-src 'self'; allow Stripe, Resend, Supabase explicitly
- Strict-Transport-Security: 1 year, includeSubDomains, preload
- robots.txt allows `/`, `/tap`, `/challenge/*`, `/risk`; disallows `/dashboard/*` and `/api/*`

## Operating Doctrine

1. Every URL on this domain must be safe to scan from anywhere; no automatic exploit, no auto-download.
2. Every action is auditable. If it does not log to Supabase, it did not happen.
3. The dashboard is the truth source; if the UI disagrees with the audit, the audit wins.
4. Anonymous visitors see only consent-aware content; all device/admin features require tokens.
5. Public copy is honest about what is collected, why, and how to opt out.

