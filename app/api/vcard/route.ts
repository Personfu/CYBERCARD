// app/api/vcard/route.ts
// vCard (.vcf) delivery endpoint — also updates tap event with download flag
// GET /api/vcard?card_id=metal_v1&tap_id=<uuid>

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

function isValidId(s: string | null): boolean {
  if (!s) return false
  return /^[a-zA-Z0-9_-]{1,64}$/.test(s)
}

function buildVcf(card: {
  owner_name:    string
  owner_title?:  string | null
  owner_company?: string | null
  owner_email?:  string | null
  linkedin_url?: string | null
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.owner_name}`,
    `N:${card.owner_name.split(' ').reverse().join(';')};;;`,
  ]
  if (card.owner_title)   lines.push(`TITLE:${card.owner_title}`)
  if (card.owner_company) lines.push(`ORG:${card.owner_company}`)
  if (card.owner_email)   lines.push(`EMAIL;TYPE=WORK,INTERNET:${card.owner_email}`)
  if (card.linkedin_url)  lines.push(`URL;TYPE=LinkedIn:${card.linkedin_url}`)
  lines.push('X-CYBERCARD:v1')
  lines.push(`REV:${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export async function GET(req: NextRequest) {
  const url     = new URL(req.url)
  const card_id = url.searchParams.get('card_id')
  const tap_id  = url.searchParams.get('tap_id')

  if (!isValidId(card_id)) {
    return NextResponse.json({ error: 'invalid card_id' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: card } = await supabase
    .from('cards')
    .select('owner_name, owner_title, owner_company, owner_email, linkedin_url, active')
    .eq('card_id', card_id)
    .eq('active', true)
    .single()

  if (!card) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Non-blocking: mark tap event as vcard downloaded
  if (tap_id && isValidId(tap_id)) {
    supabase
      .from('tap_events')
      .update({ metadata: { vcard_downloaded: true } } as never)
      .eq('id', tap_id)
      .then(() => {})
  }

  const vcf      = buildVcf(card)
  const filename = `${card.owner_name.replace(/\s+/g, '_')}.vcf`

  return new NextResponse(vcf, {
    headers: {
      'Content-Type':        'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
