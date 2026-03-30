'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { hasLoginScopeCookie, setLoginScopeCookie } from '@/lib/auth-persistence'

export default function LoginPage() {
  const router  = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [mode,     setMode]     = useState<'login' | 'forgot'>('login')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    createClient().auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      if (!hasLoginScopeCookie()) {
        await createClient().auth.signOut()
        return
      }

      const response = await fetch('/api/brief-access', { cache: 'no-store' })
      if (response.ok) {
        router.replace('/dashboard')
      } else {
        await createClient().auth.signOut()
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithPassword({ email, password })
    if (err) {
      setError('Fel e-post eller lösenord.')
      setLoading(false)
    } else {
      const accessResponse = await fetch('/api/brief-access', { cache: 'no-store' })
      if (!accessResponse.ok) {
        await createClient().auth.signOut()
        setError('Du har inte tillgång till Brief ännu.')
        setLoading(false)
        return
      }

      setLoginScopeCookie(remember)
      router.replace('/dashboard')
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    await response.json().catch(() => null)
    if (!response.ok) {
      setError('Kunde inte skicka återställningsmail. Kontrollera adressen.')
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  const DoingsLogo = () => (
    <svg style={{ width: 44, height: 'auto' }} viewBox="0 0 47.6 45.06" xmlns="http://www.w3.org/2000/svg">
      <path fill="#fff" d="M0,0V25.82H7.82A17.07,17.07,0,0,0,13.36,25a12.59,12.59,0,0,0,3.78-2,10.12,10.12,0,0,0,2.38-2.75,13.29,13.29,0,0,0,1.27-2.89,13.22,13.22,0,0,0,.52-2.5c.07-.75.1-1.28.1-1.58a11.29,11.29,0,0,0-.1-1.59,13.22,13.22,0,0,0-.52-2.5A13.29,13.29,0,0,0,19.52,6.3a10.27,10.27,0,0,0-2.38-2.75A11.1,11.1,0,0,0,14.62,2H29.26A11,11,0,0,0,26.2,4.22a11.84,11.84,0,0,0-2.51,3.92,13.34,13.34,0,0,0-.91,5,13.54,13.54,0,0,0,.91,5,11.83,11.83,0,0,0,2.51,3.94,11.1,11.1,0,0,0,3.86,2.58,13.82,13.82,0,0,0,9.93,0,11,11,0,0,0,5.61-5V30a3.44,3.44,0,0,0-1.2-.66A8,8,0,0,0,42.18,29a5.48,5.48,0,0,0-2.19.39,5,5,0,0,0-1.49,1A3.78,3.78,0,0,0,37.38,33a4,4,0,0,0,.52,2.19,4.18,4.18,0,0,0,1.29,1.29,6.49,6.49,0,0,0,1.68.75c.61.18,1.16.37,1.68.56a5,5,0,0,1,1.29.72,1.53,1.53,0,0,1,.52,1.25,2,2,0,0,1-.26,1,2.49,2.49,0,0,1-.67.74,3.09,3.09,0,0,1-.91.45,3.37,3.37,0,0,1-1,.15,4,4,0,0,1-1.67-.37,3.16,3.16,0,0,1-1.33-1.15L37,41.94a4,4,0,0,0,1.23,1.12H33.68a6.81,6.81,0,0,0,.94-.46v-7H29.56v1.8H32.7v3.94a5.31,5.31,0,0,1-1.55.55,9.57,9.57,0,0,1-1.93.19A5.44,5.44,0,0,1,27,41.67a5.09,5.09,0,0,1-1.74-1.19,5.47,5.47,0,0,1-1.16-1.79,5.89,5.89,0,0,1-.42-2.23,6.51,6.51,0,0,1,.38-2.19,5.19,5.19,0,0,1,2.76-3,5.19,5.19,0,0,1,2.2-.45,6.53,6.53,0,0,1,2.06.33A5,5,0,0,1,33,32.32l1.36-1.46a6,6,0,0,0-2.08-1.35,8.93,8.93,0,0,0-3.2-.49,7.7,7.7,0,0,0-3,.57,7,7,0,0,0-2.33,1.57,7.35,7.35,0,0,0-1.52,2.36,7.75,7.75,0,0,0-.55,2.94,8.16,8.16,0,0,0,.51,2.85,7,7,0,0,0,1.48,2.37,6.8,6.8,0,0,0,1.94,1.38H18.92V29.38H17V41h0L9.16,29.38H6.64V43.06H2V29H0V45.06H47.6V0ZM18.15,8.59a11,11,0,0,1,.92,4.67,11,11,0,0,1-.92,4.66,9,9,0,0,1-2.52,3.25,10.57,10.57,0,0,1-3.77,1.9,16.24,16.24,0,0,1-4.65.62H2.38V2.82H7.21a16.24,16.24,0,0,1,4.65.62,10.57,10.57,0,0,1,3.77,1.9A9,9,0,0,1,18.15,8.59Zm26.21,8.65a9.75,9.75,0,0,1-2,3.31,9.31,9.31,0,0,1-3.16,2.21,11.21,11.21,0,0,1-8.33,0,9.31,9.31,0,0,1-3.16-2.21,9.75,9.75,0,0,1-2-3.31,12,12,0,0,1-.7-4.11A11.86,11.86,0,0,1,25.69,9a9.85,9.85,0,0,1,2-3.31,9.15,9.15,0,0,1,3.16-2.2,11.11,11.11,0,0,1,8.33,0,9.15,9.15,0,0,1,3.16,2.2,9.85,9.85,0,0,1,2,3.31,12.05,12.05,0,0,1,.7,4.12A11.8,11.8,0,0,1,44.36,17.24Zm-.51-13A10.88,10.88,0,0,0,40.79,2H45.6V6.59a11.26,11.26,0,0,0-1.75-2.37ZM42.91,35.7a16.43,16.43,0,0,1-1.68-.54,4.05,4.05,0,0,1-1.29-.78A1.74,1.74,0,0,1,39.42,33a2.07,2.07,0,0,1,.13-.7,1.83,1.83,0,0,1,.45-.71,2.37,2.37,0,0,1,.85-.54,3.78,3.78,0,0,1,1.33-.21,3.26,3.26,0,0,1,1.5.34,2.63,2.63,0,0,1,1,.9l.9-.82v6a3.89,3.89,0,0,0-1-.85,8,8,0,0,0-1.67-.73ZM8.56,31.9h0l7.55,11.16H8.56ZM44.49,43.06a4.87,4.87,0,0,0,.47-.32A4.1,4.1,0,0,0,45.6,42v1Z"/>
    </svg>
  )

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(circle at top left, rgba(198,35,104,0.08), transparent 34%)',
            'radial-gradient(circle at right 18%, rgba(198,35,104,0.05), transparent 24%)',
            'linear-gradient(180deg, #faf8f6 0%, #f5f2ef 100%)',
          ].join(', '),
        }}
      />

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 24,
          overflow: 'hidden',
          border: '1px solid rgba(14,14,12,0.08)',
          boxShadow: '0 28px 72px rgba(14,14,12,0.08), 0 6px 18px rgba(14,14,12,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>

          {/* Header */}
          <div
            style={{
              padding: '2rem 2.25rem 1.4rem',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(251,247,248,0.96) 100%)',
              borderBottom: '1px solid rgba(14,14,12,0.06)',
            }}
          >
            <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(198,35,104,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: -30, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(198,35,104,0.035)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.4rem', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 24px rgba(14,14,12,0.14)',
              }}>
                <DoingsLogo />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>
                Brief
              </span>
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 29, fontWeight: 700, color: 'var(--text)', margin: '0 0 0.45rem', lineHeight: 1.15, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>
              {mode === 'login' ? 'Välkommen tillbaka.' : 'Återställ lösenord.'}
            </h1>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-2)', margin: 0, position: 'relative', zIndex: 1, fontWeight: 400, lineHeight: 1.65, maxWidth: 340 }}>
              {mode === 'login'
                ? 'Logga in med din e-post och ditt lösenord.'
                : 'Ange din e-post så skickar vi en återställningslänk.'
              }
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '1.9rem 2.25rem 2.3rem', background: 'transparent' }}>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="E-postadress">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="din@doings.se" autoFocus required style={inputStyle}
                         onFocus={e => {
                           e.target.style.borderColor = 'rgba(198,35,104,0.45)'
                           e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)'
                         }}
                         onBlur={e => {
                           e.target.style.borderColor = 'var(--border)'
                           e.target.style.boxShadow = 'none'
                         }} />
                </Field>

                <Field label="Lösenord">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                         placeholder="••••••••" required style={inputStyle}
                         onFocus={e => {
                           e.target.style.borderColor = 'rgba(198,35,104,0.45)'
                           e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)'
                         }}
                         onBlur={e => {
                           e.target.style.borderColor = 'var(--border)'
                           e.target.style.boxShadow = 'none'
                         }} />
                </Field>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13.5,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-sans)',
                  userSelect: 'none',
                  cursor: 'pointer',
                  marginTop: 2,
                }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  />
                  Håll mig inloggad
                </label>

                {error && <p style={{ color: '#a22d5f', fontSize: 12.5, margin: 0, fontFamily: 'var(--font-sans)' }}>{error}</p>}

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading ? 'Loggar in…' : (
                    <>Logga in <Arrow /></>
                  )}
                </button>

                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSent(false) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-3)', textDecoration: 'underline', textAlign: 'center' as const, padding: 0 }}>
                  Glömt lösenord?
                </button>
              </form>
            ) : sent ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(198,35,104,0.06)', border: '1px solid rgba(198,35,104,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C62368" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--text)', fontFamily: 'var(--font-sans)', fontWeight: 600, margin: '0 0 6px' }}>Kolla din inbox</p>
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', fontFamily: 'var(--font-sans)', margin: '0 0 20px', lineHeight: 1.6 }}>
                  Vi skickade en länk till <strong>{email}</strong>
                </p>
                <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-3)', textDecoration: 'underline' }}>
                  Tillbaka till inloggning
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="E-postadress">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="din@doings.se" autoFocus required style={inputStyle}
                         onFocus={e => {
                           e.target.style.borderColor = 'rgba(198,35,104,0.45)'
                           e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)'
                         }}
                         onBlur={e => {
                           e.target.style.borderColor = 'var(--border)'
                           e.target.style.boxShadow = 'none'
                         }} />
                </Field>

                {error && <p style={{ color: '#a22d5f', fontSize: 12.5, margin: 0, fontFamily: 'var(--font-sans)' }}>{error}</p>}

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading ? 'Skickar…' : (<>Skicka återställningslänk <Arrow /></>)}
                </button>

                <button type="button" onClick={() => { setMode('login'); setError('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-3)', textDecoration: 'underline', textAlign: 'center' as const, padding: 0 }}>
                  Tillbaka till inloggning
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '13px 16px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s',
}

function primaryBtn(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: loading ? '#d78aa5' : 'var(--text)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.01em',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.18s',
    boxShadow: '0 10px 24px rgba(14,14,12,0.12)',
  }
}
