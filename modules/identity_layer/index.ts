/**
 * identity_layer
 * --------------------------------------------------
 * Multi-channel identity resolver: QR + NFC + Network + Consent + Audit.
 *
 *   Identity = f(QR, NFC, Network, Consent, Audit)
 *
 * The tag is never authoritative. The backend handshake is.
 * This module just decides which `/tap?card_id=...` URL to render
 * for the current persona and channel, with the right UTM tagging.
 */

export type Persona = 'metal' | 'demo' | 'ar' | 'gov' | 'file' | 'scan'
export type Channel =
  | 'nfc'
  | 'qr'
  | 'ar'
  | 'wifi_portal'
  | 'usb_demo'
  | 'ble'
  | 'flipper'
  | 'web'

export interface IdentityRequest {
  persona: Persona
  channel: Channel
  /** Optional explicit consent gate (e.g. /risk page). */
  consent?: boolean
  /** Origin override; defaults to NEXT_PUBLIC_SITE_URL or fllc.net. */
  origin?: string
}

const CARD_ID_BY_PERSONA: Record<Persona, string> = {
  metal: 'metal_v1',
  demo:  'demo_v1',
  ar:    'ar_v1',
  gov:   'gov_v1',
  file:  'file_v1',
  scan:  'scan_v1'
}

const MEDIUM_BY_CHANNEL: Record<Channel, string> = {
  nfc:         'card',
  qr:          'card',
  ar:          'marker',
  wifi_portal: 'flipper',
  usb_demo:    'host',
  ble:         'beacon',
  flipper:     'flipper',
  web:         'landing'
}

export function resolveTapUrl(req: IdentityRequest): string {
  const origin =
    req.origin ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
    'https://fllc.net'

  const cardId = CARD_ID_BY_PERSONA[req.persona]
  const medium = MEDIUM_BY_CHANNEL[req.channel]
  const params = new URLSearchParams({
    card_id: cardId,
    utm_source: req.channel,
    utm_medium: medium
  })
  if (req.consent) params.set('consent', '1')
  return `${origin}/tap?${params.toString()}`
}

/** Hash a fingerprint candidate (UA + tz + lang) into a pseudonymous id. */
export async function fingerprint(input: {
  userAgent: string
  language: string
  timezone: string
  screen?: string
}): Promise<string> {
  const data = new TextEncoder().encode(
    [input.userAgent, input.language, input.timezone, input.screen ?? ''].join('|')
  )
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export const IDENTITY_DOCTRINE = [
  'tag is public, backend is authoritative',
  'every channel emits an event, never silent',
  'fingerprints are hashed, raw IPs are not stored',
  'consent is explicit for /risk and gov_v1',
  'restricted personas require JWT handshake'
] as const
