// app/api/challenge/route.ts
// DEFCON puzzle API — verify submitted answer, mint reward JWT, audit everything
// Answer seeded in 002_audit_and_tenancy.sql → sha256('cyberflipper')

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SignJWT } from 'jose'
import { createHash } from 'crypto'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const REWARD_TTL_S = 3600 * 24          // reward JWT valid 24h
const SECRET = new TextEncoder().encode(process.env.GOV_JWT_SECRET!)
function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function sha256(s: string) {
  return createHash('sha256').update(s.trim().toLowerCase()).digest('hex')
}

function fingerprint(req: NextRequest): string {
  const ua = req.headers.get('user-agent') ?? ''
  const al = req.headers.get('accept-language') ?? ''
  const co = req.headers.get('x-vercel-ip-country') ?? ''
  return sha256(`${ua}|${al}|${co}`)
}

export async function POST(req: NextRequest) {
  const body: { hash: string; answer: string } = await req.json()
  if (!body.hash || !body.answer?.trim()) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = createClient()
  const fp = fingerprint(req)

  // Resolve challenge by back-of-card hash
  const { data: challenge, error } = await supabase
    .from('challenges')
    .select('id, solution_hash, reward_url, reward_payload, attempts, solved_count, first_solver_hash, active')
    .eq('challenge_hash', body.hash)
    .eq('active', true)
    .single()

  if (error || !challenge) {
    return NextResponse.json({ error: 'unknown challenge' }, { status: 404 })
  }

  const submitted_hash = sha256(body.answer)
  const correct = submitted_hash === challenge.solution_hash

  // Record attempt
  await supabase.from('challenge_attempts').insert({
    challenge_id:     challenge.id,
    fingerprint_hash: fp,
    submitted_value:  body.answer.slice(0, 80),   // store truncated, not raw
    correct,
  })

  // Update counters
  const updates: Record<string, unknown> = {
    attempts: (challenge.attempts ?? 0) + 1,
  }

  if (correct) {
    updates.solved_count = (challenge.solved_count ?? 0) + 1
    if (!challenge.first_solver_hash) {
      updates.first_solved_at  = new Date().toISOString()
      updates.first_solver_hash = fp
    }
  }

  await supabase.from('challenges').update(updates).eq('id', challenge.id)

  if (!correct) {
    return NextResponse.json({ correct: false, attempts: updates.attempts })
  }

  // Mint reward JWT
  const first = !challenge.first_solver_hash
  const jti   = crypto.randomUUID()
  const rewardJwt = await new SignJWT({
    sub:         'challenge_reward',
    challenge_id: challenge.id,
    solver_fp:   fp,
    first_solver: first,
    typ:         'reward',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime(`${REWARD_TTL_S}s`)
    .sign(SECRET)

  // Notify Preston
  await getResend().emails.send({
    from:    'CyberCard <noreply@fllc.net>',
    to:      'preston@fllc.net',
    subject: first
      ? `★ FIRST SOLVER — DEFCON challenge cracked`
      : `● Challenge solve #${updates.solved_count}`,
    html: `
      <pre style="font-family:monospace;background:#06070a;color:#e8e4dc;padding:24px;border:1px solid ${first ? '#c9a84c' : '#00e5c8'}33">
${first ? '★ FIRST SOLVER' : `● SOLVER #${updates.solved_count}`}

fingerprint : ${fp}
challenge   : ${body.hash}
country     : ${req.headers.get('x-vercel-ip-country') ?? '??'}
ua          : ${(req.headers.get('user-agent') ?? '').slice(0, 80)}
jti         : ${jti}
      </pre>
    `,
  }).catch(() => {})   // non-blocking, log in audit

  // Audit
  try {
    await supabase.from('audit_events').insert({
      card_id:    'challenge',
      event_type: 'challenge_solved',
      actor_hash: fp,
      jwt_jti:    jti,
      ip_country: req.headers.get('x-vercel-ip-country'),
      ua_raw:     (req.headers.get('user-agent') ?? '').slice(0, 300),
      metadata:   { first_solver: first, solve_count: updates.solved_count },
    })
  } catch {}

  return NextResponse.json({
    correct:      true,
    first_solver: first,
    reward_url:   challenge.reward_url,
    reward_jwt:   rewardJwt,
    payload:      challenge.reward_payload,
  })
}
