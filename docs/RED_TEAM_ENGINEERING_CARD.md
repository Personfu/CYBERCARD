# Red Team Engineering Card

This chapter reframes the card as a **systems-modeling artifact**. It does not attack systems. It teaches how connected systems behave under input variation, latency, visualization load, identity switching, and telemetry pressure.

## Chapter 1: System Identity

Core idea: every device is a node in a network, whether you admit it or not.

```text
S = { C, I, O, N }

C = compute       ESP32-C6/S3 MCU, firmware, parsing, state machines
I = inputs        buttons, IMU, NFC, QR, BLE, Wi-Fi portal events
O = outputs       LED matrix, OLED, haptics, vCard, dashboard, email
N = networks      Wi-Fi 6, BLE 5, NFC near-field, USB, Supabase API
```

Recommended hardware identity profile:

| Component | ESP32-S3 prototype | ESP32-C6 extension |
|---|---|---|
| Compute | dual-core Xtensa, 240 MHz | RISC-V, Wi-Fi 6 capable |
| Wi-Fi | 802.11 b/g/n | 802.11ax 2.4 GHz |
| BLE | BLE 5 capable | BLE 5 capable |
| USB | native USB OTG | board-dependent |
| CyberCard role | NFC/RF lab prototype | next-gen network visualization board |

## Chapter 2: Connectivity Is Attack Surface

A weather app is not just a weather app. Its true pipeline is:

```text
Data_in -> Parse -> Validate -> Render -> Log -> Sync
```

What matters:

- HTTP request behavior
- JSON parser boundaries
- time synchronization
- retry and timeout behavior
- wireless association state
- telemetry and audit handling

Latency model:

```text
T_total = T_tx + T_processing + T_render
```

| Term | Meaning | Example control |
|---|---|---|
| `T_tx` | network delay | timeout, retry budget, offline mode |
| `T_processing` | CPU parse and transform time | schema validation, safe JSON parsing |
| `T_render` | LED/OLED/display update time | frame budget, dirty rectangles |

Real-time constraint:

```text
T_render < 16 ms for 60 FPS
```

## Chapter 3: Human Interface Layer

Inputs:

- buttons are discrete signals
- IMU readings are continuous vectors
- NFC/QR/BLE events are identity transitions

IMU vector:

```text
a = (a_x, a_y, a_z)
theta = atan2(a_x, a_y)
```

Debounce model:

```text
valid_press = stable(signal, debounce_ms) && edge_detected
```

## Chapter 4: Identity Systems

```text
Identity = f(QR, NFC, Network, Consent, Audit)
```

| Channel | Identity type | CyberCard behavior |
|---|---|---|
| QR | offline/static | visible URL trigger |
| NFC | near-field/static | NTAG216 NDEF URL |
| Wi-Fi | online/contextual | consent portal or provisioning path |
| BLE | local/proximity | beacon and device health advertisement |
| Backend | authoritative | card config, audit, challenge state |

## Chapter 5: LED Matrix as Visualization Engine

A 17 x 9 matrix is not decoration. It is a parallel output system.

```text
Display(x, y) = RGB(x, y)
N_leds = 17 * 9 = 153
Bandwidth ~= N_leds * color_depth_bits * FPS
```

Example:

```text
153 LEDs * 24 bits * 60 FPS = 220,320 bits/sec before protocol overhead
```

## Chapter 6: Games Are Control Loops

Snake and Pong are closed-loop systems:

```text
State(t+1) = f(State(t), Input(t), Delta_t)
```

CyberCard uses the same model for:

- mode switching
- RF scan visualization
- tap event states
- challenge solve flow
- LED activity pulses

## Chapter 7: Sensor Fusion

Motion simulation:

```text
F = m*a
v(t) = integral(a dt)
x(t) = integral(v dt)
```

Discrete approximation:

```text
v_next = v_current + a * delta_t
x_next = x_current + v_next * delta_t
```

## Blue-Team Reframe

The purpose is reading systems, not attacking systems.

| Offensive-sounding concept | Safe CyberCard equivalent |
|---|---|
| backdoor | break-glass admin route with audit and short TTL |
| exploit payload | detection playbook and harmless proof string |
| BadUSB | opens owner profile and types consent banner |
| rogue signal | lab-only spectrum visualization and compliance notes |
| phishing portal | consent captive portal awareness demo |
| persistence | signed firmware update and rollback protection |
| stealth | visible audit trail and admin notification |

## Break-Glass Controls, Not Backdoors

CyberCard can support emergency admin workflows without covert access.

```text
admin_intent -> signed request -> short TTL token -> audit row -> notification -> auto-expire
```

Rules:

- no hidden accounts
- no hardcoded secrets
- no silent access
- every admin action writes `audit_events`
- every break-glass event notifies the owner
- all tokens expire quickly

## Personfu Contribution

The high-signal contribution is a physical artifact that teaches:

- system decomposition
- attack surface reasoning
- RF physics
- identity architecture
- telemetry design
- secure admin controls
- harmless automation that still feels dramatic
