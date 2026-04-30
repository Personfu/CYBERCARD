'use client'

import { useEffect, useRef, useState } from 'react'
import { AgencyLoader } from '../components/AgencyLoader'
import type { CardConfig } from './page'

interface TapClientProps {
  config: CardConfig
  utm: { source?: string; medium?: string }
}

type TapState = 'loading' | 'ready' | 'already_seen' | 'error'

export default function TapClient({ config, utm }: TapClientProps) {
  const [state, setState] = useState<TapState>('loading')
  const [tapId, setTapId] = useState<string | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void fireTapEvent()
  }, [])

  async function fireTapEvent() {
    try {
      const fingerprint = {
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        touch: navigator.maxTouchPoints > 0,
        ua: navigator.userAgent.slice(0, 200)
      }

      const res = await fetch('/api/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: config.card_id,
          card_type: config.card_type,
          fingerprint,
          utm_source: utm.source ?? 'nfc',
          utm_medium: utm.medium ?? 'card'
        })
      })

      const data = await res.json() as { tap_id?: string; first_tap?: boolean; action?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'tap failed')

      setTapId(data.tap_id ?? null)

      if (data.action === 'redirect' && config.redirect_url) {
        window.location.href = config.redirect_url
        return
      }

      setState(data.first_tap ? 'ready' : 'already_seen')
    } catch {
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <AgencyLoader
        label="ESTABLISHING SECURE CHANNEL"
        subline={`CYBERCARD // ${typeof window !== 'undefined' ? window.location.hostname.toUpperCase() : 'FLLC.NET'} // CONSENT-FIRST TELEMETRY`}
        minDurationMs={1800}
        onDone={() => {/* tap result resolves it, not the timer */}}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0c] px-6 py-12">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(0,229,200,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,1) 1px,transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-1">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#00e5c8] shadow-[0_0_8px_rgba(0,229,200,0.6)]" />
            <span className="font-mono text-[9px] uppercase tracking-[2.5px] text-[#00e5c8] opacity-70">
              {state === 'already_seen' ? 'Returning contact' : state === 'error' ? 'Offline card fallback' : 'New connection'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-[3px] text-white">{config.owner_name}</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6b72]">{config.owner_title}</p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#4a4a52]">{config.owner_company}</p>
        </div>

        <div className="flex flex-col gap-3">
          {config.linkedin_url && (
            <a href={config.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-[rgba(0,229,200,0.2)] bg-[rgba(0,229,200,0.04)] px-5 py-3.5 font-mono text-xs uppercase tracking-widest text-[#00e5c8] transition-all hover:border-[rgba(0,229,200,0.45)] hover:bg-[rgba(0,229,200,0.08)]">
              <span>Connect on LinkedIn</span>
              <span className="opacity-50">-&gt;</span>
            </a>
          )}

          {config.vcard_url && (
            <a href={`${config.vcard_url}?tap_id=${tapId ?? ''}`} className="flex items-center justify-between rounded-lg border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] px-5 py-3.5 font-mono text-xs uppercase tracking-widest text-[#c9a84c] transition-all hover:border-[rgba(201,168,76,0.45)] hover:bg-[rgba(201,168,76,0.08)]">
              <span>Save contact (.vcf)</span>
              <span className="opacity-50">download</span>
            </a>
          )}

          <a href={`https://fllc.net?ref=card&card_id=${config.card_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-5 py-3.5 font-mono text-xs uppercase tracking-widest text-[#888] transition-all hover:border-[rgba(255,255,255,0.15)] hover:text-[#bbb]">
            <span>View Furulie LLC</span>
            <span className="opacity-40">-&gt;</span>
          </a>
        </div>

        {state === 'ready' && config.email_trigger && (
          <div className="rounded-lg border border-[rgba(0,229,200,0.1)] bg-[rgba(0,229,200,0.03)] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#00e5c8] opacity-60">Intro email queued by consent-safe automation</p>
          </div>
        )}

        <div className="mt-4 flex justify-between font-mono text-[8px] uppercase tracking-widest text-[#333]">
          <span>CARD {config.card_id.toUpperCase()}</span>
          {tapId && <span>TAP {tapId.slice(-8).toUpperCase()}</span>}
        </div>
      </div>
    </div>
  )
}