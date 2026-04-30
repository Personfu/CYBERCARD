# identity_layer

Purpose: represent a human-facing identity across QR, NFC, Wi-Fi, BLE, and backend state.

```text
Identity = f(QR, NFC, Network, Consent, Audit)
```

Responsibilities:

- choose active persona: metal, demo, ar, gov, file
- generate correct `/tap?card_id=` URL
- record source/medium
- preserve privacy by hashing device/browser fingerprints
- never treat the tag itself as a secret
