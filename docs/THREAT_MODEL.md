# CyberCard Threat Model

Furulie LLC · v0.1 · 2026.04

This is the formal security analysis of the CyberCard system. It maps the attack surface, names the adversaries, and ties every defense back to research in the proxmark archive. Read once before deploying. Update before every release.

---

## 1. Assets

What we are protecting, in priority order.

| Asset | Why it matters | Sensitivity |
|---|---|---|
| `cards` table | Source of truth for every identity card. Compromise = mass impersonation | Critical |
| `audit_events` table | Forensic record. Compromise = unprovable access | Critical |
| `gov_v1` access JWTs | Govern who reaches restricted card render | Critical |
| Resend API key | Send-as-Furulie email capability | High |
| Supabase service role key | Full DB write | Critical |
| `tap_events` fingerprint hashes | PII-adjacent. Reversal = deanonymization | Medium |
| NTAG216 NDEF payload | Static. Spoofable. URL is public anyway | Low |
| ESP32-S3 firmware | Field-deployable. Extraction = capability cloning | Medium |

---

## 2. Adversaries

| Adversary | Capability | Motivation | Likelihood |
|---|---|---|---|
| Curious tapper | Phone NFC reader, browser dev tools | Curiosity | High |
| Skilled red-teamer | Flipper Zero, Proxmark3, RF lab | Bragging rights, bounty | Medium |
| Competitor | API scraping, dashboard recon | Market intel | Medium |
| State actor | Full network observation, supply chain | Targeted compromise | Low (but hardening for this raises floor for everyone) |
| Insider | Service role key, prod DB access | Data exfil, sabotage | Low |
| Automated bot | Mass scanners, credential stuffers | Free compute, spam vectors | High |

---

## 3. Attack surface — by layer

### Physical layer (NTAG216, metal card, AR marker)

| Vector | Reference | Mitigation |
|---|---|---|
| Tag cloning (read NDEF → write to blank NTAG) | proxmark · `NFC/BH_US_12_Miller_NFC_attack_surface_WP.pdf` | Tag is not the trust anchor. The URL is public. The trust comes from the backend handshake. Acceptable. |
| NDEF replay (capture URL + replay later) | n/a — public URL | Same as above. Replay does not bypass any auth. |
| MIFARE Classic crypto break (if downgraded) | proxmark · MIFARE folder | We don't use MIFARE. NTAG216 is unencrypted by design. |
| Side-channel on NTAG (power analysis) | proxmark · `Hitag/Breaking_Hitag_2_Revisited.pdf` (parallel methodology) | Not applicable — no secrets in the tag. |
| QR shoulder-surfing | n/a | Same — URL is public by design. |
| AR marker replication (print copy) | n/a | Marker is not a credential. Fine. |

**Conclusion:** the physical layer is intentionally unauthenticated. trust is centralized in the backend.

### Trigger / network layer (browser → /api/tap)

| Vector | Reference | Mitigation |
|---|---|---|
| Replay of tap event | OWASP · session replay | Edge function records every tap as new row with timestamp. Replays are visible, not blocked. |
| Inflated tap counts (bots) | n/a | Per-fingerprint dedup via SHA-256 hash. `is_first_tap = false` for repeats. |
| MITM (downgrade HTTPS) | n/a | HSTS preload via Vercel, TLS 1.3 only. |
| CSRF on POST /api/tap | OWASP · CSRF | No cookies on this route. SameSite=Strict on `gov_access`. |
| XSS via `card_id` reflection | OWASP · XSS | `card_id` is validated against DB enum, never rendered raw. |
| API enumeration (brute card_ids) | n/a | Card IDs returning 404 emit no signal. Add rate limit if abuse appears. |

### Backend layer (Supabase, RLS, service keys)

| Vector | Reference | Mitigation |
|---|---|---|
| Service role key leak | n/a | Vercel env vars only. Never in client bundles. Rotate quarterly. |
| RLS bypass | Supabase docs · RLS | Every table has explicit `service_role`-only policies. Public access defaults closed. |
| SQL injection via webhook | OWASP · SQLi | All Supabase queries use parameterized client. No string concatenation. |
| Backup exfiltration | n/a | Daily Supabase backups encrypted at rest. Service-role-only restore. |
| Audit log tampering | NIST 800-92 | `audit_events` is append-only by convention; consider `pgaudit` extension at next milestone. |

### Auth layer (gov_v1 JWT challenge)

| Vector | Reference | Mitigation |
|---|---|---|
| Challenge JWT replay | RFC 7519 · JWT | `jti` recorded; `exp` 120s; bound to fingerprint. |
| Signature forgery | n/a | HS256 with rotated 256-bit secret in env. EdDSA verification on client side. |
| Fingerprint drift attack | n/a | UA + lang + country bound at challenge issuance; mismatch = audit + reject. |
| Token theft from cookie | OWASP · cookie security | `httpOnly` + `Secure` + `SameSite=Strict`. Cookie scoped to `/tap`. |
| Brute force challenge submissions | n/a | Each attempt audited. Add IP rate limit at 10/min per fingerprint at next iteration. |

### Stripe / SaaS layer

| Vector | Reference | Mitigation |
|---|---|---|
| Webhook spoofing | Stripe docs · webhook security | `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` validates every payload. |
| Card fraud → org provision | Stripe Radar | Stripe handles fraud screening. Card declines never reach our handler. |
| Org slug collision | n/a | DB unique constraint + fallback to `org-{ts}` naming. |
| Quota bypass | n/a | `card_quota` enforced at insert; future migration adds DB trigger. |

### ESP32-S3 device layer

| Vector | Reference | Mitigation |
|---|---|---|
| Flash extraction | proxmark · embedded reverse engineering | Enable Secure Boot v2 + Flash Encryption on production firmware. v0 dev builds are open by design. |
| WiFi creds leak | n/a | Credentials in NVS encrypted partition; never in source. |
| RF jamming during LISTEN | proxmark · sub-GHz papers | LISTEN is research-only. Logged + lab-scoped. |
| OTA update hijack | n/a | Signed OTA via ESP-IDF rollback protection. Defer to v1 hardware spec. |

---

## 4. Specific RFID-domain threats — proxmark archive references

These are the attacks the broader RFID/NFC community has documented. CyberCard's design avoids most by *not using vulnerable primitives* — but a defender working in this space should know them cold.

| Attack family | Targets | Proxmark reference | CyberCard exposure |
|---|---|---|---|
| Hitag2 cipher break | Hitag2 (125 kHz, automotive) | `Hitag/Gone_in_360_Seconds_Hijacking_with_Hitag2-USENIX_2012.pdf` · `Breaking_Hitag_2_Revisited.pdf` | None — we don't use Hitag |
| MIFARE Classic Crypto1 | MIFARE Classic (transit, access) | MIFARE folder, multiple papers | None — NTAG216 ≠ Classic |
| iClass downgrade | HID iClass | iClass folder | None — different ecosystem |
| NFC relay attacks | Bank cards, transit | `NFC/Potential_misuse_of_NFC_enabled_mobile_phones_*.pdf` | Indirect — applies to wallet apps, not our tag |
| EM4xxx cloning | Legacy 125 kHz badges | EM4xxx folder | None — out of scope |
| Indala FlexSecur | HID Indala | `Indala/HID.Indala.FlexSecur.Technology.pdf` | None — out of scope |

**The architectural choice that matters:** we did not put authentication in the tag. We put it in the network handshake. That single choice neutralizes most of the proxmark archive as an attack vector against CyberCard, and it's why the system stays cheap to manufacture.

---

## 5. Defense roadmap — by milestone

| Milestone | Action | Owner | Due |
|---|---|---|---|
| v0.1 (current) | Document threat model · enable RLS · rotate secrets | Preston | shipped |
| v0.2 | IP rate limit on `/api/tap` and `/api/challenge` (10/min) | Preston | next sprint |
| v0.2 | Stripe webhook idempotency keys to handle replay | Preston | next sprint |
| v0.3 | `pgaudit` extension on Supabase for tamper-evident logs | Preston | Q3 2026 |
| v0.3 | Hardware Secure Boot v2 on ESP32-S3 production firmware | Preston | Q3 2026 |
| v1.0 | SOC 2 Type I readiness assessment | external auditor | Q4 2026 |
| v1.1 | Formal disclosure policy + bug bounty | Preston | Q1 2027 |

---

## 6. Detection — what triggers an alert

| Signal | Threshold | Action |
|---|---|---|
| `challenge_failed` events | > 5 per fingerprint per hour | Slack alert + IP rate limit |
| `access_denied` on `gov_v1` | any | Audit row + email Preston |
| Stripe webhook signature failure | any | Alert + investigate |
| Supabase service role used from non-Vercel IP | any | Page Preston |
| Tap rate from single fingerprint | > 50/hour | Auto-flag in dashboard |

---

**Disclaimer:** Furulie LLC is not a law firm. This document is operational security guidance, not legal advice. For SOC 2, FedRAMP, or contractual compliance opinions, consult counsel and an accredited assessor.

build · deploy · scale · defend
