# display_engine

Purpose: turn state into pixels on OLED or future LED matrix.

```text
Display(x,y)=RGB(x,y)
frame_budget_ms < 16 for 60 FPS
bandwidth ~= leds * bits_per_led * fps
```

Responsibilities:

- maintain frame buffer
- render tap pulses
- render RF RSSI columns
- render battery and mode state
- avoid blocking network or sensor tasks
