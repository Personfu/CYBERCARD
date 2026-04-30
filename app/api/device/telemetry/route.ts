// app/api/device/telemetry/route.ts
// Device health intake for CyberCard ESP32 prototypes.
// Accepts status data only: battery, firmware, mode, and coarse RF buckets.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isValidId(value: string | undefined) {
  return !!value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | {
    device_id?: string
    card_id?: string
    firmware_version?: string
    mode?: string
    battery_percent?: number
    battery_mv?: number
    rssi_bucket?: number
    wifi_rssi?: number
    ble_seen_count?: number
    error_code?: string
    metadata?: Record<string, unknown>
  }

  if (!body || !isValidId(body.device_id)) {
    return NextResponse.json({ error: 'invalid device_id' }, { status: 400 })
  }

  const expected = process.env.DEVICE_TELEMETRY_TOKEN
  const presented = req.headers.get('x-device-token') ?? ''
  if (expected && presented !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const deviceHash = sha256(body.device_id!)

  await supabase.from('device_telemetry').insert({
    device_id: deviceHash,
    card_id: isValidId(body.card_id) ? body.card_id : null,
    firmware_version: body.firmware_version?.slice(0, 40),
    mode: body.mode?.slice(0, 40),
    battery_percent: typeof body.battery_percent === 'number' ? body.battery_percent : null,
    battery_mv: typeof body.battery_mv === 'number' ? Math.round(body.battery_mv) : null,
    rssi_bucket: typeof body.rssi_bucket === 'number' ? Math.round(body.rssi_bucket) : null,
    wifi_rssi: typeof body.wifi_rssi === 'number' ? Math.round(body.wifi_rssi) : null,
    ble_seen_count: typeof body.ble_seen_count === 'number' ? Math.round(body.ble_seen_count) : null,
    error_code: body.error_code?.slice(0, 80),
    metadata: body.metadata ?? {},
  })

  return NextResponse.json({ ok: true })
}
