// emails/templates.tsx
// React Email templates · use with @react-email/components
// Render via: import { render } from '@react-email/render'

import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Link, Row, Column,
} from '@react-email/components'

const colors = {
  bg: '#06070a',
  surface: '#0d0e13',
  text: '#e8e4dc',
  muted: '#6b6b72',
  neon: '#00e5c8',
  gold: '#c9a84c',
  red: '#ff3b3b',
  border: 'rgba(255,255,255,0.07)',
}

const baseStyle = {
  body:      { background: colors.bg, color: colors.text, fontFamily: 'monospace', padding: 32 },
  container: { maxWidth: 560, margin: '0 auto' },
  card:      { border: `1px solid ${colors.neon}33`, borderRadius: 8, padding: 32, background: colors.surface },
  tag:       { color: colors.neon, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' as const, margin: '0 0 16px' },
  h1:        { fontSize: 28, color: '#fff', letterSpacing: 3, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif" },
  body_text: { fontSize: 13, lineHeight: 1.7, color: '#aaa', margin: '0 0 20px' },
  divider:   { borderColor: 'rgba(255,255,255,0.06)', margin: '20px 0' },
  footer:    { fontSize: 9, color: '#444', textAlign: 'center' as const, marginTop: 24, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  cta:       { display: 'inline-block' as const, marginTop: 12, padding: '12px 24px', background: 'rgba(0,229,200,0.1)', border: `1px solid ${colors.neon}`, color: colors.neon, textDecoration: 'none', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, borderRadius: 4 },
  row_label: { fontSize: 11, color: colors.muted, padding: '6px 0', borderBottom: `1px solid ${colors.border}` },
  row_value: { fontSize: 11, color: '#ccc', padding: '6px 0', textAlign: 'right' as const, borderBottom: `1px solid ${colors.border}` },
}

// =========================================================
// 1. FIRST TAP — Preston gets pinged when a new contact taps
// =========================================================
export interface FirstTapProps {
  card_id: string
  city?: string
  country?: string
  utm_source: string
  ua: string
  tap_id: string
  tapped_at: string
}

export function FirstTapEmail({ card_id, city, country, utm_source, ua, tap_id, tapped_at }: FirstTapProps) {
  return (
    <Html>
      <Head />
      <Body style={baseStyle.body}>
        <Container style={baseStyle.container}>
          <Section style={baseStyle.card}>
            <Text style={baseStyle.tag}>● new tap · first contact</Text>
            <Heading style={baseStyle.h1}>card: {card_id.toUpperCase()}</Heading>
            <Hr style={baseStyle.divider} />
            <Row><Column style={baseStyle.row_label}>Location</Column><Column style={baseStyle.row_value}>{city ?? '—'}, {country ?? '??'}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Source</Column><Column style={baseStyle.row_value}>{utm_source}</Column></Row>
            <Row><Column style={baseStyle.row_label}>UA</Column><Column style={baseStyle.row_value}>{ua.slice(0, 60)}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Tap ID</Column><Column style={{ ...baseStyle.row_value, color: colors.neon, fontSize: 9 }}>{tap_id}</Column></Row>
            <Text style={{ ...baseStyle.body_text, fontSize: 9, color: '#444', marginTop: 20 }}>
              {new Date(tapped_at).toUTCString()} · furulie llc cybercard system
            </Text>
          </Section>
          <Text style={baseStyle.footer}>furulie llc · build.deploy.scale</Text>
        </Container>
      </Body>
    </Html>
  )
}

// =========================================================
// 2. RETURNING TAP — same fingerprint, different card
// =========================================================
export interface ReturningTapProps {
  card_id: string
  city?: string
  cards_tapped: string[]
  tap_count: number
}

export function ReturningTapEmail({ card_id, city, cards_tapped, tap_count }: ReturningTapProps) {
  return (
    <Html>
      <Head />
      <Body style={baseStyle.body}>
        <Container style={baseStyle.container}>
          <Section style={{ ...baseStyle.card, borderColor: `${colors.gold}33` }}>
            <Text style={{ ...baseStyle.tag, color: colors.gold }}>○ returning tap · contact warming</Text>
            <Heading style={baseStyle.h1}>same fingerprint detected</Heading>
            <Text style={baseStyle.body_text}>
              this contact has now tapped <span style={{ color: colors.gold }}>{tap_count} times</span> across <span style={{ color: colors.gold }}>{cards_tapped.length} cards</span>. signal: warm.
            </Text>
            <Hr style={baseStyle.divider} />
            <Row><Column style={baseStyle.row_label}>Latest card</Column><Column style={baseStyle.row_value}>{card_id}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Cards seen</Column><Column style={baseStyle.row_value}>{cards_tapped.join(', ')}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Geo</Column><Column style={baseStyle.row_value}>{city ?? '—'}</Column></Row>
            <Hr style={baseStyle.divider} />
            <Text style={{ ...baseStyle.body_text, fontSize: 11, color: colors.gold, margin: '16px 0 0' }}>
              recommended action: reach out manually within 24h
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// =========================================================
// 3. GOV AUDIT — restricted access event
// =========================================================
export interface GovAuditProps {
  card_id: string
  event_type: string
  actor_hash: string
  ip_country?: string
  occurred_at: string
}

export function GovAuditEmail({ card_id, event_type, actor_hash, ip_country, occurred_at }: GovAuditProps) {
  const isGrant = event_type === 'access_granted'
  const accent = isGrant ? colors.neon : colors.red
  return (
    <Html>
      <Head />
      <Body style={baseStyle.body}>
        <Container style={baseStyle.container}>
          <Section style={{ ...baseStyle.card, borderColor: `${accent}55` }}>
            <Text style={{ ...baseStyle.tag, color: accent }}>
              {isGrant ? '✓ access granted' : '✗ access denied'} · {card_id}
            </Text>
            <Heading style={baseStyle.h1}>audit event · gov_v1</Heading>
            <Hr style={baseStyle.divider} />
            <Row><Column style={baseStyle.row_label}>Event</Column><Column style={baseStyle.row_value}>{event_type}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Actor</Column><Column style={{ ...baseStyle.row_value, fontSize: 9 }}>{actor_hash.slice(0, 24)}...</Column></Row>
            <Row><Column style={baseStyle.row_label}>IP country</Column><Column style={baseStyle.row_value}>{ip_country ?? '??'}</Column></Row>
            <Row><Column style={baseStyle.row_label}>Time</Column><Column style={baseStyle.row_value}>{new Date(occurred_at).toUTCString()}</Column></Row>
            <Text style={{ ...baseStyle.body_text, fontSize: 10, color: accent, marginTop: 20, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
              full chain available in audit_events table
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// =========================================================
// 4. DEFCON SOLVED — challenge cracked, route to lead pipeline
// =========================================================
export interface DefconSolvedProps {
  challenge_hash: string
  isFirstSolver: boolean
  attempts: number
  reward_tier: string
}

export function DefconSolvedEmail({ challenge_hash, isFirstSolver, attempts, reward_tier }: DefconSolvedProps) {
  return (
    <Html>
      <Head />
      <Body style={baseStyle.body}>
        <Container style={baseStyle.container}>
          <Section style={{ ...baseStyle.card, borderColor: isFirstSolver ? colors.gold : colors.neon }}>
            <Text style={{ ...baseStyle.tag, color: isFirstSolver ? colors.gold : colors.neon }}>
              {isFirstSolver ? '★ first solver' : '● solver detected'}
            </Text>
            <Heading style={baseStyle.h1}>{challenge_hash}</Heading>
            <Text style={baseStyle.body_text}>
              someone just cracked the back-of-card hash. {isFirstSolver ? 'first one through.' : `solver number ${attempts}.`} reward tier: <span style={{ color: colors.gold }}>{reward_tier}</span>.
            </Text>
            <Hr style={baseStyle.divider} />
            <Text style={{ ...baseStyle.body_text, fontSize: 11, color: colors.gold }}>
              this is qualified inbound. reply within 24 hours · close within a week.
            </Text>
            <Link href="https://fllc.net/dashboard/cards" style={baseStyle.cta}>
              open dashboard ↗
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// =========================================================
// USAGE — server-side render to HTML string before send
// =========================================================
//
// import { render } from '@react-email/render'
// import { FirstTapEmail } from './emails/templates'
//
// const html = render(<FirstTapEmail
//   card_id="metal_v1"
//   city="Phoenix"
//   country="US"
//   utm_source="nfc"
//   ua={req.headers.get('user-agent') ?? ''}
//   tap_id={tapId}
//   tapped_at={new Date().toISOString()}
// />)
//
// await resend.emails.send({ from, to, subject, html })
