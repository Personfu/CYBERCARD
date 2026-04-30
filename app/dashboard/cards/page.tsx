'use client'

// Skip static prerender; dashboard depends on runtime env vars.
export const dynamic = 'force-dynamic'

// app/dashboard/cards/page.tsx
// CFO panel — org billing health + tap stream analytics
// Reads from org_billing_health view + tap_events realtime

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type SB = ReturnType<typeof createBrowserClient>

let _supabase: SB | null = null
function getSupabase(): SB | null {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _supabase = createBrowserClient(url, key)
  return _supabase
}

interface BillingRow {
  plan:        string
  active_orgs: number
  paying:      number
  total_quota: number
  used_quota:  number
  mrr_cents:   number
}

interface TapRow {
  id:           string
  card_id:      string
  geo_city:     string | null
  geo_country:  string | null
  utm_source:   string
  is_first_tap: boolean
  tapped_at:    string
}

const PLAN_PRICE: Record<string, number> = {
  starter:    2900,
  pro:        7900,
  enterprise: 29900,
}

const neon = '#00e5c8'
const gold = '#c9a84c'
const red  = '#ff3b3b'

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

export default function CardsDashboard() {
  const [billing, setBilling]     = useState<BillingRow[]>([])
  const [taps, setTaps]           = useState<TapRow[]>([])
  const [uniqueFps, setUniqueFps] = useState(0)
  const [mrr, setMrr]             = useState(0)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) { setLoading(false); return }
    void load()

    // Realtime tap stream
    const channel = supabase
      .channel('tap_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tap_events' },
        (payload) => {
          setTaps((prev) => [payload.new as TapRow, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function load() {
    const supabase = getSupabase()
    if (!supabase) return
    const [billingRes, tapsRes, fpRes] = await Promise.all([
      supabase.from('org_billing_health').select('*'),
      supabase.from('tap_events').select('id,card_id,geo_city,geo_country,utm_source,is_first_tap,tapped_at')
        .order('tapped_at', { ascending: false }).limit(50),
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
    ])

    if (billingRes.data) {
      // Compute MRR from plan rows
      let totalMrr = 0
      for (const row of billingRes.data as BillingRow[]) {
        totalMrr += (PLAN_PRICE[row.plan] ?? 0) * (row.paying ?? 0)
      }
      setBilling(billingRes.data as BillingRow[])
      setMrr(totalMrr)
    }
    if (tapsRes.data)    setTaps(tapsRes.data as TapRow[])
    if (fpRes.count !== null) setUniqueFps(fpRes.count)
    setLoading(false)
  }

  const totalActive = billing.reduce((s, r) => s + (r.active_orgs ?? 0), 0)
  const totalPaying = billing.reduce((s, r) => s + (r.paying ?? 0), 0)
  const mrrTarget   = 1500000   // $15K in cents
  const mrrPct      = Math.min(100, Math.round((mrr / mrrTarget) * 100))

  return (
    <div className="min-h-screen bg-[#06070a] text-[#e8e4dc] font-mono p-6">
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(0,229,200,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,1) 1px,transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] tracking-[3px] uppercase text-[#6b6b72]">furulie llc · cybercard</p>
            <h1 className="text-2xl tracking-[4px] uppercase text-white mt-1">command deck</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00e5c8] shadow-[0_0_8px_rgba(0,229,200,0.8)] animate-pulse" />
            <span className="text-[9px] tracking-[2px] uppercase text-[#00e5c8]">live</span>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'MRR',          value: fmt(mrr),       sub: `${mrrPct}% to $15K`,    color: gold },
            { label: 'Active Orgs',  value: totalActive,    sub: `${totalPaying} paying`,  color: neon },
            { label: 'Unique Taps',  value: uniqueFps,      sub: 'all-time contacts',      color: neon },
            { label: 'Tap Events',   value: taps.length > 0 ? '●' : '—', sub: 'stream live', color: neon },
          ].map((k) => (
            <div key={k.label} className="border border-white/[0.07] rounded-lg p-4 bg-[#0d0e13]">
              <p className="text-[9px] tracking-[2px] uppercase text-[#6b6b72] mb-2">{k.label}</p>
              <p className="text-2xl" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[9px] text-[#555] mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* MRR progress bar */}
        <div className="mb-8 border border-white/[0.07] rounded-lg p-4 bg-[#0d0e13]">
          <div className="flex justify-between text-[9px] tracking-[2px] uppercase text-[#6b6b72] mb-3">
            <span>MRR progress</span>
            <span>{fmt(mrr)} / $15K · {mrrPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${mrrPct}%`, background: `linear-gradient(90deg, ${neon}, ${gold})` }}
            />
          </div>
        </div>

        {/* Billing table */}
        <div className="border border-white/[0.07] rounded-lg bg-[#0d0e13] mb-8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <p className="text-[9px] tracking-[3px] uppercase text-[#6b6b72]">org billing health</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] tracking-[2px] uppercase text-[#555] border-b border-white/[0.04]">
                {['Plan','Active','Paying','Quota used','MRR'].map(h => (
                  <th key={h} className="text-left px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-[#555]">loading...</td></tr>
              ) : billing.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-[#555]">no data</td></tr>
              ) : billing.map((row) => (
                <tr key={row.plan} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-2" style={{ color: gold }}>{row.plan}</td>
                  <td className="px-4 py-2">{row.active_orgs}</td>
                  <td className="px-4 py-2" style={{ color: neon }}>{row.paying}</td>
                  <td className="px-4 py-2 text-[#aaa]">{row.used_quota ?? 0} / {row.total_quota}</td>
                  <td className="px-4 py-2" style={{ color: gold }}>{fmt((PLAN_PRICE[row.plan] ?? 0) * row.paying)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live tap stream */}
        <div className="border border-white/[0.07] rounded-lg bg-[#0d0e13] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#00e5c8] animate-pulse" />
            <p className="text-[9px] tracking-[3px] uppercase text-[#6b6b72]">live tap stream</p>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[320px] overflow-y-auto">
            {taps.length === 0 ? (
              <p className="px-4 py-4 text-[#555] text-[10px]">waiting for taps...</p>
            ) : taps.map((tap) => (
              <div key={tap.id} className="px-4 py-2 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className={`w-1 h-1 rounded-full ${tap.is_first_tap ? 'bg-[#c9a84c]' : 'bg-[#00e5c8]'}`} />
                  <span className="text-[10px]" style={{ color: tap.is_first_tap ? gold : neon }}>
                    {tap.card_id}
                  </span>
                  <span className="text-[9px] text-[#555]">
                    {tap.geo_city ?? '?'}, {tap.geo_country ?? '??'} · {tap.utm_source}
                  </span>
                </div>
                <span className="text-[8px] text-[#444]">
                  {new Date(tap.tapped_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
