'use client'

/**
 * SplashGate
 * --------------------------------------------------
 * Wraps the app with a one-time AgencyLoader splash on first visit
 * per session. After it dismisses, children render normally.
 *
 * Use as:
 *   <SplashGate>{children}</SplashGate>
 *
 * Behavior:
 *   - Skipped entirely on /loader, /ar, and /api routes.
 *   - Skipped when the browser respects `prefers-reduced-motion: reduce`.
 *   - Remembers dismissal in sessionStorage so it doesn't re-trigger
 *     when the user navigates between pages within the same tab.
 *   - Honors `?nosplash=1` query parameter.
 */

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import AgencyLoader from './AgencyLoader'

const SESSION_KEY = 'cybercard.splash.shown'
const SKIP_PATHS = ['/loader', '/ar']

interface Props {
  children: React.ReactNode
  /** Override the default 2200ms splash duration. */
  durationMs?: number
}

export default function SplashGate({ children, durationMs = 2200 }: Props) {
  const pathname = usePathname() ?? '/'
  const params = useSearchParams()
  const [hidden, setHidden] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (SKIP_PATHS.some(p => pathname.startsWith(p))) {
      setHidden(true)
      return
    }
    if (params?.get('nosplash') === '1') {
      setHidden(true)
      return
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setHidden(true)
      return
    }
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') {
        setHidden(true)
        return
      }
    } catch {
      /* sessionStorage may be blocked; fall through to show splash */
    }
    setHidden(false)
  }, [pathname, params])

  if (hidden === null) return null // SSR / initial paint guard
  if (hidden) return <>{children}</>

  return (
    <>
      <AgencyLoader
        label="CYBERCARD BOOT"
        subline="ESTABLISHING SECURE CHANNEL // FLLC.NET"
        minDurationMs={durationMs}
        onDone={() => {
          try { window.sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
          setHidden(true)
        }}
      />
      {/* Pre-render children behind the splash so the transition feels instant. */}
      <div aria-hidden style={{ visibility: 'hidden' }}>{children}</div>
    </>
  )
}
