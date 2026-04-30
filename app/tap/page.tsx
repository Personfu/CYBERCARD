import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TapClient from './TapClient'

interface TapPageProps {
  searchParams: { card_id?: string; utm_source?: string; utm_medium?: string }
}

export interface CardConfig {
  id: string
  card_id: string
  owner_name: string
  owner_title: string
  owner_company: string
  linkedin_url: string | null
  vcard_url: string | null
  redirect_url: string | null
  email_trigger: boolean
  one_time_email: boolean
  card_type: 'metal_v1' | 'ar_v1' | 'demo_v1' | 'scan_v1' | 'file_v1' | 'file_download_v1' | 'gov_v1' | 'challenge_v1' | 'system_v1'
  active: boolean
  metadata: Record<string, unknown>
}

const FALLBACK_CONFIG: CardConfig = {
  id: 'fallback',
  card_id: 'metal_v1',
  owner_name: 'Preston Furulie',
  owner_title: 'Systems Architect / AI Automation',
  owner_company: 'Furulie LLC',
  linkedin_url: 'https://linkedin.com/in/prestonfurulie',
  vcard_url: '/api/vcard',
  redirect_url: null,
  email_trigger: true,
  one_time_email: true,
  card_type: 'metal_v1',
  active: true,
  metadata: {}
}

async function resolveCard(cardId: string): Promise<CardConfig> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('card_id', cardId)
      .eq('active', true)
      .single()

    if (error || !data) return { ...FALLBACK_CONFIG, card_id: cardId }
    return data as CardConfig
  } catch {
    return { ...FALLBACK_CONFIG, card_id: cardId }
  }
}

export default async function TapPage({ searchParams }: TapPageProps) {
  const cardId = searchParams.card_id ?? 'metal_v1'
  const config = await resolveCard(cardId)

  if (config.redirect_url && config.card_type === 'scan_v1') {
    redirect(config.redirect_url)
  }

  return (
    <Suspense fallback={<TapSkeleton />}>
      <TapClient
        config={config}
        utm={{ source: searchParams.utm_source, medium: searchParams.utm_medium }}
      />
    </Suspense>
  )
}

function TapSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c]">
      <div className="h-6 w-6 animate-spin rounded-full border border-[#00e5c8] border-t-transparent" />
    </div>
  )
}