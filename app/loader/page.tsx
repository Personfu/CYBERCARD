'use client'

/**
 * /loader — standalone preview & transition gate.
 *
 * Use this route directly as a transition (e.g. window.location = '/loader?next=/dashboard/cards')
 * or import <AgencyLoader /> wherever you need a full-screen boot scene.
 */

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AgencyLoader, { AGENCIES, Seal, type SealCategory } from '../components/AgencyLoader'

const CATEGORY_TABS: { id: SealCategory | 'all'; label: string }[] = [
  { id: 'all',          label: 'ALL' },
  { id: 'intelligence', label: 'INTEL' },
  { id: 'cyber',        label: 'CYBER' },
  { id: 'space',        label: 'SPACE' },
  { id: 'nuclear',      label: 'NUCLEAR' },
  { id: 'lawenf',       label: 'LAW ENF' },
  { id: 'treasury',     label: 'TREASURY' },
  { id: 'homeland',     label: 'HOMELAND' },
  { id: 'research',     label: 'RESEARCH' }
]

function LoaderRouteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const duration = Number(params.get('ms') || 2400)
  const [done, setDone] = useState(false)
  const [tab, setTab] = useState<SealCategory | 'all'>('all')

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => router.push(next), 120)
    return () => clearTimeout(t)
  }, [done, next, router])

  // Transition mode: ?next=/somewhere triggers auto-dismiss + redirect.
  if (params.get('next')) {
    return (
      <AgencyLoader
        label="ESTABLISHING SECURE CHANNEL"
        subline={`ROUTING TO ${next.toUpperCase()}`}
        minDurationMs={duration}
        onDone={() => setDone(true)}
      />
    )
  }

  // Gallery / preview mode (default): browse seals by category.
  const visible = tab === 'all' ? AGENCIES : AGENCIES.filter(a => a.category === tab)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#06070a',
        color: '#e8e4dc',
        padding: '2.5rem 1.5rem',
        fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace'
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', color: '#00e5c8', margin: 0 }}>
          CYBERCARD // LOADER GALLERY
        </p>
        <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 0.25rem', letterSpacing: 1 }}>
          Agency Seal Constellation
        </h1>
        <p style={{ color: '#a9b4bf', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
          Pure-SVG, white-on-black, monospaced. Used as the CyberCard boot / transition scene.
          Append <code style={{ color: '#c9a84c' }}>?next=/dashboard/cards&amp;ms=1800</code> to use as a route gate.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '1.25rem 0' }}>
          {CATEGORY_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? '#00e5c8' : 'transparent',
                color: tab === t.id ? '#06070a' : '#e8e4dc',
                border: '1px solid rgba(232,228,220,0.25)',
                fontFamily: 'inherit',
                fontSize: 11,
                letterSpacing: '0.18em',
                padding: '6px 12px',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 16
          }}
        >
          {visible.map(a => (
            <div
              key={a.id}
              style={{
                border: '1px solid rgba(232,228,220,0.12)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                background: '#0a0a0c'
              }}
            >
              <Seal agency={a} size={150} />
              <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.18em' }}>
                {a.category.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default function LoaderRoute() {
  return (
    <Suspense fallback={<AgencyLoader label="LOADING" />}>
      <LoaderRouteInner />
    </Suspense>
  )
}
