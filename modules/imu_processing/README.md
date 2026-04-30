# imu_processing

Optional ESP32-C6/S3 extension for motion games and sensor fusion.

```text
a = (a_x, a_y, a_z)
theta = atan2(a_x, a_y)
v_next = v + a * dt
x_next = x + v_next * dt
```

Use cases:

- LED physics engine
- tilt-controlled menu
- motion demo for systems class
- tamper/movement telemetry in owned deployments
