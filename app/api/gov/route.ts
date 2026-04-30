// app/api/gov/route.ts
// gov_v1 audit gate · signed JWT challenge handshake
//
// FLOW
//   1. GET  /api/gov?card_id=gov_v1
//      → returns { challenge_jti, nonce, expires_at, sign_with }
//   2. Client (or device) signs nonce with its private key
//   3. POST /api/gov  { challenge_jti, signature, public_key }
//      → server verifies, issues short-lived access JWT
//   4. /tap?card_id=gov_v1 reads access JWT from cookie, gates render
//
// Every step writes to audit_events. No silent access.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SignJWT, jwtVerify, importJWK } from 'jose'
import { randomUUID, createHash, randomBytes } from 'crypto'

export const runtime = 'nodejs'

const SERVER_SECRET = new TextEncoder().encode(process.env.GOV_JWT_SECRET!)
const CHALLENGE_TTL_S = 120
const ACCESS_TTL_S = 600

// ---------- helpers ----------
function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function clientFingerprint(req: NextRequest): string {
  const ua = req.headers.get('user-agent') ?? ''
  const al = req.headers.get('accept-language') ?? ''
  const co = req.headers.get('x-vercel-ip-country') ?? ''
  return sha256(`${ua}|${al}|${co}`)
}

async function audit(
  card_id: string,
  event_type: string,
  req: NextRequest,
  meta: Record<string, unknown> = {},
) {
  const supabase = createClient()
  await supabase.from('audit_events').insert({
    card_id,
    event_type,
    actor_hash: clientFingerprint(req),
    ip_country: req.headers.get('x-vercel-ip-country'),
    ip_region: req.headers.get('x-vercel-ip-country-region'),
    ua_raw: (req.headers.get('user-agent') ?? '').slice(0, 300),
    metadata: meta,
  })
}

// ---------- GET — issue challenge ----------
export async function GET(req: NextRequest) {
  const card_id = new URL(req.url).searchParams.get('card_id') ?? 'gov_v1'

  // Issue a short-lived challenge JWT bound to fingerprint
  const jti = randomUUID()
  const nonce = randomBytes(32).toString('hex')
  const fp = clientFingerprint(req)

  const challenge = await new SignJWT({
    sub: card_id,
    nonce,
    fp,
    typ: 'challenge',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime(`${CHALLENGE_TTL_S}s`)
    .sign(SERVER_SECRET)

  await audit(card_id, 'challenge_issued', req, { jti })

  return NextResponse.json({
    challenge_jti: jti,
    challenge_jwt: challenge,
    nonce,
    expires_in: CHALLENGE_TTL_S,
    sign_with: 'Ed25519 or RS256 of nonce; submit { challenge_jwt, signature, public_jwk }',
  })
}

// ---------- POST — verify signature, issue access JWT ----------
export async function POST(req: NextRequest) {
  const body: {
    challenge_jwt: string
    signature: string  // hex
    public_jwk: JsonWebKey
  } = await req.json()

  let card_id = 'gov_v1'
  try {
    // 1. Verify the challenge JWT we issued is still valid
    const { payload } = await jwtVerify(body.challenge_jwt, SERVER_SECRET, {
      typ: 'JWT',
    })
    card_id = (payload.sub as string) ?? 'gov_v1'

    if (payload.typ !== 'challenge') throw new Error('wrong typ')
    if (payload.fp !== clientFingerprint(req)) throw new Error('fp drift')

    const nonce = payload.nonce as string

    // 2. Verify the client's signature over the nonce using submitted JWK
    const key = await importJWK(body.public_jwk as never, 'EdDSA')
    const sigBytes = Uint8Array.from(
      body.signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    )
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key as CryptoKey,
      sigBytes,
      new TextEncoder().encode(nonce),
    )
    if (!ok) throw new Error('bad signature')

    // 3. Issue access JWT — short-lived, fingerprint-bound
    const access_jti = randomUUID()
    const access = await new SignJWT({
      sub: card_id,
      fp: clientFingerprint(req),
      typ: 'access',
      tier: 'gov',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setJti(access_jti)
      .setExpirationTime(`${ACCESS_TTL_S}s`)
      .sign(SERVER_SECRET)

    await audit(card_id, 'challenge_solved', req, {
      challenge_jti: payload.jti,
      access_jti,
    })
    await audit(card_id, 'access_granted', req, { jti: access_jti })

    const res = NextResponse.json({
      access_jwt: access,
      expires_in: ACCESS_TTL_S,
    })
    res.cookies.set('gov_access', access, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: ACCESS_TTL_S,
      path: '/tap',
    })
    return res
  } catch (err) {
    await audit(card_id, 'challenge_failed', req, {
      error: (err as Error).message,
    })
    return NextResponse.json(
      { error: 'challenge_failed' },
      { status: 401 },
    )
  }
}
