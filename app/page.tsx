const links = [
  { href: '/tap?card_id=metal_v1&utm_source=web&utm_medium=landing', label: 'Tap Flow', text: 'Run the NFC/QR landing path and first-tap automation.' },
  { href: '/risk', label: 'Risk Lab', text: 'Consent-based awareness telemetry without exploit execution.' },
  { href: '/dashboard/cards', label: 'Command Deck', text: 'View taps, contacts, org health, and live event streams.' },
  { href: '/challenge/demo', label: 'Challenge', text: 'Open the puzzle funnel used by the DEFCON card concept.' }
]

const stack = [
  'Next.js API routes',
  'Supabase RLS and audit tables',
  'Resend tap alerts',
  'Stripe billing hooks',
  'ESP32-S3 telemetry',
  'Flipper-safe demos'
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#06070a] text-[#e8e4dc] px-6 py-10 font-mono">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[3px] text-[#00e5c8]">Personfu CyberCard</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[1px] text-white md:text-6xl">
              NFC identity, RF lab, and blue-team telemetry in one executable stack.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#a9b4bf]">
              This app turns the business card into a consent-based system model: QR and NFC identity, tap analytics,
              defensive risk education, safe Flipper workflows, ESP32 telemetry, and auditable backend automation.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0d1117] p-5">
            <p className="text-[10px] uppercase tracking-[2px] text-[#c9a84c]">Execution Stack</p>
            <div className="mt-4 grid gap-2">
              {stack.map((item) => (
                <div key={item} className="flex items-center gap-3 text-xs text-[#a9b4bf]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00e5c8]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="rounded-lg border border-white/10 bg-[#0d1117] p-5 transition hover:border-[#00e5c8]/60 hover:bg-[#111722]">
              <p className="text-sm font-semibold uppercase tracking-[2px] text-[#00e5c8]">{link.label}</p>
              <p className="mt-3 text-sm leading-6 text-[#a9b4bf]">{link.text}</p>
            </a>
          ))}
        </section>
      </div>
    </main>
  )
}