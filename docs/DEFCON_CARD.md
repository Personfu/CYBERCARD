# CyberCard · DEFCON Edition
## Full Specification · Furulie LLC · v1.0 · 2026-04

---

## What this document is

This is the complete specification for the CyberCard DEFCON edition — a business card engineered as a demonstration of identity system design, multi-modal interaction, RFID/NFC security awareness, and backend-anchored trust architecture. It converts every contact interaction into a measurable, audited event and doubles as a research instrument at security conferences.

The card is not a weapon. It is a proof-of-concept that shows:
- What a properly architected NFC identity system looks like
- Why NFC tag security is irrelevant when trust lives in the network layer
- How to build a lead-capture system from a physical object

---

## 1. Physical card specification

| Attribute       | Spec                                                          |
|---|---|
| Material        | 316L stainless steel, 0.8 mm, brushed + black PVD coat       |
| Dimensions      | 85.6 × 54 mm (ISO 7810 ID-1)                                 |
| NFC inlay       | NTAG216 · 888 bytes user mem · ISO14443A Type A              |
| QR code         | laser engraved, 25×25 mm · error correction level H          |
| AR marker       | laser engraved hiro/custom NFT marker, 15×15 mm              |
| Back markings   | challenge hash (SHA-256 prefix) + `0xDEADBEEF` etched        |
| Weight          | ~12g                                                          |
| Finish          | custom cut waterjet + CNC + PVD, anodized black               |

### NTAG216 NDEF payload

```
https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card
```

Generate the raw hex with:
```bash
node scripts/generate_ndef.js --url "https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card" --card-id metal_v1
```

Write via:
- **Flipper Zero**: NFC → Write → paste NDEF URL
- **Proxmark3**: `hf mfu ndefwrite -d <hex>`
- **NFC Tools** (Android/iOS): Write → URL
- **ESP32 firmware**: `MODE_NFC_WRITE` + tap tag to board

---

## 2. DEFCON challenge layer

The back of the card carries a SHA-256 prefix hash and the string `0xDEADBEEF`. This is an invite to solve the puzzle.

### Challenge mechanics

```
printed on card back:
  CHALLENGE: 6b86b273...  (SHA-256 of 'one')
  REWARD:    fllc.net/challenge/<hash>

solver flow:
  1. scan QR or type URL
  2. arrive at /challenge/<hash>
  3. enter one lowercase word
  4. server computes sha256(answer.trim().toLowerCase())
  5. match → reward JWT minted → reward URL unlocked
  6. first solver gets ★ badge + personal email from Preston
  7. every attempt logged → hacker funnel measurable
```

### Seeded answer

```sql
-- in 002_audit_and_tenancy.sql:
-- challenge_hash = sha256('0xDEADBEEF') ← what's printed on card
-- solution_hash  = sha256('cyberflipper')  ← the answer
-- reward_url     = 'https://fllc.net/reward/defcon'
```

### Why this works at DEFCON

- Red-teamers will immediately try to crack a hash printed on a card
- The act of trying converts them into an identified, audited lead
- Correct solve = warm contact · immediate personal outreach
- Every attempt = data point on engagement depth
- The puzzle demonstrates: SHA-256 is not how you protect NFC cards

---

## 3. Multi-modal trigger matrix

| Trigger         | card_id       | utm_source | utm_medium | Use case                    |
|---|---|---|---|---|
| NFC tap         | `metal_v1`    | `nfc`      | `card`     | Physical card hand-off      |
| QR scan (card)  | `metal_v1`    | `qr`       | `card`     | Phone camera scan           |
| AR marker       | `ar_v1`       | `ar`       | `marker`   | Conference demo, booth      |
| DEFCON demo     | `demo_v1`     | `defcon`   | `badge`    | DEF CON badge chain         |
| File download   | `file_v1`     | `file`     | `drive`    | Resume PDF or capability doc|
| Gov/restricted  | `gov_v1`      | `gov`      | `audit`    | JWT-gated restricted access |

All land at `/tap?card_id=<id>&utm_source=<s>&utm_medium=<m>` → same fingerprint/audit pipeline.

---

## 4. Trust architecture (why NFC tag security is a red herring)

Most NFC "security" discussions focus on tag-layer attacks:
- **Cloning**: copy NDEF URL to blank tag → yes, trivially done with Flipper Zero
- **Relay**: forward NFC transaction over IP → irrelevant here
- **Eavesdropping**: ISO14443A at 13.56 MHz, ~10 cm range in practice
- **Sniffing reader ↔ tag**: yes, with a PM3 in sniff mode

**None of these matter for CyberCard** because:

```
Trust does not live in the tag.
Trust lives in the backend handshake.
```

The NDEF URL is intentionally public. Cloning the URL gets you nothing the card doesn't already give you. The backend:
- fingerprints every request independently
- detects replay (same fp = returning contact, different event)
- gates restricted content (`gov_v1`) behind an EdDSA-signed JWT challenge
- audits every access with immutable rows in `audit_events`

This is the correct architecture for NFC identity systems. Reference: Black Hat 2012 — Miller, NFC Attack Surface (in proxmark archive: `NFC/BH_US_12_Miller_NFC_attack_surface_WP.pdf`).

---

## 5. RFID/NFC threat landscape (research reference)

Mapped to the proxmark archive. All papers available via `scripts/proxmark_scraper.py`.

### 125 kHz LF systems (HID, Hitag, Indala, EM4100)

| Paper | Finding | CyberCard exposure |
|---|---|---|
| Gone in 360 Seconds — USENIX 2012 | Hitag2 stream cipher broken, car keys cloneable in 6 min | None — we use 13.56 MHz NTAG, no Hitag |
| Breaking Hitag 2 Revisited | Algebraic attack on Hitag2 | None |
| HID format example | 26-bit Wiegand format exposed | None — we don't use Wiegand |
| HitagS protocol | Modern Hitag variant, AES optional | None |

**Key lesson**: LF systems (125 kHz) are fundamentally broken for access control because: (a) no mutual auth, (b) trivially cloneable with $5 EM4100 tags, (c) Wiegand protocol sends credentials in cleartext over wire. Do not use HID EM4100 for anything that matters.

### 13.56 MHz HF systems (MIFARE, NTAG, iClass)

| System | Status | Notes |
|---|---|---|
| MIFARE Classic | **Broken** | Crypto-1 stream cipher reversed 2008. Practical attack <1 min with Proxmark3/Flipper. Do not use. |
| MIFARE Ultralight | Weak | No auth by default. Suitable for public NDEF (like CyberCard). Not suitable for access. |
| NTAG216 (us) | Intentionally open | NDEF is public by design. Trust is backend. |
| MIFARE DESFire EV2 | Strong | AES-128, mutual auth, 3-pass. Suitable for access control. |
| iClass Seos | Strong | HID's modern platform. AES, secure messaging. |
| PIV (FIPS 201) | Strong | Government smart card, RSA/ECC, PKI. |

### NFC attack surface (mobile phones)

Black Hat 2012 — Miller:
- NFC-enabled phones can be used as attack platforms
- URI record exploitation (malformed NDEF → app exploit)
- Tag-based phishing (NDEF URL to phishing page)
- Android/iOS NFC stacks historically had parsing bugs

**CyberCard mitigations**:
- URL is a known-good HTTPS endpoint
- HSTS preload via Vercel
- No URI scheme tricks (no `tel:`, `sms:`, `intent://`)
- Input validation in `/api/tap`: `card_id` regex-validated, never reflected raw

---

## 6. Social engineering awareness layer

The card demonstrates social engineering concepts by example — ethically, transparently, with full disclosure to any technical contact who asks.

### What the card reveals about the holder

When you hand someone this card:
- They see: premium metal card, NFC, QR, AR marker, challenge hash
- Signal sent: technical competency, systems thinking, attention to detail
- Message received before a word is spoken

### What the system learns about them

When they tap/scan:
- Fingerprint (non-PII hash of UA + lang + tz + screen + country)
- Rough geolocation (city/country from Vercel edge headers)
- Time, date, UTM source (how they triggered)
- Whether they've interacted before (returning contact signal)
- Whether they solved the DEFCON challenge (depth of technical engagement)

### Disclosure (important)

This data collection is:
- Disclosed in the privacy policy at `fllc.net/privacy`
- Limited to non-PII fingerprints (no name, email, or precise location stored without consent)
- Used only for personal outreach by Preston Furulie
- Not sold, shared, or processed by ML beyond the audit trail

This is no different from standard web analytics (GA4, Mixpanel). The difference is transparency — the card itself signals that you should expect this.

---

## 7. Business card system at DEFCON

### Distribution strategy

| Context          | Card type    | Trigger        | Goal                         |
|---|---|---|---|
| First meeting    | metal_v1     | NFC tap        | Warm contact in system        |
| Panel/talk       | metal_v1     | QR scan        | Digital follow-up             |
| Booth demo       | ar_v1        | AR marker      | Demo → tap → lead             |
| Badge chain      | demo_v1      | QR             | CTF/puzzle engagement         |
| Technical recruiter | gov_v1   | NFC + JWT gate | Prove they can navigate auth  |

### Conversion funnel

```
[card hand-off]
      ↓
[tap / scan / AR]
      ↓
[/tap page load]
      ↓
[POST /api/tap → fingerprint + geo]
      ↓
[email to Preston: new contact]
      ↓
[contact challenges the hash]
      ↓
[solve = priority lead → personal email within 24h]
```

### Revenue path

The card is also the product demo for the CyberCard SaaS. Prospects who find the card compelling become paying customers. Plan pricing:

| Plan       | Price    | Card quota | Target buyer           |
|---|---|---|---|
| Free       | $0       | 1          | Individual dev         |
| Starter    | $29/mo   | 5          | Freelancer/consultant  |
| Pro        | $79/mo   | 25         | Agency/small team      |
| Enterprise | $299/mo  | 1000       | Corporate identity     |

---

## 8. Hardware capability demonstration

The CyberCard Device (ESP32-S3 + PN5180 + CC1101) demonstrates:

| Capability     | Chip    | Freq        | Notes                                    |
|---|---|---|---|
| NFC read/write | PN5180  | 13.56 MHz   | ISO14443A/B, ISO15693, FeliCa, NTAG full |
| Sub-GHz RX/TX  | CC1101  | 300–928 MHz | OOK/ASK/FSK/GFSK, 1.2–500 kbps          |
| BLE beacon     | ESP32-S3| 2.4 GHz     | Broadcasts `CyberCard · FLLC` identity   |
| Wi-Fi OTA      | ESP32-S3| 2.4 GHz     | Firmware update over air                 |
| USB OTG serial | ESP32-S3| USB 2.0     | Debug + mass storage                     |
| 433 MHz scan   | CC1101  | 433.92 MHz  | RSSI scan of ISM band — garage doors, car fobs, weather sensors |

**Ethical use only**: RF transmission is limited to licensed bands, test bench, or Faraday enclosure. CC1101 TX test mode (1s carrier) is for range validation only. Sub-GHz receive is passive/listen.

---

## 9. Deploy checklist

- [ ] Write NDEF URL to NTAG216 (`node scripts/generate_ndef.js → nfc tools`)
- [ ] Verify card_id `metal_v1` exists and active in Supabase
- [ ] Test tap → email flow in staging
- [ ] Print QR code to spec (H error correction, 25mm, laser engrave or UV print)
- [ ] Engrave AR marker + challenge hash on back
- [ ] Flash ESP32-S3 with `cybercard_v0.ino` (optional for DEFCON demo unit)
- [ ] Verify BLE beacon visible on nearby phone
- [ ] Import n8n workflow + activate
- [ ] Set `GOV_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Vercel
- [ ] Set Stripe webhook → `https://fllc.net/api/stripe`
- [ ] Deploy via `vercel --prod`
- [ ] Print 10 cards (order from Stainless Card Co or custom CNC shop)
- [ ] Pack 5 for DEFCON · keep 2 pristine · 3 for demos

---

## 10. Proxmark research archive

Download all papers locally:
```bash
pip install requests beautifulsoup4 tqdm
python scripts/proxmark_scraper.py --out ~/Downloads/proxmark_docs --workers 6
```

Priority papers for CyberCard threat model context:
- `NFC/BH_US_12_Miller_NFC_attack_surface_WP.pdf` — the foundational paper
- `13.56 MHz - MIFARE Classic/Reverse-Engineering.a.Cryptographic.RFID.Tag-USENIX.2008.pdf`
- `125 kHz - Hitag/Gone_in_360_Seconds_Hijacking_with_Hitag2-USENIX_2012.pdf`
- `NFC/Potential_misuse_of_NFC_enabled_mobile_phones_with_embedded_security_elements_as_contactless_attack_platforms.pdf`

Full index generated by scraper in `~/Downloads/proxmark_docs/STUDY_GUIDE.md`.

---

_Furulie LLC · Preston Furulie · fllc.net · 2026_
