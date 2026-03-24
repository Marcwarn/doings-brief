'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BG_SRC = '/bg/bg-13.svg'

export default function LoginPage() {
  const router = useRouter()
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const CODE_MIN = 8
  const [step,    setStep]    = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // If already logged in → skip login page entirely
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [])

  // Step 1 — send OTP code to email (no magic link)
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (err) {
      // shouldCreateUser=false gives error for unknown emails — allow it and show code step anyway
      // so we don't leak which emails exist
      if (err.message?.toLowerCase().includes('signup')) {
        setError('Den e-postadressen är inte registrerad i systemet.')
      } else {
        setError('Kunde inte skicka koden. Försök igen.')
      }
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  // Step 2 — verify the 6-digit code
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    if (err) {
      setError('Fel kod eller koden har gått ut. Försök igen.')
      setLoading(false)
    } else {
      router.replace('/dashboard')
    }
  }

  return (
    <>
      {/* Full-bleed background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <img src={BG_SRC} alt="" aria-hidden draggable={false}
             className="absolute inset-0 w-full h-full object-cover select-none" />
      </div>

      {/* Doings logo — top-left corner */}
      <div className="fixed top-5 left-5 z-30 pointer-events-none select-none">
        <img
          src="/doings-logo-white.svg"
          alt="Doings"
          width={72}
          draggable={false}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(30,14,46,0.45)) drop-shadow(0 0 12px rgba(107,45,130,0.3))' }}
        />
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-4">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <span className="text-[1.05rem] font-semibold text-doings-purple-dark tracking-tight">
            Doings Brief
          </span>
        </div>

        {/* Card */}
        <div className="glass-card w-full max-w-sm p-8">

          {step === 'email' ? (
            <>
              <h1 className="text-[1.4rem] font-bold text-doings-purple-dark mb-1.5 text-center tracking-tight">
                Logga in
              </h1>
              <p className="text-doings-muted text-sm text-center mb-8 leading-relaxed">
                Ange din Doings-e-post så skickar vi en engångskod.
              </p>

              <form onSubmit={handleSendCode} className="flex flex-col gap-3.5">
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
                  {loading ? 'Skickar…' : 'Skicka kod'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Mail icon */}
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
                   style={{ background: 'linear-gradient(145deg, #6b2d82, #C62368)', boxShadow: '0 6px 24px rgba(107,45,130,0.32)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-doings-purple-dark mb-1.5 tracking-tight text-center">
                Ange koden
              </h2>
              <p className="text-doings-muted text-sm text-center mb-6 leading-relaxed">
                Vi skickade en 8-siffrig kod till{' '}
                <span className="font-medium text-doings-purple-dark">{email}</span>.
              </p>

              <form onSubmit={handleVerifyCode} className="flex flex-col gap-3.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345678"
                  autoFocus
                  required
                  className="w-full rounded-xl px-4 py-3.5 text-center text-2xl font-bold tracking-[0.35em]
                             text-doings-purple-dark bg-white/60 border border-doings-purple-light/70
                             focus:outline-none focus:border-doings-purple transition-colors
                             placeholder:text-doings-muted/30 placeholder:font-normal placeholder:tracking-normal"
                />
                {error && (
                  <p className="text-red-500 text-xs text-center">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || code.length < CODE_MIN}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white
                             transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(145deg, #6b2d82, #C62368)', boxShadow: '0 4px 20px rgba(107,45,130,0.30)' }}
                >
                  {loading ? 'Verifierar…' : 'Logga in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  className="text-xs text-doings-muted underline hover:no-underline transition-all"
                >
                  Fel adress? Gå tillbaka
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  )
}
