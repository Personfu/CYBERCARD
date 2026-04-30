# Flipper Zero and Wi-Fi Dev Board

This document defines safe CyberCard-compatible Flipper workflows.

## Visuals

| Diagram | Render |
|---|---|
| Wi-Fi dev board pinout (ESP32-S2, BQ24295, USB-C) | ![wifi](assets/flipper-wifi-board.svg) |
| RF spectrum coverage (shared with CyberCard) | ![rf](assets/cybercard-rf-spectrum.svg) |
| Threat model trust boundaries | ![threat](assets/cybercard-threat-model.svg) |

## Flipper Folder Map

| Flipper folder | CyberCard folder | Purpose |
|---|---|---|
| `/badusb/` | `flipper/badusb/` | harmless contact automation |
| `/nfc/` | `flipper/nfc/` | URL-only NFC card demos |
| `/infrared/` | `flipper/infrared/` | owned presentation/remote demos |
| `/subghz/` | docs only | receive-first lab notes, no replay recipes |

## Wi-Fi Dev Board Safe Portal

The Wi-Fi dev board can host an owned-network consent portal:

```text
SSID: CyberCard-Lab
Portal title: Contact Personfu
Disclosure: This demo records that you opened the portal and routes you to /tap.
Button: Open CyberCard
Target: https://fllc.net/tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper
```

No passwords. No credential fields. No deceptive brand imitation.

## Safe BadUSB Demonstration

The included demo opens a browser to the CyberCard profile and types a disclosure note. It is intentionally harmless and visible.

## Wi-Fi Board Hardware and Portal Content

The Wi-Fi dev board should be built on an ESP32-S2 or ESP32-S3 module with a 2.4 GHz antenna and USB power. It is a companion lab device, not a hidden exploit.

- `SSID`: `CyberCard-Lab`
- `Portal URL`: `https://fllc.net/tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper`
- `Page title`: `CyberCard Lab Portal`
- `Disclosure`: `This demo records that you opened the portal and routes you to the CyberCard experience.`
- `Button`: `Open CyberCard`

This page deliberately avoids password fields, credential prompts, hidden redirects, and executable downloads.

### Portal Page Schema

```json
{
  "title": "CyberCard Lab Portal",
  "description": "Owned-network demo portal that routes to the CyberCard profile.",
  "target_url": "https://fllc.net/tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper",
  "consent_notice": "No passwords are requested. This is a safe lab demo.",
  "audit_tag": "wifi_portal"
}
```

## Payload File Mapping

| Demo file | Purpose | Target |
|---|---|---|
| `flipper/badusb/cybercard_contact_demo.txt` | Open profile URL and type consent notice | `/tap?card_id=metal_v1`
| `flipper/badusb/cybercard_wifi_portal_demo.txt` | Open Wi-Fi portal page and type safe demo note | `/tap?card_id=demo_v1&utm_source=wifi_portal`
| `flipper/badusb/cybercard_risk_awareness_demo.txt` | Open the safe `/risk` page | `/risk`
| `flipper/nfc/cybercard_metal_v1.nfc` | NFC URL-only card demo | `/tap?card_id=metal_v1`
| `payloads/scannables/wifi_consent_portal.html` | Owned portal landing page | `/tap?card_id=demo_v1`

## Vulnerability Education

Use Flipper/CyberCard to explain classes of risk in a safe lab context:

| Risk | Safe demonstration |
|---|---|
| USB trust | Ask why an unknown keyboard is dangerous, then open only a URL |
| captive portals | Show consent portal design and how phishing differs |
| NFC trust | Clone your own public URL and prove backend trust still holds |
| sub-GHz | Visualize RSSI in a shielded/owned lab |
| IR | Control your own slide deck or demo device |
| Wi-Fi | Show how a captive portal can be benign with explicit consent |

## OWASP and Blue-Team Alignment

This project is intentionally aligned with defensive controls:

- Avoids credential collection and hidden execution
- Uses explicit consent before recording session data
- Anchors trust in backend audit and RLS instead of physical tag secrecy
- Uses audit-events and device telemetry to support detection and incident response

## Personfu Replicable Payload Methodology

The same FLLC.net `/tap` schema is replicable across the metal business card, the ESP32-S3 wallet device, the Flipper Zero, and the Wi-Fi dev board. One backend route, four physical surfaces, identical audit story.

```mermaid
flowchart TB
  subgraph Surfaces
    BC[Metal Business Card<br/>NFC + QR]
    WD[CyberCard Wallet Device<br/>ESP32-S3 + NFC + CC1101]
    FZ[Flipper Zero<br/>NFC / SubGHz / iButton / IR]
    WB[Flipper Wi-Fi Dev Board<br/>ESP32-S2 captive portal]
  end
  Surfaces -->|HTTPS GET/POST| Tap[/api/tap on fllc.net/]
  Tap --> Audit[(Supabase tap_events + device_telemetry)]
  Audit --> Dash[/dashboard/cards]
  Audit --> SOC[n8n -> PagerDuty / Slack / Email]
```

Every surface presents the same kind of payload: a public, consent-aware URL with `card_id` and UTM tags. There is no surface that delivers an executable, a credential prompt, or hidden persistence.

## Wi-Fi Dev Board: Build, Flash, and Operate

### Hardware

| Item | Spec |
|---|---|
| MCU | ESP32-S2-WROVER or ESP32-S3-WROOM-1U |
| Antenna | 2.4 GHz PCB or u.FL external whip, 2 dBi |
| Connection | USB-C to Flipper or to host PC |
| RF region | 2.412-2.484 GHz Wi-Fi 4 (802.11n), 20 MHz channels |
| TX power | $\le$ +20 dBm legal max in US/EU 2.4 GHz ISM |
| Modes | AP only (captive portal), STA (telemetry), AP+STA (provisioning) |

### Firmware Doctrine

The Wi-Fi board firmware MUST implement these guarantees:

1. AP SSID must include the literal substring `Lab` or `Demo` and must not impersonate any third-party brand.
2. The captive portal HTML must show the consent disclosure above any button.
3. The portal must not render any `<input type="password">` or any login-style form.
4. POSTs to `/api/risk` may be made only after the visitor clicks the consent button.
5. No file from the dev board's filesystem may be sent over Wi-Fi without explicit operator action on the device.

### Bring-up Steps

```text
1. flash arduino-esp32 + tinyusb stack
2. set NVS keys: BACKEND_URL, DEVICE_ID, DEVICE_TOKEN, CARD_ID
3. boot in AP mode -> SSID 'CyberCard-Lab'
4. connect with phone -> captive portal opens consent page
5. tap 'Open CyberCard' -> /tap?card_id=demo_v1&utm_source=wifi_portal&utm_medium=flipper
6. /tap records tap_event with utm_source=wifi_portal
7. dashboard reflects realtime tap
```

### Critical Safe Vulnerability Demonstrations (by Personfu)

These are demonstrations Personfu uses to teach blue-team detection. They are run only on owned hardware/networks, with consent, and they intentionally do not capture credentials.

| Demo | What it shows | Detection signal |
|---|---|---|
| Probe-request awareness | how phones leak SSID history before joining | dashboard event `wifi.probe.observed` (count only, owned lab) |
| Captive portal honesty | how a portal can be respectful instead of deceptive | event `wifi.portal.consent` |
| Beacon flood awareness | how rogue APs can crowd a 2.4 GHz channel | RX-only spectrum reading; no transmissions |
| BLE scan awareness | which apps advertise device names | event `ble.scan.summary` (counts only) |
| QR vs NFC trust | both lead to the same `/tap`; backend is the only trust anchor | matched `utm_source` in audit |
| BadUSB visibility | HID demo opens a tab and types a notice the user can read | event `usb.hid.demo` |

Each demo logs a typed event, requires a physical button press on the operator side, and is rate-limited.

## Replicable Across Surfaces

| Capability | Business card | Wallet device | Flipper | Wi-Fi board |
|---|---|---|---|---|
| URL handoff (NFC/QR) | yes | yes | yes | yes (via portal) |
| BadUSB safe demo | no | yes | yes | no |
| Sub-GHz lab observation | no | yes (CC1101) | yes | no |
| BLE telemetry | no | yes | limited | yes |
| Captive portal demo | no | yes (Wi-Fi STA+AP) | with board | yes |
| Audit to `/api/tap` | yes | yes | yes | yes |
| Audit to `/api/device/telemetry` | no | yes | no | yes |

Every surface is a different physical wrapper around the same identity-and-audit doctrine.

## File Map (Flipper SD Card)

```text
/badusb/
  cybercard_contact_demo.txt          opens /tap?card_id=metal_v1
  cybercard_wifi_portal_demo.txt      opens /tap?...wifi_portal
  cybercard_risk_awareness_demo.txt   opens /risk
/nfc/
  cybercard_metal_v1.nfc              URL-only NDEF tag
  cybercard_demo_v1.nfc               URL-only NDEF tag
/infrared/
  presentation_remote_demo.ir         owned remote learn/replay
/subghz/
  README.md                           receive-first guidance only
```

## What This Doc Will Not Contain

- exploit modules
- de-authentication scripts
- evil-twin SSID kits
- credential-capturing portals
- driver-bypass payloads
- CVE droppers

These are intentionally not in scope. The boundary is enforced by both the firmware checks and the audit pipeline; if anything tried to behave that way the dashboard would flag it.

