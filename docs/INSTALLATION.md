# Installation

## 1. Repo

```bash
git clone https://github.com/Personfu/CyberFlipper.git
cd CyberFlipper/CYBERCARD
npm install
cp .env.example .env.local
```

## 2. Supabase

Apply migrations in order:

```bash
supabase db push
```

Migration files:

```text
supabase/001_cybercard_init.sql
supabase/002_audit_and_tenancy.sql
supabase/003_break_glass_and_device_telemetry.sql
supabase/004_risk_awareness_events.sql
```

## 3. Next.js Environment

Set these in `.env.local` for development and in your deployment provider for production:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
GOV_JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DEVICE_TELEMETRY_TOKEN=
BREAK_GLASS_ENABLED=false
BREAK_GLASS_ADMIN_TOKEN=
NEXT_PUBLIC_SITE_URL=https://fllc.net
```

Run locally:

```bash
npm run dev
```

Production build check:

```bash
npm run typecheck
npm run build
```

## 4. NFC Programming

```bash
node scripts/generate_ndef.js --url "https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card" --card-id metal_v1
```

Write with NFC Tools, Flipper Zero, Proxmark3, or CyberCard firmware NFC-write mode.

## 5. AR Scene

Copy `ar/index.html` into your public assets or host it directly. The prototype uses the Hiro marker. Production should use a custom NFT marker.

## 6. Flipper Zero Safe Demos

Copy files from `flipper/` to the matching Flipper SD card folders:

```text
flipper/badusb/*.txt   -> /badusb/
flipper/nfc/*.nfc      -> /nfc/
flipper/infrared/*.ir  -> /infrared/
```

## 7. ESP32-S3 Firmware

Open `firmware/cybercard_v0.ino`, update `TAP_URL`, flash the board, and test status/NFC/RF modes. RF TX validation must be shielded or legally authorized.

## 8. Safe Risk Awareness Page

Deploy `/risk` at:

```text
https://fllc.net/risk
```

This is a consent-first awareness page. It records only the disclosed safe snapshot after a visitor clicks consent. It must not be modified into a drive-by download, exploit runner, credential collector, or hidden script launcher.
