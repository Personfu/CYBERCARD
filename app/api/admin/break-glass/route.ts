// app/api/admin/break-glass/route.ts
// Visible, auditable break-glass request intake.
// Not a backdoor: this route records intent only unless explicitly enabled and authorized.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

const ACTIONS = new Set(['revoke_card', 'pause_email', 'rotate_challenge', 'export_audit', 'note_only'])
const TARGETS = new Set(['card', 'challenge', 'org', 'system'])

function actorHash(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  const al = req.headers.get('accept-language') ?? ''
  return createHash('sha256').update(`${ua}|${al}`).digest('hex')
}

export async function POST(req: NextRequest) {
  if (process.env.BREAK_GLASS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'break_glass_disabled' }, { status: 403 })
  }

  const token = req.headers.get('x-admin-token') ?? ''
  if (!process.env.BREAK_GLASS_ADMIN_TOKEN || token !== process.env.BREAK_GLASS_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as null | {
    action?: string
    target_type?: string
    target_id?: string
    reason?: string
    metadata?: Record<string, unknown>
  }

  if (!body || !ACTIONS.has(body.action ?? '') || !TARGETS.has(body.target_type ?? '') || !body.target_id || !body.reason) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = createClient()
  const requestedBy = actorHash(req)

  const { data, error } = await supabase.from('break_glass_events').insert({
    requested_by: requestedBy,
    action: body.action,
    target_type: body.target_type,
    target_id: body.target_id.slice(0, 120),
    reason: body.reason.slice(0, 500),
    metadata: body.metadata ?? {},
  }).select('id, expires_at').single()

  if (error) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  try {
    await supabase.from('audit_events').insert({
      card_id: body.target_type === 'card' ? body.target_id : 'system',
      event_type: 'admin_view',
      actor_hash: requestedBy,
      metadata: {
        break_glass_event_id: data.id,
        action: body.action,
        target_type: body.target_type,
        reason: body.reason,
      },
    })
  } catch {}

  return NextResponse.json({ ok: true, break_glass_event_id: data.id, expires_at: data.expires_at })
}
