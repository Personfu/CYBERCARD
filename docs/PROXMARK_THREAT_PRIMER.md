# Proxmark Threat Primer

The Proxmark archive is mirrored locally with:

```bash
python CYBERCARD/scripts/proxmark_scraper.py --out ~/Downloads/proxmark_docs --workers 2 --max-retries 3
```

Do not commit the PDF archive.

## Priority Reading

| Topic | Paper | Defensive lesson |
|---|---|---|
| NFC attack surface | `NFC/BH_US_12_Miller_NFC_attack_surface_WP.pdf` | phone NFC stacks and URL handling matter |
| Hitag2 | `125 kHz - Hitag/Gone_in_360_Seconds...pdf` | legacy LF crypto can fail catastrophically |
| MIFARE Classic | `Reverse-Engineering.a.Cryptographic.RFID.Tag-USENIX.2008.pdf` | proprietary crypto is not a defense |
| MIFARE attacks | `Dismantling.MIFARE.Classic-ESORICS.2008.pdf` | design weaknesses become practical tooling |
| Antennas | antenna docs | RF performance is physics, not vibes |

## CyberCard Mapping

CyberCard intentionally uses NTAG216 as a public trigger. If a public URL is cloned, the backend records another observable event. Trust remains in the network layer.
