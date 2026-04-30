// app/api/tap/route.ts
// Core tap handler — fingerprint, geo, dedup, email trigger
// Called by TapClient.tsx on every /tap page load

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { createHash } from 'crypto'
import { FirstTapEmail, ReturningTapEmail } from '@/emails/templates'

export const runtime = 'nodejs'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

interface TapBody {
  card_id:    string
  card_type:  string
  fingerprint: {
    tz:     string
    lang:   string
    screen: string
    touch:  boolean
    ua:     string
  }
  utm_source: string
  utm_medium: string
}

function hashFingerprint(fp: TapBody['fingerprint'], req: NextRequest): string {
  const ua  = req.headers.get('user-agent') ?? fp.ua
  const al  = req.headers.get('accept-language') ?? fp.lang
  const co  = req.headers.get('x-vercel-ip-country') ?? ''
  const tz  = fp.tz
  const scr = fp.screen
  return createHash('sha256')
    .update(`${ua}|${al}|${co}|${tz}|${scr}`)
    .digest('hex')
}

// Simple input validation — card_id must be alphanumeric + underscores
function isValidCardId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id)
}

export async function POST(req: NextRequest) {
  let body: TapBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!isValidCardId(body.card_id ?? '')) {
    return NextResponse.json({ error: 'invalid card_id' }, { status: 400 })
  }

  const supabase = createClient()

  // Verify card exists and is active
  const { data: card } = await supabase
    .from('cards')
    .select('card_id, card_type, owner_email, owner_name, linkedin_url, vcard_url, redirect_url, email_trigger, one_time_email, active')
    .eq('card_id', body.card_id)
    .eq('active', true)
    .single()

  if (!card) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const fpHash = hashFingerprint(body.fingerprint, req)

  // Geo from Vercel edge headers
  const geo = {
    city:    req.headers.get('x-vercel-ip-city')            ?? null,
    region:  req.headers.get('x-vercel-ip-country-region')  ?? null,
    country: req.headers.get('x-vercel-ip-country')         ?? null,
    lat:     req.headers.get('x-vercel-ip-latitude')        ? parseFloat(req.headers.get('x-vercel-ip-latitude')!) : null,
    lng:     req.headers.get('x-vercel-ip-longitude')       ? parseFloat(req.headers.get('x-vercel-ip-longitude')!) : null,
  }

  // Check for existing contact record (first tap detection)
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, tap_count, cards_tapped')
    .eq('fingerprint_hash', fpHash)
    .single()

  const isFirstTap = !existingContact
  const tapId      = crypto.randomUUID()

  // Insert tap event
  await supabase.from('tap_events').insert({
    id:               tapId,
    card_id:          body.card_id,
    card_type:        card.card_type,
    fingerprint_hash: fpHash,
    geo_city:         geo.city,
    geo_region:       geo.region,
    geo_country:      geo.country,
    geo_lat:          geo.lat,
    geo_lng:          geo.lng,
    ua_raw:           (body.fingerprint.ua ?? '').slice(0, 300),
    utm_source:       (body.utm_source ?? 'nfc').slice(0, 64),
    utm_medium:       (body.utm_medium ?? 'card').slice(0, 64),
    is_first_tap:     isFirstTap,
    email_sent:       false,
  })

  // Upsert contact record
  if (isFirstTap) {
    await supabase.from('contacts').insert({
      fingerprint_hash: fpHash,
      tap_count:        1,
      cards_tapped:     [body.card_id],
      geo_country:      geo.country,
      geo_city:         geo.city,
    })
  } else {
    const cardsSeen = existingContact!.cards_tapped ?? []
    if (!cardsSeen.includes(body.card_id)) {
      cardsSeen.push(body.card_id)
    }
    await supabase.from('contacts').update({
      last_seen_at:  new Date().toISOString(),
      tap_count:     (existingContact!.tap_count ?? 0) + 1,
      cards_tapped:  cardsSeen,
    }).eq('fingerprint_hash', fpHash)
  }

  // Email logic — fire if owner wants alerts
  if (card.email_trigger && card.owner_email) {
    const shouldSend = isFirstTap || !card.one_time_email
    if (shouldSend) {
      let html: string
      if (isFirstTap) {
        html = await render(
          FirstTapEmail({
            card_id:    body.card_id,
            city:       geo.city ?? undefined,
            country:    geo.country ?? undefined,
            utm_source: body.utm_source,
            ua:         body.fingerprint.ua,
            tap_id:     tapId,
            tapped_at:  new Date().toISOString(),
          }),
        )
        await getResend().emails.send({
          from:    'CyberCard System <noreply@fllc.net>',
          to:      card.owner_email,
          subject: `● New tap on ${body.card_id} — ${geo.city ?? 'unknown location'}`,
          html,
        })
      } else {
        html = await render(
          ReturningTapEmail({
            card_id:     body.card_id,
            city:        geo.city ?? undefined,
            cards_tapped: existingContact!.cards_tapped ?? [body.card_id],
            tap_count:   (existingContact!.tap_count ?? 0) + 1,
          }),
        )
        await getResend().emails.send({
          from:    'CyberCard System <noreply@fllc.net>',
          to:      card.owner_email,
          subject: `○ Returning contact on ${body.card_id} — tap #${(existingContact!.tap_count ?? 0) + 1}`,
          html,
        })
      }

      await supabase
        .from('tap_events')
        .update({ email_sent: true })
        .eq('id', tapId)
    }
  }

  // Response — tell client what to render
  const action = card.redirect_url ? 'redirect' : 'render'

  return NextResponse.json({
    tap_id:    tapId,
    first_tap: isFirstTap,
    action,
    card: {
      card_id:      card.card_id,
      owner_name:   card.owner_name,
      linkedin_url: card.linkedin_url,
      vcard_url:    card.vcard_url,
    },
  })
}
