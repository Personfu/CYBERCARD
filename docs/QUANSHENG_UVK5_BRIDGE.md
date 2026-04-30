# Quansheng UV-K5 Bridge

This is a receive-first VHF/UHF research appendix for spectrum awareness. It is not required for CyberCard core functionality.

## Scope

| Feature | Status |
|---|---|
| VHF/UHF receive awareness | planned appendix |
| licensed amateur transmit | user responsibility |
| CyberCard telemetry link | future receive summary only |
| unauthorized monitoring | not supported |

## Bands

| Band | Typical range | Notes |
|---|---:|---|
| VHF | 136-174 MHz | includes 2 m amateur allocation in some regions |
| UHF | 400-520 MHz | includes 70 cm amateur allocation in some regions |

## Safe Integration Idea

```text
UV-K5 receive observation -> manual note -> CyberCard dashboard event -> learning journal
```

No automated decoding of private communications is included. Use only where lawful.
