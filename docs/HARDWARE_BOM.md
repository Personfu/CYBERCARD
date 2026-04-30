# CyberCard Device · Hardware v1

Furulie LLC · post-prototype miniaturization spec

---

## bill of materials · target unit cost $34

| Ref | Component | Part number | Qty | Source | Unit | Notes |
|---|---|---|---|---|---|---|
| U1 | MCU module | ESP32-S3-WROOM-1U-N8R8 | 1 | Mouser | $4.20 | 8MB flash, 8MB PSRAM, U.FL connector |
| U2 | NFC controller | NXP PN5180A1HN | 1 | Digikey | $5.80 | full ISO14443A/B + ISO15693 + FeliCa |
| U3 | Sub-GHz transceiver | TI CC1101RGPR | 1 | Mouser | $2.60 | 300–928 MHz, SPI |
| U4 | OLED 128×32 | SSD1306 0.91" I2C | 1 | LCSC | $2.10 | white on black, 3.3V |
| U5 | LiPo charger | TP4056 + DW01 protection | 1 | LCSC | $0.40 | 1A, USB-C input |
| U6 | LDO 3.3V | AP2112K-3.3 | 1 | Digikey | $0.30 | 600 mA, low quiescent |
| BT1 | Battery | 502535 LiPo 500 mAh 3.7V | 1 | various | $3.00 | with PH 2.0 connector |
| J1 | USB-C receptacle | GCT USB4105-GF-A | 1 | Digikey | $0.85 | 16-pin, USB 2.0 + power |
| J2 | NFC antenna | etched on PCB | 0 | n/a | $0 | 4-turn loop, tuned to 13.56 MHz |
| J3 | Sub-GHz antenna | helical 433 MHz SMD or U.FL pigtail | 1 | LCSC | $1.20 | choose by frequency band |
| SW1 | Tactile button | TL3315NF160Q | 1 | Digikey | $0.40 | side-actuated |
| LED1 | Status RGB | WS2812B-2020 | 1 | LCSC | $0.20 | addressable single |
| C, R, L | passives | 0402 / 0603 mixed | ~40 | LCSC | $1.50 | full bypass + match networks |
| PCB | 4-layer board | 50×30 mm, ENIG, 1 mm | 1 | JLCPCB | $4.50 | impedance-controlled for RF |
| Enclosure | aluminum case | machined, anodized black | 1 | PCBWay | $7.00 | 55×35×8 mm |
| **Total BOM** | | | | | **~$34.05** | volumes of 100 |

at qty 1000 the BOM lands near $22 with PCBA · margin headroom for $99 retail or $29/mo subscription.

---

## block diagram

```
                       ┌──────────────┐
        USB-C ─────────│  TP4056 +    │── 4.2V LiPo ──┐
                       │  DW01        │               │
                       └──────────────┘               │
                              │                       │
                       ┌──────────────┐               │
                       │ AP2112K 3V3  │── 3.3V rail ──┤
                       └──────────────┘               │
                              │                       │
                       ┌──────────────┐               │
                  ┌────│ ESP32-S3-WROOM ──┐           │
                  │    └──────────────┘   │           │
        I2C       │           │ SPI       │ GPIO      │
       (SDA/SCL)  │           │           │           │
       ┌──────────┴──┐ ┌──────┴────┐ ┌────┴────┐ ┌────┴────┐
       │ PN5180 NFC  │ │ CC1101    │ │ SSD1306 │ │  Button │
       │ + 13.56 MHz │ │ + helical │ │ OLED    │ │  + RGB  │
       │ loop antenna│ │ antenna   │ │ 128×32  │ │  WS2812 │
       └─────────────┘ └───────────┘ └─────────┘ └─────────┘
```

---

## pin assignments

```
ESP32-S3 GPIO  Function          Connected to
───────────────────────────────────────────────
GPIO 1         I2C SDA           PN5180 + SSD1306
GPIO 2         I2C SCL           PN5180 + SSD1306
GPIO 4         CC1101 GDO0       sub-GHz IRQ
GPIO 5         CC1101 GDO2       sub-GHz status
GPIO 6         BTN               tactile, active low
GPIO 7         WS2812 data       status LED
GPIO 10        CC1101 CS         SPI chip select
GPIO 11        SPI MOSI          CC1101
GPIO 12        SPI SCK           CC1101
GPIO 13        SPI MISO          CC1101
GPIO 14        PN5180 BUSY       NFC ready
GPIO 15        PN5180 IRQ        NFC interrupt
GPIO 16        PN5180 RESET      NFC reset
GPIO 17        PN5180 CS         SPI chip select (separate bus optional)
GPIO 18        battery sense     ADC, divider 1:2
GPIO 35        boot button       (also factory reset)
USB D+/D-      USB OTG           direct to type-C
```

---

## RF design notes

**13.56 MHz NFC loop**
- 4-turn rectangular loop, 32×22 mm outer, 0.5 mm trace, 0.4 mm spacing
- target inductance ~1.5 µH
- match network: series 1.0 nF + shunt 220 pF + series 100 pF (tune via VNA)
- ground keep-out under loop

**sub-GHz antenna**
- 433 MHz: PCB helical or chip antenna w/ pi-network match
- 868/915 MHz: 1/4 wave whip via U.FL pigtail for dev units, integrated for production
- target VSWR < 2:1 across band
- separate ground plane from NFC loop · keep 5 mm clearance

**impedance-controlled 4-layer stackup**
- L1: signal (50 Ω microstrip for RF)
- L2: ground
- L3: 3.3 V power
- L4: signal
- core 0.8 mm · prepreg 0.1 mm · finished 1.0 mm

---

## firmware partition table

```
# partitions.csv
nvs,         data, nvs,     0x9000,   0x6000
otadata,     data, ota,     0xF000,   0x2000
app0,        app,  ota_0,   0x10000,  0x180000
app1,        app,  ota_1,   0x190000, 0x180000
spiffs,      data, spiffs,  0x310000, 0xE0000
coredump,    data, coredump,0x3F0000, 0x10000
```

OTA dual-slot · rollback protection enabled · spiffs holds tap event ring buffer for offline mode.

---

## production checklist

- [ ] order 25 dev units (5 board revs) at JLCPCB · ~$220 with stencil
- [ ] tune NFC match network on first article · save VNA capture to repo
- [ ] verify Sub-GHz output power across 315/433/868/915 with spectrum analyzer
- [ ] confirm USB-C power delivery negotiation works on standard chargers
- [ ] flash production firmware with secure boot v2 + flash encryption
- [ ] burn unique device certificate to NVS for backend mTLS
- [ ] qualify enclosure: drop test 1m, IP54 spray test
- [ ] record full unit cost at qty 100, 500, 1000 for pricing committee
- [ ] FCC pre-compliance scan before any volume order
- [ ] CE pre-compliance + UKCA prep for European launch

---

## revenue mapping

| Sku | Form factor | BOM | Sell | Margin |
|---|---|---|---|---|
| CC-DEV | dev board, no enclosure | $22 | $79 | 72% |
| CC-METAL | metal NFC card (no MCU) | $4 | $39 | 90% |
| CC-PRO | full ESP32-S3 device | $34 | $179 | 81% |
| CC-SAAS | subscription · backend only | n/a | $29/mo | recurring |

target mix at $15K MRR: 80 SaaS subs + 40 metal cards + 20 Pro units per quarter. that's the plan and the spreadsheet agrees.

---

build · deploy · scale
