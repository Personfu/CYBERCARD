'use client'
// app/challenge/[hash]/page.tsx
// Public-facing puzzle page. Reachable from the back-of-card hash.
// Stream of consciousness: solve box → submit → unlocked tier.

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function ChallengePage() {
  const params = useParams<{ hash: string }>()
  const hash = params.hash

  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'wrong' | 'solved'>('idle')
  const [reward, setReward] = useState<{ url: string; first: boolean } | null>(null)

  async function submit() {
    if (!answer.trim()) return
    setState('submitting')
    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, answer }),
      })
      const data = await res.json()
      if (data.correct) {
        setReward({ url: data.reward_url, first: data.first_solver })
        setState('solved')
      } else {
        setState('wrong')
      }
    } catch {
      setState('wrong')
    }
  }

  return (
    <div className="min-h-screen bg-[#06070a] text-[#e8e4dc] flex items-center justify-center p-6 font-mono">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,229,200,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,1) 1px,transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] shadow-[0_0_8px_rgba(201,168,76,0.7)] animate-pulse" />
          <span className="text-[9px] tracking-[3px] uppercase text-[#c9a84c]">
            // back-of-card challenge
          </span>
        </div>

        <h1 className="text-3xl mb-2 text-white tracking-[3px]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          PROVE YOU'RE WORTH
          <br />
          A FOLLOW-UP
        </h1>

        <p className="text-[11px] tracking-widest uppercase text-[#6b6b72] mb-8">
          hash · {hash}
        </p>

        {state !== 'solved' && (
          <>
            <p className="text-xs leading-relaxed text-[#aaa] mb-6 max-w-sm">
              the answer is one lowercase word from the capability layer printed on the back of the card.
              its sha256 matches the solution. crack it.
            </p>

            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="type the answer"
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              className="w-full bg-transparent border border-[rgba(0,229,200,0.2)] rounded px-4 py-3 text-[#00e5c8] font-mono text-sm tracking-widest focus:border-[#00e5c8] focus:outline-none placeholder:text-[#333]"
            />

            <button
              onClick={submit}
              disabled={state === 'submitting' || !answer.trim()}
              className="mt-4 w-full px-5 py-3 border border-[#00e5c8] rounded text-[#00e5c8] font-mono text-xs tracking-[3px] uppercase hover:bg-[rgba(0,229,200,0.08)] transition disabled:opacity-30"
            >
              {state === 'submitting' ? 'verifying...' : '⟶ submit'}
            </button>

            {state === 'wrong' && (
              <p className="mt-4 text-xs text-[#ff3b3b] tracking-widest uppercase">
                ✗ wrong · attempt logged · try again
              </p>
            )}
          </>
        )}

        {state === 'solved' && reward && (
          <div className="border border-[#c9a84c] rounded-lg p-6 bg-[rgba(201,168,76,0.05)]">
            <p className="text-[10px] tracking-[3px] uppercase text-[#c9a84c] mb-3">
              {reward.first ? '★ first solver' : '● solved'}
            </p>
            <p className="text-white text-base mb-4">
              {reward.first
                ? 'you cracked it before anyone else.'
                : 'unlocked. nicely done.'}
            </p>
            <p className="text-[11px] text-[#aaa] mb-5 leading-relaxed">
              the inbound channel is open. expect a personal reply within 24 hours.
            </p>
            <a
              href={reward.url}
              className="inline-block px-5 py-3 border border-[#c9a84c] text-[#c9a84c] rounded font-mono text-xs tracking-[3px] uppercase hover:bg-[rgba(201,168,76,0.1)] transition"
            >
              ⟶ claim reward
            </a>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.06)] text-[8px] tracking-widest uppercase text-[#444]">
          furulie llc · cybercard challenge engine · all attempts logged
        </div>
      </div>
    </div>
  )
}
