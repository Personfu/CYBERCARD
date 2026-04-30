# RF Spectrum Matrix

This document maps the CyberCard/CyberFlipper radio, optical, and wired surfaces to physics, protocol behavior, and defensive telemetry.

## Core Equations

```text
lambda = c / f
c = 299,792,458 m/s
r_near ~= lambda / (2*pi)
L_quarter_wave ~= c / (4*f*velocity_factor)
FSPL(dB) = 20log10(distance_km) + 20log10(frequency_MHz) + 32.44
f0 = 1 / (2*pi*sqrt(L*C))
```

## Band Matrix

| Band | Frequency | Wavelength | Hardware | CyberCard role | Compliance stance |
|---|---:|---:|---|---|---|
| LF RFID | 125 kHz | 2398 m | Flipper/Proxmark reference | defensive reading only | do not clone access media |
| NFC | 13.56 MHz | 22.1 m | NTAG216/PN5180 | card trigger, NDEF URL | safe public URL |
| VHF | 136-174 MHz | 2.2-1.7 m | UV-K5 receive | spectrum awareness | licensed transmit only |
| UHF | 400-520 MHz | 0.75-0.58 m | UV-K5 receive | spectrum awareness | licensed transmit only |
| Sub-GHz | 315/433/868/915 MHz | 0.95-0.33 m | CC1101/Flipper | lab receive, RSSI display | TX only if legal/shielded |
| Wi-Fi/BLE | 2.4 GHz | 12.5 cm | ESP32-C6/S3 | provisioning, consent portal | owned networks only |
| IR | 850-950 nm | optical | IR LED/receiver | presentation demo | line-of-sight only |
| USB-C | wired | n/a | ESP32 USB OTG | serial/safe HID | user-initiated only |

## Detection Ideas

| Signal | Defensive interpretation | Telemetry field |
|---|---|---|
| repeated tap from same hash | warm contact or replay | `tap_count`, `is_first_tap` |
| high challenge failures | engaged researcher or brute attempt | `challenge_attempts` rate |
| BLE provisioning retry storm | bad UX or attempted abuse | future `device_telemetry.error_code` |
| RF RSSI pulse | lab signal present | local-only visualization bucket |
| captive portal open | consent demo started | `utm_source=wifi_portal` |
