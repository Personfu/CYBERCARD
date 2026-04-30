/**
 * network_client
 * --------------------------------------------------
 * Minimal browser+device fetch wrapper for emitting CyberCard
 * telemetry events to the backend. Handles:
 *   - timeouts
 *   - retry with exponential backoff
 *   - device-shared-secret header for ESP32 telemetry
 *   - graceful no-op when offline (caller decides whether to queue)
 *
 *   T_total = T_tx + T_processing + T_render
 */

export interface SendOptions {
  url: string
  body: unknown
  /** Bearer / shared device token. Not used for browser tap events. */
  deviceToken?: string
  timeoutMs?: number
  retries?: number
  /** Custom fetch (for tests / Node.js polyfills). */
  fetchImpl?: typeof fetch
}

export interface SendResult {
  ok: boolean
  status: number
  attempts: number
  error?: string
}

export async function postJson(opts: SendOptions): Promise<SendResult> {
  const f = opts.fetchImpl ?? fetch
  const retries = opts.retries ?? 2
  const timeoutMs = opts.timeoutMs ?? 4000
  let lastError: string | undefined
  let lastStatus = 0

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (opts.deviceToken) headers['x-cybercard-device'] = opts.deviceToken

      const res = await f(opts.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(opts.body),
        signal: controller.signal,
        keepalive: true
      })
      clearTimeout(timer)
      lastStatus = res.status
      if (res.ok) return { ok: true, status: res.status, attempts: attempt }
      lastError = `http_${res.status}`
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err.message : 'unknown'
    }
    if (attempt <= retries) {
      await sleep(200 * Math.pow(2, attempt - 1))
    }
  }
  return { ok: false, status: lastStatus, attempts: retries + 1, error: lastError }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

/** Standard CyberCard event envelope used by /api/device/telemetry. */
export interface DeviceTelemetryEvent {
  device_id: string
  firmware: string
  event:
    | 'nfc.read' | 'nfc.emulate.activated'
    | 'subghz.rx' | 'subghz.tx'
    | 'ir.learn' | 'ir.replay'
    | 'usb.hid.demo'
    | 'wifi.portal.show' | 'wifi.portal.consent'
    | 'power.low' | 'tamper.detect'
  severity: 'info' | 'warn' | 'crit'
  ts_ms: number
  fields: Record<string, string | number | boolean>
}
