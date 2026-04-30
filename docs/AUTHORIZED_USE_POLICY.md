# Authorized Use Policy

CyberCard and CyberFlipper are built for defensive research, education, personal devices, and written-scope professional testing.

## Allowed

- Testing your own CyberCard, ESP32-S3 board, Flipper Zero, Wi-Fi dev board, NFC tags, and lab hardware.
- Demonstrating NFC, QR, AR, vCard, and consent-based contact automation.
- Running receive-first RF observations in shielded or lawful lab conditions.
- Using harmless BadUSB-style demos that open your own profile URL or type a disclosure banner.
- Using the Wi-Fi dev board as an owned-network captive-portal awareness demo with clear consent language.
- Reading public research papers and mapping known weaknesses to defensive mitigations.

## Not Allowed In This Repo

- Credential harvesting, phishing pages, or deceptive captive portals.
- Unauthorized badge cloning, rolling-code replay, key extraction, or access bypass.
- Payloads for persistence, stealth, evasion, malware deployment, or data theft.
- RF transmission outside legal limits or without license/authorization.
- Testing against third-party systems without written permission.
- OSINT collection against private individuals without consent.

## RF Compliance

Operate transmitters only within applicable FCC/ISED/CE/UKCA rules, amateur radio rules, or shielded lab conditions. The CC1101, Flipper Zero, and Quansheng UV-K5 can all transmit in ways that may be regulated. Documentation here favors receive-first workflows and compliance-aware lab setup.

## Consent Model

The business card can collect coarse telemetry after a tap or scan. The user action is explicit: tapping NFC, scanning QR, opening AR, or solving the challenge. Store only what is needed, prefer hashes over raw identifiers, and publish a privacy notice for production deployments.
