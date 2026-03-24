'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router  = useRouter()
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Already logged in → skip directly to dashboard
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (err) {
      setError(err.message?.toLowerCase().includes('signup')
        ? 'Den e-postadressen är inte registrerad.'
        : 'Kunde inte skicka koden. Försök igen.')
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.verifyOtp({
      email, token: code.trim(), type: 'email',
    })
    if (err) {
      setError('Fel kod eller koden har gått ut. Försök igen.')
      setLoading(false)
    } else {
      router.replace('/dashboard')
    }
  }

  // ── Doings logo SVG (white) ───────────────────────────────────────
  const DoingsLogo = () => (
    <svg style={{ width: 44, height: 'auto' }} viewBox="0 0 47.6 45.06" xmlns="http://www.w3.org/2000/svg">
      <path fill="#fff" d="M0,0V25.82H7.82A17.07,17.07,0,0,0,13.36,25a12.59,12.59,0,0,0,3.78-2,10.12,10.12,0,0,0,2.38-2.75,13.29,13.29,0,0,0,1.27-2.89,13.22,13.22,0,0,0,.52-2.5c.07-.75.1-1.28.1-1.58a11.29,11.29,0,0,0-.1-1.59,13.22,13.22,0,0,0-.52-2.5A13.29,13.29,0,0,0,19.52,6.3a10.27,10.27,0,0,0-2.38-2.75A11.1,11.1,0,0,0,14.62,2H29.26A11,11,0,0,0,26.2,4.22a11.84,11.84,0,0,0-2.51,3.92,13.34,13.34,0,0,0-.91,5,13.54,13.54,0,0,0,.91,5,11.83,11.83,0,0,0,2.51,3.94,11.1,11.1,0,0,0,3.86,2.58,13.82,13.82,0,0,0,9.93,0,11,11,0,0,0,5.61-5V30a3.44,3.44,0,0,0-1.2-.66A8,8,0,0,0,42.18,29a5.48,5.48,0,0,0-2.19.39,5,5,0,0,0-1.49,1A3.78,3.78,0,0,0,37.38,33a4,4,0,0,0,.52,2.19,4.18,4.18,0,0,0,1.29,1.29,6.49,6.49,0,0,0,1.68.75c.61.18,1.16.37,1.68.56a5,5,0,0,1,1.29.72,1.53,1.53,0,0,1,.52,1.25,2,2,0,0,1-.26,1,2.49,2.49,0,0,1-.67.74,3.09,3.09,0,0,1-.91.45,3.37,3.37,0,0,1-1,.15,4,4,0,0,1-1.67-.37,3.16,3.16,0,0,1-1.33-1.15L37,41.94a4,4,0,0,0,1.23,1.12H33.68a6.81,6.81,0,0,0,.94-.46v-7H29.56v1.8H32.7v3.94a5.31,5.31,0,0,1-1.55.55,9.57,9.57,0,0,1-1.93.19A5.44,5.44,0,0,1,27,41.67a5.09,5.09,0,0,1-1.74-1.19,5.47,5.47,0,0,1-1.16-1.79,5.89,5.89,0,0,1-.42-2.23,6.51,6.51,0,0,1,.38-2.19,5.19,5.19,0,0,1,2.76-3,5.19,5.19,0,0,1,2.2-.45,6.53,6.53,0,0,1,2.06.33A5,5,0,0,1,33,32.32l1.36-1.46a6,6,0,0,0-2.08-1.35,8.93,8.93,0,0,0-3.2-.49,7.7,7.7,0,0,0-3,.57,7,7,0,0,0-2.33,1.57,7.35,7.35,0,0,0-1.52,2.36,7.75,7.75,0,0,0-.55,2.94,8.16,8.16,0,0,0,.51,2.85,7,7,0,0,0,1.48,2.37,6.8,6.8,0,0,0,1.94,1.38H18.92V29.38H17V41h0L9.16,29.38H6.64V43.06H2V29H0V45.06H47.6V0ZM18.15,8.59a11,11,0,0,1,.92,4.67,11,11,0,0,1-.92,4.66,9,9,0,0,1-2.52,3.25,10.57,10.57,0,0,1-3.77,1.9,16.24,16.24,0,0,1-4.65.62H2.38V2.82H7.21a16.24,16.24,0,0,1,4.65.62,10.57,10.57,0,0,1,3.77,1.9A9,9,0,0,1,18.15,8.59Zm26.21,8.65a9.75,9.75,0,0,1-2,3.31,9.31,9.31,0,0,1-3.16,2.21,11.21,11.21,0,0,1-8.33,0,9.31,9.31,0,0,1-3.16-2.21,9.75,9.75,0,0,1-2-3.31,12,12,0,0,1-.7-4.11A11.86,11.86,0,0,1,25.69,9a9.85,9.85,0,0,1,2-3.31,9.15,9.15,0,0,1,3.16-2.2,11.11,11.11,0,0,1,8.33,0,9.15,9.15,0,0,1,3.16,2.2,9.85,9.85,0,0,1,2,3.31,12.05,12.05,0,0,1,.7,4.12A11.8,11.8,0,0,1,44.36,17.24Zm-.51-13A10.88,10.88,0,0,0,40.79,2H45.6V6.59a11.26,11.26,0,0,0-1.75-2.37ZM42.91,35.7a16.43,16.43,0,0,1-1.68-.54,4.05,4.05,0,0,1-1.29-.78A1.74,1.74,0,0,1,39.42,33a2.07,2.07,0,0,1,.13-.7,1.83,1.83,0,0,1,.45-.71,2.37,2.37,0,0,1,.85-.54,3.78,3.78,0,0,1,1.33-.21,3.26,3.26,0,0,1,1.5.34,2.63,2.63,0,0,1,1,.9l.9-.82v6a3.89,3.89,0,0,0-1-.85,8,8,0,0,0-1.67-.73ZM8.56,31.9h0l7.55,11.16H8.56ZM44.49,43.06a4.87,4.87,0,0,0,.47-.32A4.1,4.1,0,0,0,45.6,42v1Z"/>
    </svg>
  )

  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <img src="/bg/bg-13.svg" alt="" aria-hidden draggable={false}
             className="absolute inset-0 w-full h-full object-cover select-none" />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          border: '0.5px solid rgba(198,35,104,0.15)',
          boxShadow: '0 24px 64px rgba(198,35,104,0.16), 0 4px 16px rgba(0,0,0,0.06)',
        }}>

          {/* ── Modal header ── */}
          <div style={{
            background: '#C62368',
            padding: '2rem 2.4rem 2.2rem',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', right: -40, top: -40,
              width: 180, height: 180, borderRadius: '50%',
              background: 'rgba(247,202,202,0.12)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', right: 30, bottom: -60,
              width: 130, height: 130, borderRadius: '50%',
              background: 'rgba(247,202,202,0.08)',
              pointerEvents: 'none',
            }} />

            {/* Logo + wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.4rem', position: 'relative', zIndex: 1 }}>
              <DoingsLogo />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'DM Sans, sans-serif' }}>
                Brief
              </span>
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 26, fontWeight: 400, color: '#fff',
              margin: '0 0 0.4rem', lineHeight: 1.25,
              position: 'relative', zIndex: 1,
            }}>
              {step === 'email' ? 'Välkommen tillbaka.' : 'Kolla din inbox.'}
            </h1>

            {/* Subtitle */}
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13.5, color: 'rgba(255,255,255,0.65)',
              margin: 0, position: 'relative', zIndex: 1,
              fontWeight: 300, lineHeight: 1.55,
            }}>
              {step === 'email'
                ? 'Ange din e-post så skickar vi en engångskod direkt till dig.'
                : <>Vi skickade en 8-siffrig kod till <strong style={{ fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{email}</strong>.</>
              }
            </p>
          </div>

          {/* ── Modal body ── */}
          <div style={{ padding: '2rem 2.4rem 2.4rem', background: '#fdf5f7' }}>

            {step === 'email' ? (
              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <label style={{
                  display: 'block', fontSize: 11.5, fontWeight: 500,
                  letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                  color: '#a0607a', marginBottom: 8, fontFamily: 'DM Sans, sans-serif',
                }}>
                  E-postadress
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="din@doings.se"
                  autoFocus
                  required
                  style={{
                    width: '100%', background: '#fff',
                    border: '1.5px solid #f0cdd8', borderRadius: 10,
                    padding: '13px 16px',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: '#1a1a1a',
                    outline: 'none', transition: 'border-color 0.18s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#C62368')}
                  onBlur={e  => (e.target.style.borderColor = '#f0cdd8')}
                />

                {error && (
                  <p style={{ color: '#C62368', fontSize: 12.5, marginTop: 8, fontFamily: 'DM Sans, sans-serif' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', marginTop: '1rem',
                    background: loading ? '#e08aaa' : '#C62368',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '14px 20px',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.18s, transform 0.12s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {loading ? 'Skickar…' : (
                    <>
                      Skicka kod
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '1.4rem' }}>
                  <div style={{ flex: 1, height: 0.5, background: '#f0cdd8' }} />
                  <span style={{ fontSize: 12, color: '#c4909f', whiteSpace: 'nowrap' as const, fontFamily: 'DM Sans, sans-serif' }}>
                    Doings konsulter
                  </span>
                  <div style={{ flex: 1, height: 0.5, background: '#f0cdd8' }} />
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <label style={{
                  display: 'block', fontSize: 11.5, fontWeight: 500,
                  letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                  color: '#a0607a', marginBottom: 8, fontFamily: 'DM Sans, sans-serif',
                }}>
                  Inloggningskod
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="· · · · · · · ·"
                  autoFocus
                  required
                  style={{
                    width: '100%', background: '#fff',
                    border: '1.5px solid #f0cdd8', borderRadius: 10,
                    padding: '13px 16px',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 700,
                    color: '#1a1a1a', outline: 'none',
                    textAlign: 'center', letterSpacing: '0.3em',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#C62368')}
                  onBlur={e  => (e.target.style.borderColor = '#f0cdd8')}
                />

                {error && (
                  <p style={{ color: '#C62368', fontSize: 12.5, marginTop: 8, fontFamily: 'DM Sans, sans-serif' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length < 8}
                  style={{
                    width: '100%', marginTop: '1rem',
                    background: (loading || code.length < 8) ? '#e08aaa' : '#C62368',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '14px 20px',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 500,
                    cursor: (loading || code.length < 8) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.18s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {loading ? 'Verifierar…' : (
                    <>
                      Logga in
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  style={{
                    marginTop: '0.9rem', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12.5, color: '#c4909f', textDecoration: 'underline',
                    textAlign: 'center' as const,
                  }}
                >
                  Fel adress? Gå tillbaka
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
