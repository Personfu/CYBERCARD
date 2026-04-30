'use client'

/**
 * AgencyLoader
 * -------------------------------------------------------------------
 * Full-screen loading / transition scene rendered as a constellation
 * of US intelligence, defense, cyber, space, nuclear, treasury,
 * homeland and federal research agency seals — styled white-on-black
 * to match the CyberCard "FLLC" aesthetic and the reference plates.
 *
 * Drop-in usage:
 *
 *   import { AgencyLoader } from '@/app/components/AgencyLoader'
 *   <AgencyLoader label="ESTABLISHING SECURE CHANNEL" />
 *
 * Or as a transition gate:
 *
 *   <AgencyLoader minDurationMs={1800} onDone={() => setReady(true)} />
 *
 * All seals are pure SVG (no raster, no external fonts required), so
 * the component is safe to ship to production and renders identically
 * across browsers, OG snapshots, and printed PDFs.
 * -------------------------------------------------------------------
 */

import { useEffect, useMemo, useRef, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Agency catalog                                                      */
/* ------------------------------------------------------------------ */

export type SealCategory =
  | 'intelligence'
  | 'cyber'
  | 'space'
  | 'nuclear'
  | 'lawenf'
  | 'treasury'
  | 'homeland'
  | 'research'

export interface Agency {
  id: string
  abbr: string                // big center text, e.g. "NSA"
  outerTop: string            // text along top arc
  outerBottom?: string        // text along bottom arc (optional)
  motif: SealMotif            // central illustration
  category: SealCategory
}

type SealMotif =
  | 'eagle'
  | 'globe'
  | 'compass'
  | 'star'
  | 'shield'
  | 'atom'
  | 'trident'
  | 'rocket'
  | 'spear'
  | 'torch'
  | 'scales'
  | 'gear'
  | 'badge'
  | 'flame'
  | 'satellite'

export const AGENCIES: Agency[] = [
  /* --- Intelligence / Black Program adjacent --- */
  { id: 'nga',  abbr: 'NGA',  outerTop: 'NATIONAL GEOSPATIAL-INTELLIGENCE AGENCY', outerBottom: 'UNITED STATES OF AMERICA', motif: 'globe',     category: 'intelligence' },
  { id: 'nro',  abbr: 'NRO',  outerTop: 'NATIONAL RECONNAISSANCE OFFICE',         outerBottom: 'UNITED STATES OF AMERICA', motif: 'globe',     category: 'intelligence' },
  { id: 'odni', abbr: 'ODNI', outerTop: 'OFFICE OF THE DIRECTOR',                 outerBottom: 'OF NATIONAL INTELLIGENCE', motif: 'eagle',     category: 'intelligence' },
  { id: 'dia',  abbr: 'DIA',  outerTop: 'DEFENSE INTELLIGENCE AGENCY',            outerBottom: 'UNITED STATES OF AMERICA', motif: 'torch',     category: 'intelligence' },
  { id: 'iarpa',abbr: 'IARPA',outerTop: 'INTELLIGENCE ADVANCED RESEARCH',         outerBottom: 'PROJECTS ACTIVITY',        motif: 'atom',      category: 'intelligence' },
  { id: 'jsoc', abbr: 'JSOC', outerTop: 'JOINT SPECIAL OPERATIONS COMMAND',       outerBottom: 'UNITED STATES',            motif: 'spear',     category: 'intelligence' },
  { id: 'sac',  abbr: 'SAC',  outerTop: 'SPECIAL ACTIVITIES CENTER',              outerBottom: 'CENTRAL INTELLIGENCE AGENCY', motif: 'compass',category: 'intelligence' },
  { id: 'oni',  abbr: 'ONI',  outerTop: 'OFFICE OF NAVAL INTELLIGENCE',           outerBottom: 'EST. 1882',                motif: 'shield',    category: 'intelligence' },
  { id: 'cia',  abbr: 'CIA',  outerTop: 'CENTRAL INTELLIGENCE AGENCY',            outerBottom: 'UNITED STATES OF AMERICA', motif: 'compass',   category: 'intelligence' },

  /* --- Cyber / Signal / Network Warfare --- */
  { id: 'uscc', abbr: 'USCYBERCOM', outerTop: 'UNITED STATES CYBER COMMAND',      outerBottom: 'IN GOD WE TRUST',          motif: 'eagle',     category: 'cyber' },
  { id: 'nsa',  abbr: 'NSA',  outerTop: 'NATIONAL SECURITY AGENCY',               outerBottom: 'UNITED STATES OF AMERICA', motif: 'eagle',     category: 'cyber' },
  { id: 'css',  abbr: 'CSS',  outerTop: 'CENTRAL SECURITY SERVICE',               outerBottom: 'UNITED STATES OF AMERICA', motif: 'eagle',     category: 'cyber' },
  { id: 'arcyber',abbr:'ARCYBER',outerTop:'U.S. ARMY CYBER COMMAND',              outerBottom: 'UNITED STATES ARMY',       motif: 'shield',    category: 'cyber' },
  { id: 'fcc',  abbr: 'FCC',  outerTop: 'FLEET CYBER COMMAND',                    outerBottom: 'UNITED STATES NAVY',       motif: 'trident',   category: 'cyber' },
  { id: '16af', abbr: '16AF', outerTop: 'SIXTEENTH AIR FORCE',                    outerBottom: 'AIR FORCES CYBER',         motif: 'globe',     category: 'cyber' },
  { id: 'sd6',  abbr: 'D6',   outerTop: 'SPACE DELTA 6',                          outerBottom: 'CYBER OPERATIONS',         motif: 'rocket',    category: 'cyber' },
  { id: 'jfhqc',abbr: 'JFHQ-C',outerTop:'JOINT FORCE HEADQUARTERS',              outerBottom: 'CYBER',                    motif: 'shield',    category: 'cyber' },

  /* --- Space / Advanced Systems --- */
  { id: 'ssc',  abbr: 'SSC',  outerTop: 'U.S. SPACE SYSTEMS COMMAND',             outerBottom: 'UNITED STATES SPACE FORCE',motif: 'rocket',    category: 'space' },
  { id: 'sda',  abbr: 'SDA',  outerTop: 'SPACE DEVELOPMENT AGENCY',               outerBottom: 'DEPARTMENT OF DEFENSE',    motif: 'satellite', category: 'space' },
  { id: 'mda',  abbr: 'MDA',  outerTop: 'MISSILE DEFENSE AGENCY',                 outerBottom: 'DEPARTMENT OF DEFENSE',    motif: 'rocket',    category: 'space' },
  { id: 'nsic', abbr: 'NSIC', outerTop: 'NATIONAL SPACE INTELLIGENCE CENTER',     outerBottom: 'UNITED STATES SPACE FORCE',motif: 'satellite', category: 'space' },
  { id: 'afrl', abbr: 'AFRL', outerTop: 'AIR FORCE RESEARCH LABORATORY',          outerBottom: 'UNITED STATES AIR FORCE',  motif: 'rocket',    category: 'space' },
  { id: 'darpa',abbr: 'DARPA',outerTop: 'DEFENSE ADVANCED RESEARCH',              outerBottom: 'PROJECTS AGENCY',          motif: 'globe',     category: 'space' },
  { id: 'nasa', abbr: 'NASA', outerTop: 'NATIONAL AERONAUTICS',                   outerBottom: 'AND SPACE ADMINISTRATION', motif: 'rocket',    category: 'space' },

  /* --- Nuclear / Strategic Command --- */
  { id: 'stratcom',abbr:'USSTRATCOM',outerTop:'UNITED STATES STRATEGIC COMMAND',  outerBottom: 'PEACE IS OUR PROFESSION',  motif: 'shield',    category: 'nuclear' },
  { id: 'afgsc',abbr: 'AFGSC',outerTop: 'AIR FORCE GLOBAL STRIKE COMMAND',        outerBottom: 'UNITED STATES AIR FORCE',  motif: 'eagle',     category: 'nuclear' },
  { id: 'ssp',  abbr: 'SSP',  outerTop: 'NAVAL STRATEGIC SYSTEMS PROGRAMS',       outerBottom: 'UNITED STATES NAVY',       motif: 'trident',   category: 'nuclear' },
  { id: 'nnsa', abbr: 'NNSA', outerTop: 'NATIONAL NUCLEAR SECURITY',              outerBottom: 'ADMINISTRATION',           motif: 'atom',      category: 'nuclear' },
  { id: 'dtra', abbr: 'DTRA', outerTop: 'DEFENSE THREAT REDUCTION AGENCY',        outerBottom: 'DEPARTMENT OF DEFENSE',    motif: 'atom',      category: 'nuclear' },

  /* --- Federal Law Enforcement --- */
  { id: 'usms', abbr: 'USMS', outerTop: 'UNITED STATES MARSHALS SERVICE',         outerBottom: 'EST. 1789',                motif: 'star',      category: 'lawenf' },
  { id: 'dss',  abbr: 'DSS',  outerTop: 'DIPLOMATIC SECURITY SERVICE',            outerBottom: 'U.S. DEPARTMENT OF STATE', motif: 'star',      category: 'lawenf' },
  { id: 'fps',  abbr: 'FPS',  outerTop: 'FEDERAL PROTECTIVE SERVICE',             outerBottom: 'POLICE',                   motif: 'shield',    category: 'lawenf' },
  { id: 'oig',  abbr: 'OIG',  outerTop: 'OFFICE OF INSPECTOR GENERAL',            outerBottom: 'UNITED STATES OF JUSTICE', motif: 'scales',    category: 'lawenf' },
  { id: 'bis',  abbr: 'BIS',  outerTop: 'BUREAU OF INDUSTRY',                     outerBottom: 'AND SECURITY',             motif: 'globe',     category: 'lawenf' },

  /* --- Treasury / Financial --- */
  { id: 'ofac', abbr: 'OFAC', outerTop: 'OFFICE OF FOREIGN',                      outerBottom: 'ASSETS CONTROL',           motif: 'scales',    category: 'treasury' },
  { id: 'fincen',abbr:'FinCEN',outerTop:'FINANCIAL CRIMES',                       outerBottom: 'ENFORCEMENT NETWORK',      motif: 'eagle',     category: 'treasury' },
  { id: 'irsci',abbr: 'IRS-CI',outerTop:'INTERNAL REVENUE SERVICE',               outerBottom: 'CRIMINAL INVESTIGATION',   motif: 'badge',     category: 'treasury' },
  { id: 'usss', abbr: 'USSS', outerTop: 'UNITED STATES SECRET SERVICE',           outerBottom: 'EST. 1865',                motif: 'star',      category: 'treasury' },
  { id: 'mint', abbr: 'MINT', outerTop: 'UNITED STATES MINT',                     outerBottom: 'EST. 1792',                motif: 'scales',    category: 'treasury' },

  /* --- Homeland / Infrastructure --- */
  { id: 'cisa', abbr: 'CISA', outerTop: 'CYBERSECURITY AND',                      outerBottom: 'INFRASTRUCTURE SECURITY',  motif: 'shield',    category: 'homeland' },
  { id: 'tsa',  abbr: 'TSA',  outerTop: 'TRANSPORTATION SECURITY',                outerBottom: 'ADMINISTRATION',           motif: 'eagle',     category: 'homeland' },
  { id: 'fema', abbr: 'FEMA', outerTop: 'FEDERAL EMERGENCY',                      outerBottom: 'MANAGEMENT AGENCY',        motif: 'star',      category: 'homeland' },
  { id: 'cbp',  abbr: 'CBP',  outerTop: 'U.S. CUSTOMS AND',                       outerBottom: 'BORDER PROTECTION',        motif: 'eagle',     category: 'homeland' },
  { id: 'ice',  abbr: 'ICE',  outerTop: 'U.S. IMMIGRATION AND',                   outerBottom: 'CUSTOMS ENFORCEMENT',      motif: 'eagle',     category: 'homeland' },

  /* --- Science / Tech / Federal Research --- */
  { id: 'nist', abbr: 'NIST', outerTop: 'NATIONAL INSTITUTE OF',                  outerBottom: 'STANDARDS AND TECHNOLOGY', motif: 'gear',      category: 'research' },
  { id: 'sandia',abbr:'SNL',  outerTop: 'SANDIA NATIONAL LABORATORIES',           outerBottom: 'EST. 1949',                motif: 'flame',     category: 'research' },
  { id: 'lanl', abbr: 'LANL', outerTop: 'LOS ALAMOS',                             outerBottom: 'NATIONAL LABORATORY',      motif: 'atom',      category: 'research' },
  { id: 'llnl', abbr: 'LLNL', outerTop: 'LAWRENCE LIVERMORE',                     outerBottom: 'NATIONAL LABORATORY',      motif: 'atom',      category: 'research' },
  { id: 'nsf',  abbr: 'NSF',  outerTop: 'NATIONAL SCIENCE FOUNDATION',            outerBottom: 'UNITED STATES OF AMERICA', motif: 'gear',      category: 'research' }
]

/* ------------------------------------------------------------------ */
/* SVG primitives — circular text + central motifs                     */
/* ------------------------------------------------------------------ */

function CircularText({
  id,
  text,
  radius,
  side
}: { id: string; text: string; radius: number; side: 'top' | 'bottom' }) {
  // top arc: left-to-right across the top half
  // bottom arc: left-to-right across the bottom half (text reads upright)
  const cx = 100
  const cy = 100
  const path =
    side === 'top'
      ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`
      : `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 0 ${cx + radius} ${cy}`
  return (
    <>
      <defs>
        <path id={id} d={path} fill="none" />
      </defs>
      <text
        fill="#e8e4dc"
        fontFamily='"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace'
        fontSize="7.2"
        letterSpacing="0.6"
        fontWeight={600}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </>
  )
}

function Stars({ count = 13, radius = 78 }: { count?: number; radius?: number }) {
  const cx = 100, cy = 100
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2
        const x = cx + Math.cos(a) * radius
        const y = cy + Math.sin(a) * radius
        return (
          <polygon
            key={i}
            points={starPoints(x, y, 1.6, 3.6, 5)}
            fill="#e8e4dc"
            opacity={0.85}
          />
        )
      })}
    </g>
  )
}

function starPoints(cx: number, cy: number, r1: number, r2: number, n: number) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r2 : r1
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`)
  }
  return pts.join(' ')
}

function Motif({ kind }: { kind: SealMotif }) {
  switch (kind) {
    case 'globe':     return <GlobeMotif />
    case 'eagle':     return <EagleMotif />
    case 'compass':   return <CompassMotif />
    case 'star':      return <StarMotif />
    case 'shield':    return <ShieldMotif />
    case 'atom':      return <AtomMotif />
    case 'trident':   return <TridentMotif />
    case 'rocket':    return <RocketMotif />
    case 'spear':     return <SpearMotif />
    case 'torch':     return <TorchMotif />
    case 'scales':    return <ScalesMotif />
    case 'gear':      return <GearMotif />
    case 'badge':     return <BadgeMotif />
    case 'flame':     return <FlameMotif />
    case 'satellite': return <SatelliteMotif />
  }
}

/* ----- individual motifs (white-on-black, ~60px tall, centered ~100,100) ----- */

const STROKE = '#e8e4dc'
const FILL = 'none'

function GlobeMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.1}>
      <circle cx="100" cy="100" r="32" />
      <ellipse cx="100" cy="100" rx="32" ry="14" />
      <ellipse cx="100" cy="100" rx="32" ry="24" />
      <ellipse cx="100" cy="100" rx="14" ry="32" />
      <ellipse cx="100" cy="100" rx="24" ry="32" />
      <line x1="68" y1="100" x2="132" y2="100" />
      <line x1="100" y1="68" x2="100" y2="132" />
    </g>
  )
}

function EagleMotif() {
  return (
    <g fill={STROKE} stroke={STROKE} strokeWidth={0.6}>
      {/* stylized spread-wing eagle silhouette */}
      <path d="M100 78 L93 86 L78 84 L70 92 L84 96 L72 104 L88 102 L82 112 L96 108 L94 120 L100 116 L106 120 L104 108 L118 112 L112 102 L128 104 L116 96 L130 92 L122 84 L107 86 Z" />
      <circle cx="100" cy="76" r="2.2" />
    </g>
  )
}

function CompassMotif() {
  return (
    <g stroke={STROKE} fill={STROKE} strokeWidth={1}>
      <circle cx="100" cy="100" r="6" fill={STROKE} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const a = (deg * Math.PI) / 180
        const isCardinal = deg % 90 === 0
        const len = isCardinal ? 30 : 18
        const w = isCardinal ? 4.2 : 2.4
        const x = 100 + Math.cos(a) * len
        const y = 100 + Math.sin(a) * len
        const px = 100 + Math.cos(a + Math.PI / 2) * w
        const py = 100 + Math.sin(a + Math.PI / 2) * w
        const qx = 100 + Math.cos(a - Math.PI / 2) * w
        const qy = 100 + Math.sin(a - Math.PI / 2) * w
        return (
          <polygon
            key={i}
            points={`${x},${y} ${px},${py} ${qx},${qy}`}
            fill={STROKE}
            stroke="none"
          />
        )
      })}
    </g>
  )
}

function StarMotif() {
  return (
    <g fill={STROKE} stroke={STROKE} strokeWidth={0.8}>
      <polygon points={starPoints(100, 100, 10, 28, 5)} />
    </g>
  )
}

function ShieldMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.4}>
      <path d="M100 70 L128 80 L128 104 Q128 122 100 132 Q72 122 72 104 L72 80 Z" />
      <line x1="100" y1="70" x2="100" y2="132" />
      <line x1="72" y1="100" x2="128" y2="100" />
    </g>
  )
}

function AtomMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.1}>
      <ellipse cx="100" cy="100" rx="30" ry="12" />
      <ellipse cx="100" cy="100" rx="30" ry="12" transform="rotate(60 100 100)" />
      <ellipse cx="100" cy="100" rx="30" ry="12" transform="rotate(120 100 100)" />
      <circle cx="100" cy="100" r="3.4" fill={STROKE} />
    </g>
  )
}

function TridentMotif() {
  return (
    <g stroke={STROKE} fill={STROKE} strokeWidth={1.3} strokeLinecap="round">
      <line x1="100" y1="74" x2="100" y2="130" />
      <line x1="84" y1="80" x2="84" y2="106" />
      <line x1="116" y1="80" x2="116" y2="106" />
      <path d="M82 80 L100 70 L118 80" fill={FILL} />
      <polygon points="96,128 100,134 104,128" />
    </g>
  )
}

function RocketMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.2} strokeLinecap="round">
      <path d="M100 70 Q108 90 108 110 L92 110 Q92 90 100 70 Z" />
      <circle cx="100" cy="92" r="2.2" fill={STROKE} stroke="none" />
      <path d="M92 110 L86 122 L94 116 Z" fill={STROKE} stroke="none" />
      <path d="M108 110 L114 122 L106 116 Z" fill={STROKE} stroke="none" />
      <path d="M96 110 L100 124 L104 110" />
      <path d="M70 132 Q100 122 130 132" strokeDasharray="2 2" />
    </g>
  )
}

function SpearMotif() {
  return (
    <g stroke={STROKE} fill={STROKE} strokeWidth={1.2}>
      <path d="M100 70 L106 96 L100 130 L94 96 Z" />
      <line x1="78" y1="118" x2="122" y2="82" stroke={STROKE} strokeWidth="2" />
    </g>
  )
}

function TorchMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.3}>
      <path d="M92 78 Q100 64 108 78 Q104 88 100 90 Q96 88 92 78 Z" fill={STROKE} stroke="none" />
      <rect x="96" y="90" width="8" height="36" />
      <rect x="92" y="126" width="16" height="4" fill={STROKE} stroke="none" />
    </g>
  )
}

function ScalesMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.2}>
      <line x1="100" y1="76" x2="100" y2="130" />
      <line x1="74" y1="86" x2="126" y2="86" />
      <path d="M74 86 L66 104 L82 104 Z" />
      <path d="M126 86 L118 104 L134 104 Z" />
      <rect x="92" y="128" width="16" height="3" fill={STROKE} stroke="none" />
    </g>
  )
}

function GearMotif() {
  const teeth = 12
  const ri = 18, ro = 28, tw = 5
  const pts: string[] = []
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth
    const r = i % 2 === 0 ? ro : ri
    const x = 100 + Math.cos(a) * r
    const y = 100 + Math.sin(a) * r
    pts.push(`${x},${y}`)
  }
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.2}>
      <polygon points={pts.join(' ')} />
      <circle cx="100" cy="100" r="8" />
    </g>
  )
}

function BadgeMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.2}>
      <polygon points={starPoints(100, 100, 12, 28, 5)} />
      <circle cx="100" cy="100" r="8" />
    </g>
  )
}

function FlameMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.3}>
      <path d="M100 72 Q112 92 108 110 Q104 122 100 124 Q96 122 92 110 Q88 92 100 72 Z" />
      <path d="M100 90 Q104 102 100 116 Q96 102 100 90 Z" fill={STROKE} stroke="none" />
    </g>
  )
}

function SatelliteMotif() {
  return (
    <g stroke={STROKE} fill={FILL} strokeWidth={1.2}>
      <rect x="94" y="94" width="12" height="12" />
      <line x1="74" y1="100" x2="94" y2="100" />
      <line x1="106" y1="100" x2="126" y2="100" />
      <rect x="74" y="92" width="14" height="16" />
      <rect x="112" y="92" width="14" height="16" />
      <line x1="100" y1="84" x2="100" y2="76" />
      <circle cx="100" cy="74" r="2.4" fill={STROKE} stroke="none" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Single seal                                                         */
/* ------------------------------------------------------------------ */

export function Seal({ agency, size = 168 }: { agency: Agency; size?: number }) {
  const topId = `arc-top-${agency.id}`
  const botId = `arc-bot-${agency.id}`
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`${agency.outerTop}${agency.outerBottom ? ' — ' + agency.outerBottom : ''}`}
      style={{ display: 'block' }}
    >
      {/* outer bezel */}
      <circle cx="100" cy="100" r="96" fill="#06070a" stroke="#e8e4dc" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="88" fill="none"   stroke="#e8e4dc" strokeWidth="0.7" opacity="0.7" />
      <circle cx="100" cy="100" r="64" fill="none"   stroke="#e8e4dc" strokeWidth="0.5" opacity="0.4" />

      <CircularText id={topId} text={agency.outerTop} radius={78} side="top" />
      {agency.outerBottom && (
        <CircularText id={botId} text={agency.outerBottom} radius={78} side="bottom" />
      )}

      {/* delimiter stars between top/bottom arcs */}
      <polygon points={starPoints(22, 100, 1.4, 3.2, 5)} fill={STROKE} />
      <polygon points={starPoints(178, 100, 1.4, 3.2, 5)} fill={STROKE} />

      <Motif kind={agency.motif} />

      {/* center abbreviation on a dim banner */}
      <g>
        <rect x="62" y="138" width="76" height="18" fill="#06070a" stroke="#e8e4dc" strokeWidth="0.6" />
        <text
          x="100"
          y="151"
          textAnchor="middle"
          fontFamily='"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace'
          fontSize="11"
          fontWeight={700}
          letterSpacing="2"
          fill="#e8e4dc"
        >
          {agency.abbr}
        </text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Loader scene                                                        */
/* ------------------------------------------------------------------ */

export interface AgencyLoaderProps {
  /** Headline above the seal grid. */
  label?: string
  /** Subline ticker text — animates. */
  subline?: string
  /** If provided, scene auto-dismisses after this many ms and calls onDone. */
  minDurationMs?: number
  /** Called when scene finishes. */
  onDone?: () => void
  /** Restrict to one or more categories. */
  categories?: SealCategory[]
  /** How many seals to render in the constellation. Default: all. */
  max?: number
  /** Render inline (not full-screen overlay). */
  inline?: boolean
}

export function AgencyLoader({
  label = 'ESTABLISHING SECURE CHANNEL',
  subline = 'CYBERCARD // FLLC.NET // CONSENT-FIRST TELEMETRY',
  minDurationMs,
  onDone,
  categories,
  max,
  inline = false
}: AgencyLoaderProps) {
  const [progress, setProgress] = useState(0)
  const startedAt = useRef<number>(Date.now())

  const seals = useMemo(() => {
    let list = AGENCIES
    if (categories?.length) list = list.filter(a => categories.includes(a.category))
    if (max) list = list.slice(0, max)
    return list
  }, [categories, max])

  // tick progress bar
  useEffect(() => {
    if (!minDurationMs) return
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (Date.now() - startedAt.current) / minDurationMs)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else onDone?.()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [minDurationMs, onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        position: inline ? 'relative' : 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#06070a',
        color: '#e8e4dc',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace'
      }}
    >
      {/* scanlines + radial vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,229,200,0.06), transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
          pointerEvents: 'none'
        }}
      />

      {/* header */}
      <div style={{ zIndex: 2, textAlign: 'center', marginBottom: '1.25rem', padding: '0 1rem' }}>
        <div
          style={{
            fontSize: '0.78rem',
            letterSpacing: '0.45em',
            opacity: 0.7,
            marginBottom: '0.4rem'
          }}
        >
          // CYBERCARD SYSTEM BOOT //
        </div>
        <div
          style={{
            fontSize: 'clamp(1.1rem, 2.4vw, 1.7rem)',
            fontWeight: 700,
            letterSpacing: '0.18em'
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', opacity: 0.55, marginTop: '0.4rem' }}>
          {subline}
        </div>
      </div>

      {/* seal constellation */}
      <div
        className="cybercard-seal-grid"
        style={{
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '14px',
          padding: '0 24px',
          maxWidth: '1280px',
          width: '100%',
          maxHeight: '60vh',
          overflow: 'hidden',
          maskImage:
            'radial-gradient(ellipse at center, #000 60%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, #000 60%, transparent 100%)'
        }}
      >
        {seals.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `cybercard-fade ${1.2 + (i % 6) * 0.15}s ease-out both`,
              animationDelay: `${(i % 12) * 60}ms`,
              opacity: 0.9
            }}
          >
            <Seal agency={a} size={132} />
          </div>
        ))}
      </div>

      {/* progress + status ticker */}
      <div
        style={{
          zIndex: 2,
          marginTop: '1.25rem',
          width: 'min(620px, 90vw)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            height: 2,
            width: '100%',
            background: 'rgba(232,228,220,0.12)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: minDurationMs ? `${progress * 100}%` : '40%',
              background: '#00e5c8',
              animation: minDurationMs ? undefined : 'cybercard-slide 2.4s linear infinite'
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.65rem',
            letterSpacing: '0.25em',
            opacity: 0.55,
            marginTop: '0.5rem'
          }}
        >
          <span>HANDSHAKE</span>
          <span>RLS // SUPABASE</span>
          <span>{minDurationMs ? `${Math.round(progress * 100)}%` : 'STREAMING'}</span>
        </div>
      </div>

      <style>{`
        @keyframes cybercard-fade {
          from { opacity: 0; transform: translateY(6px) scale(0.96); filter: blur(2px); }
          to   { opacity: 0.92; transform: none; filter: none; }
        }
        @keyframes cybercard-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cybercard-seal-grid > * { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  )
}

export default AgencyLoader
