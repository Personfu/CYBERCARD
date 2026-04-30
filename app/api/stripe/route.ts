// app/api/stripe/route.ts
// Stripe webhook handler — checkout, subscription lifecycle, invoice events
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { FirstTapEmail } from '@/emails/templates'

export const runtime = 'nodejs'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

const PLAN_QUOTA: Record<string, number> = {
  free:       1,
  starter:    5,
  pro:       25,
  enterprise: 1000,
}

function planFromPriceId(priceId: string | null): string {
  // Map your Stripe Price IDs to plan names here
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER  ?? 'price_starter']:    'starter',
    [process.env.STRIPE_PRICE_PRO      ?? 'price_pro']:         'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise']: 'enterprise',
  }
  return priceId ? (map[priceId] ?? 'starter') : 'free'
}

async function provisionOrg(
  supabase: ReturnType<typeof createClient>,
  email: string,
  customerId: string,
  subscriptionId: string,
  plan: string,
) {
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const quota = PLAN_QUOTA[plan] ?? 1

  // Upsert org
  const { data: org } = await supabase
    .from('orgs')
    .upsert(
      {
        slug,
        name:                   slug,
        owner_email:            email,
        stripe_customer_id:     customerId,
        stripe_subscription_id: subscriptionId,
        plan,
        card_quota:             quota,
        active:                 true,
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single()

  if (!org) return null

  // Provision first card if none exist
  const { count } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)

  if ((count ?? 0) === 0) {
    const cardId = `${slug}_metal_v1`
    await supabase.from('cards').insert({
      card_id:      cardId,
      owner_name:   slug,
      owner_email:  email,
      card_type:    'metal_v1',
      org_id:       org.id,
      active:       true,
    })
    // Fire welcome email
    const html = await render(
      FirstTapEmail({
        card_id:    cardId,
        utm_source: 'stripe_checkout',
        ua:         'provisioning',
        tap_id:     crypto.randomUUID(),
        tapped_at:  new Date().toISOString(),
      }),
    )
    await getResend().emails.send({
      from:    'CyberCard <noreply@fllc.net>',
      to:      email,
      subject: `Your CyberCard is live — ${cardId}`,
      html,
    })
  }
  return org
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }

  const supabase = createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const email   = session.customer_details?.email ?? ''
      const custId  = (session.customer as string) ?? ''
      const subId   = (session.subscription as string) ?? ''
      const priceId = (session as any).metadata?.price_id ?? null
      const plan    = planFromPriceId(priceId)
      await provisionOrg(supabase, email, custId, subId, plan)
      break
    }

    case 'customer.subscription.updated': {
      const sub   = event.data.object as Stripe.Subscription
      const price = sub.items.data[0]?.price?.id ?? null
      const plan  = planFromPriceId(price)
      await supabase
        .from('orgs')
        .update({ plan, card_quota: PLAN_QUOTA[plan] ?? 1 })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('orgs')
        .update({ plan: 'free', card_quota: 1, active: false, stripe_subscription_id: null })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = (invoice.subscription as string) ?? ''
      await supabase
        .from('orgs')
        .update({ active: false })
        .eq('stripe_subscription_id', subId)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
