/**
 * imu_processing
 * --------------------------------------------------
 * Lightweight tilt + simple-integration helpers for the optional
 * accelerometer/gyro sensors on the wallet device. No raw data
 * leaves the device; only derived buckets are emitted to telemetry.
 *
 *   a = (a_x, a_y, a_z)
 *   θ = atan2(a_x, a_y)
 *   v = ∫ a dt    (drift-prone — not a navigation source)
 *   x = ∫ v dt
 */

export interface Vec3 { x: number; y: number; z: number }
export const ZERO3: Vec3 = { x: 0, y: 0, z: 0 }

export function magnitude(v: Vec3) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/** Tilt angle (radians) of the card relative to gravity in the X/Y plane. */
export function tiltAngle(accel: Vec3): number {
  return Math.atan2(accel.x, accel.y)
}

/** Trapezoidal integration step. */
export function integrate(prev: Vec3, sample: Vec3, dtSec: number): Vec3 {
  return {
    x: prev.x + 0.5 * (prev.x + sample.x) * dtSec,
    y: prev.y + 0.5 * (prev.y + sample.y) * dtSec,
    z: prev.z + 0.5 * (prev.z + sample.z) * dtSec
  }
}

/**
 * Tamper detection: emit `tamper.detect` if peak |a| crosses threshold.
 * Default 4 g (≈ 39.2 m/s²) corresponds to a hard wallet drop.
 */
export function isTamperEvent(accel: Vec3, thresholdGs = 4): boolean {
  return magnitude(accel) >= thresholdGs * 9.80665
}

/** Bucket continuous magnitude into telemetry-friendly categories. */
export function motionBucket(accelMag: number): 'still' | 'walk' | 'run' | 'shock' {
  if (accelMag < 1.5) return 'still'
  if (accelMag < 6.0) return 'walk'
  if (accelMag < 20)  return 'run'
  return 'shock'
}
