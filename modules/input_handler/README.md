# input_handler

Purpose: normalize buttons, NFC events, BLE writes, and USB commands into discrete events.

```text
Input_event = debounce(raw_signal, t_ms)
```

Responsibilities:

- button short press / long press
- IMU gesture events if installed
- NFC tag-present event
- safe USB demo trigger
- mode transition validation
