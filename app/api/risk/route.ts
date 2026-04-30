// app/api/risk/route.ts
// Consent-based risk awareness telemetry.
// This route never executes payloads and never collects credentials, files, clipboard, or raw IPs.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function actorHash(req: NextRequest, snapshot: Record<string, unknown>) {
  const ua = req.headers.get('user-agent') ?? ''
  const lang = req.headers.get('accept-language') ?? ''
  const timezone = typeof snapshot.timezone === 'string' ? snapshot.timezone : ''
  const screen = typeof snapshot.screen === 'string' ? snapshot.screen : ''
  return sha256(`${ua}|${lang}|${timezone}|${screen}`)
}

function sanitizeSnapshot(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {}
  const raw = input as Record<string, unknown>
  const allowed = [
    'timezone',
    'language',
    'screen',
    'color_depth',
    'touch_points',
    'platform',
    'do_not_track',
    'referrer_present',
    'url_path',
  ]
  const clean: Record<string, unknown> = {}
  for (const key of allowed) {
    const value = raw[key]
    if (typeof value === 'string') clean[key] = value.slice(0, 160)
    if (typeof value === 'number') clean[key] = value
    if (typeof value === 'boolean') clean[key] = value
  }
  return clean
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as null | {
    consent?: boolean
    scenario?: string
    snapshot?: Record<string, unknown>
    indicators?: string[]
  }

  if (!body?.consent) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 })
  }

  const snapshot = sanitizeSnapshot(body.snapshot)
  const indicators = Array.isArray(body.indicators)
    ? body.indicators.filter((item) => typeof item === 'string').map((item) => item.slice(0, 80)).slice(0, 20)
    : []

  const supabase = createClient()
  const actor_hash = actorHash(req, snapshot)

  const { data, error } = await supabase.from('risk_events').insert({
    actor_hash,
    scenario: (body.scenario ?? 'risk_awareness').slice(0, 80),
    url_path: typeof snapshot.url_path === 'string' ? snapshot.url_path : '/risk',
    referrer_present: Boolean(snapshot.referrer_present),
    ip_country: req.headers.get('x-vercel-ip-country'),
    ua_family: (req.headers.get('user-agent') ?? '').slice(0, 120),
    safe_snapshot: snapshot,
    indicators,
  }).select('id').single()

  if (error) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  try {
    await supabase.from('audit_events').insert({
      card_id: 'system',
      event_type: 'admin_view',
      actor_hash,
      ip_country: req.headers.get('x-vercel-ip-country'),
      ua_raw: (req.headers.get('user-agent') ?? '').slice(0, 300),
      metadata: { risk_event_id: data.id, scenario: body.scenario ?? 'risk_awareness' },
    })
  } catch {}

  return NextResponse.json({ ok: true, risk_event_id: data.id })
}
