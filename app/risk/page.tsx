'use client'

import { useMemo, useState } from 'react'

const checks = [
  {
    key: 'browser_surface',
    label: 'Browser Surface',
    description: 'User agent, language, timezone, screen size, and feature hints can identify a session without needing secrets.',
  },
  {
    key: 'link_context',
    label: 'Link Context',
    description: 'UTM fields, card_id, QR source, and referrer describe how a person arrived.',
  },
  {
    key: 'consent_boundary',
    label: 'Consent Boundary',
    description: 'Safe telemetry starts after a clear disclosure and should avoid raw IPs, credentials, clipboard, files, or hidden execution.',
  },
  {
    key: 'blue_team_detection',
    label: 'Blue-Team Detection',
    description: 'The useful lesson is how to detect unsafe patterns: drive-by download attempts, hidden forms, suspicious redirects, and script injection.',
  },
]

function collectSafeSnapshot() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    color_depth: window.screen.colorDepth,
    touch_points: navigator.maxTouchPoints,
    platform: navigator.platform,
    do_not_track: navigator.doNotTrack,
    referrer_present: Boolean(document.referrer),
    url_path: window.location.pathname,
  }
}

export default function RiskPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [eventId, setEventId] = useState<string | null>(null)
  const snapshot = useMemo(() => (typeof window === 'undefined' ? null : collectSafeSnapshot()), [])

  async function submitConsentEvent() {
    setState('sending')
    try {
      const res = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          scenario: 'fllc_risk_awareness',
          snapshot: collectSafeSnapshot(),
          indicators: checks.map((check) => check.key),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'request failed')
      setEventId(data.risk_event_id)
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return (
    <main className="min-h-screen bg-[#06070a] text-[#e8e4dc] font-mono px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-[10px] uppercase tracking-[3px] text-[#00e5c8]">fllc.net/risk · safe awareness lab</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[2px] text-white">Risk Is A System Model</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#a9b4bf]">
          This page demonstrates what a malicious drive-by page might try to collect, while refusing to do it.
          Nothing downloads, executes, reads files, grabs credentials, touches the clipboard, or runs shell commands.
          With consent, it records a minimal blue-team training event to Supabase.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <article key={check.key} className="rounded-lg border border-white/10 bg-[#0d1117] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[2px] text-[#c9a84c]">{check.label}</h2>
              <p className="mt-3 text-sm leading-6 text-[#a9b4bf]">{check.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-[#00e5c8]/30 bg-[#0d1117] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[2px] text-[#00e5c8]">Safe Snapshot Preview</h2>
          <pre className="mt-4 overflow-x-auto rounded bg-black/40 p-4 text-xs text-[#e8e4dc]">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
          <p className="mt-4 text-xs leading-6 text-[#8b949e]">
            This snapshot is intentionally limited. It excludes raw IP addresses, cookies, local storage, clipboard data,
            files, credentials, and device identifiers. The API hashes the user-agent context before storage.
          </p>
          <button
            onClick={submitConsentEvent}
            disabled={state === 'sending' || state === 'sent'}
            className="mt-5 rounded border border-[#00e5c8] px-4 py-3 text-xs uppercase tracking-[2px] text-[#00e5c8] transition hover:bg-[#00e5c8]/10 disabled:opacity-50"
          >
            {state === 'sending' ? 'recording...' : state === 'sent' ? 'recorded' : 'I consent: record safe risk event'}
          </button>
          {state === 'sent' && <p className="mt-3 text-xs text-[#c9a84c]">risk_event_id: {eventId}</p>}
          {state === 'error' && <p className="mt-3 text-xs text-[#ff6b6b]">Could not record the event.</p>}
        </section>
      </div>
    </main>
  )
}
