# network_client

Purpose: make network behavior explicit and measurable.

```text
T_total = T_tx + T_processing + T_render
```

Responsibilities:

- HTTPS POST telemetry
- retry budget and timeout handling
- offline queue to SPIFFS/microSD
- TLS-only endpoint policy
- no credential capture in portal mode
