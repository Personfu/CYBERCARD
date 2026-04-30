# Harmless Scannables

These are safe URLs for NFC, QR, AR, Wi-Fi portal, and Flipper demos. They are intentionally designed as consent-first touchpoints, not as exploit or credential capture vectors.

| Name | URL | Purpose |
|---|---|---|
| Metal card | `https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card` | default NFC payload for the premium metal CyberCard |
| QR scan | `https://fllc.net/tap?card_id=metal_v1&utm_source=qr&utm_medium=card` | printed QR URL for offline scanning |
| AR marker | `https://fllc.net/tap?card_id=ar_v1&utm_source=ar&utm_medium=marker` | AR scene handoff with identity augmentation |
| Flipper NFC | `https://fllc.net/tap?card_id=demo_v1&utm_source=flipper_nfc&utm_medium=demo` | reproducible NFC demo for Flipper Zero |
| Wi-Fi portal | `https://fllc.net/tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper` | consent-based captive-portal handoff |
| USB safe demo | `https://fllc.net/tap?card_id=demo_v1&utm_source=badusb_demo&utm_medium=flipper` | harmless browser-open demo for USB HID devices |
| Business card contact | `https://fllc.net/tap?card_id=metal_v1&utm_source=card&utm_medium=business` | safe business card handoff from physical contact |
| Risk awareness | `https://fllc.net/risk` | consent-first blue-team page with safe telemetry |
| DEFCON puzzle | `https://fllc.net/challenge/0xDEADBEEF` | challenge entry page for engagement and scoring |

## QR Generation

Use any QR tool that supports high error correction. Recommended settings:

- ECC: H
- margin: 4 modules
- minimum print size: 25 mm x 25 mm
- dark foreground on light/matte background
- avoid glossy surfaces that glare under presentation lighting

No QR here points to an executable download. These payloads are all URL-based handoffs to the CyberCard execution stack.

## Scannable Design Notes

- The tag identity is public; trust is anchored in the backend.
- NFC and QR should both land on the same app flow so audit, telemetry, and consent are consistent.
- The Wi-Fi portal sample is for owned-network demos only; do not use it to imitate real login pages.
- The BadUSB sample is a benign interaction script that opens a browser and types a clear notice.

## Extended Scannable Catalog

These extended URLs are still safe (consent-first, no auto-exec) but cover a wider DEFCON / job outreach / ham / OSINT spectrum.

| Name | URL | Channel | Use case |
|---|---|---|---|
| Resume handoff | `https://fllc.net/tap?card_id=resume_v1&utm_source=qr&utm_medium=resume` | QR on resume | recruiter scan |
| Conference badge | `https://fllc.net/tap?card_id=defcon_badge_v1&utm_source=defcon&utm_medium=badge` | NFC badge | conference floor handoff |
| Hallway puzzle | `https://fllc.net/challenge/0xC0FFEE` | poster QR | engagement hook |
| Speaker intro | `https://fllc.net/tap?card_id=talk_v1&utm_source=stage&utm_medium=qr` | stage QR | session attribution |
| Ham radio call sign | `https://fllc.net/tap?card_id=callsign_v1&utm_source=ham&utm_medium=qr` | QSL card | licensed amateur exchange |
| Wallet device pair | `https://fllc.net/tap?card_id=device_pair_v1&utm_source=wallet&utm_medium=ble` | BLE handoff | provisioning of CyberCard wallet device |
| ESP32 telemetry health | `https://fllc.net/tap?card_id=health_v1&utm_source=device&utm_medium=qr` | maintenance | quick device status confirmation |
| OSINT consent | `https://fllc.net/risk?utm_source=osint_demo&utm_medium=qr` | training | blue-team workshop entry |
| CTF flag drop | `https://fllc.net/challenge/0xFEEDFACE` | onsite QR | scoreboard hook |
| Charity / community | `https://fllc.net/tap?card_id=community_v1&utm_source=qr&utm_medium=event` | event booth | nonprofit handoff |

## NFC NDEF Record Templates

Use these one-record NDEF templates for tag programming. They are URL records only; no app-launch records, no auto-execute records.

```text
[Record 1: U (URI)] https://fllc.net/tap?card_id=metal_v1&utm_source=nfc&utm_medium=card
[Record 1: U (URI)] https://fllc.net/tap?card_id=demo_v1&utm_source=flipper_nfc&utm_medium=demo
[Record 1: U (URI)] https://fllc.net/risk?utm_source=defcon_lab&utm_medium=nfc
```

## QR Print Specs

| Use | Size | ECC | Color | Surface |
|---|---|---|---|---|
| business card | 18 mm x 18 mm | M | dark on light | matte |
| metal card etch | 22 mm x 22 mm | H | etched | brushed metal |
| poster A2 | 80 mm x 80 mm | Q | black on white | matte paper |
| stage QR | 200 mm x 200 mm | H | high-contrast | rear-projection |
| sticker swag | 30 mm x 30 mm | H | dark on light | satin vinyl |

## Anti-Spoof Notes

QR and NFC are not authentication. The visitor authenticates by tapping a tag, but trust is built at the backend:

- `/tap` resolves only known `card_id` values
- unknown card IDs render an explanation page, never a redirect
- repeated taps from the same fingerprint are de-duplicated in `tap_events`
- the dashboard flags first-tap geo anomalies (e.g., card moved 5,000 km in 60 s)
- vCard download is rate-limited per fingerprint
