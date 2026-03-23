'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// Use a calm, centred background for the login screen
const BG_SRC = '/bg/bg-13.svg'

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError('Kunde inte skicka länk. Kontrollera e-postadressen.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <>
      {/* Full-bleed background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <img src={BG_SRC} alt="" aria-hidden draggable={false}
             className="absolute inset-0 w-full h-full object-cover select-none" />
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-4">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: 'linear-gradient(145deg, #6b2d82, #C62368)', boxShadow: '0 6px 24px rgba(107,45,130,0.35)' }}
          >
            D
          </div>
          <span className="text-[1.05rem] font-semibold text-doings-purple-dark tracking-tight">
            Doings Brief
          </span>
        </div>

        {/* Card */}
        <div className="glass-card w-full max-w-sm p-8">
          {!sent ? (
            <>
              <h1 className="text-[1.4rem] font-bold text-doings-purple-dark mb-1.5 text-center tracking-tight">
                Logga in
              </h1>
              <p className="text-doings-muted text-sm text-center mb-8 leading-relaxed">
                Ange din Doings-e-post så skickar vi en inloggningslänk.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="din@doings.se"
                  autoFocus
                  required
                  className="w-full rounded-xl px-4 py-3.5 text-sm text-doings-purple-dark
                             bg-white/60 border border-doings-purple-light/70
                             focus:outline-none focus:border-doings-purple transition-colors
                             placeholder:text-doings-muted/50"
                />
                {error && (
                  <p className="text-red-500 text-xs text-center">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white
                             transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(145deg, #6b2d82, #C62368)', boxShadow: '0 4px 20px rgba(107,45,130,0.30)' }}
                >
                  {loading ? 'Skickar…' : 'Skicka inloggningslänk'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              {/* Mail icon — no emoji */}
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
                   style={{ background: 'linear-gradient(145deg, #6b2d82, #C62368)', boxShadow: '0 6px 24px rgba(107,45,130,0.32)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-doings-purple-dark mb-2.5 tracking-tight">
                Kolla din e-post
              </h2>
              <p className="text-doings-muted text-sm leading-relaxed">
                Vi skickade en inloggningslänk till{' '}
                <span className="font-medium text-doings-purple-dark">{email}</span>.
                Klicka på länken för att komma in.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-6 text-xs text-doings-muted underline hover:no-underline transition-all"
              >
                Fel adress? Försök igen
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
