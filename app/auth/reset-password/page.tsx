'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function ResetInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const sb           = createClient()

  const [ready,    setReady]    = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  // Exchange the recovery code for a session
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) { router.replace('/login'); return }
    sb.auth.exchangeCodeForSession(code).then(({ error: err }) => {
      if (err) { router.replace('/login'); return }
      setReady(true)
    })
  }, []) // eslint-disable-line

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Lösenorden matchar inte.'); return }
    if (password.length < 8)  { setError('Lösenordet måste vara minst 8 tecken.'); return }
    setLoading(true); setError('')
    const { error: err } = await sb.auth.updateUser({ password })
    if (err) {
      setError('Kunde inte uppdatera lösenordet. Försök igen.')
      setLoading(false)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/dashboard/utvardering/skapa'), 2000)
    }
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C62368', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', maxWidth: 460,
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      border: '0.5px solid rgba(198,35,104,0.15)',
      boxShadow: '0 24px 64px rgba(198,35,104,0.16), 0 4px 16px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ background: '#C62368', padding: '2rem 2.4rem 2.2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(247,202,202,0.12)', pointerEvents: 'none' }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 0.4rem', lineHeight: 1.2, letterSpacing: '-0.01em', position: 'relative', zIndex: 1 }}>
          Välj nytt lösenord.
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.65)', margin: 0, position: 'relative', zIndex: 1, fontWeight: 300 }}>
          Minst 8 tecken.
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '2rem 2.4rem 2.4rem', background: '#fdf5f7' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: '1px solid #f0cdd8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C62368" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontSize: 14, color: '#6b3348', fontFamily: 'var(--font-sans)', fontWeight: 500, margin: '0 0 4px' }}>Lösenord uppdaterat!</p>
            <p style={{ fontSize: 13, color: '#a0607a', fontFamily: 'var(--font-sans)', margin: 0 }}>Omdirigerar till dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
      <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', color: '#a0607a', marginBottom: 8 }}>
                Nytt lösenord
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                     placeholder="••••••••" autoFocus required style={inputStyle}
                     onFocus={e => (e.target.style.borderColor = '#C62368')}
                     onBlur={e => (e.target.style.borderColor = '#f0cdd8')} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', color: '#a0607a', marginBottom: 8 }}>
                Upprepa lösenord
              </label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                     placeholder="••••••••" required style={inputStyle}
                     onFocus={e => (e.target.style.borderColor = '#C62368')}
                     onBlur={e => (e.target.style.borderColor = '#f0cdd8')} />
            </div>

            {error && <p style={{ color: '#C62368', fontSize: 12.5, margin: 0, fontFamily: 'var(--font-sans)' }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? '#e08aaa' : '#C62368',
              color: '#fff', border: 'none', borderRadius: 10, padding: '14px 20px',
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
              letterSpacing: '0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.18s',
            }}>
              {loading ? 'Sparar…' : 'Spara lösenord'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff',
  border: '1.5px solid #f0cdd8', borderRadius: 10,
  padding: '13px 16px',
  fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1a1a1a',
  outline: 'none', transition: 'border-color 0.18s',
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', background: 'var(--bg)' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C62368', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />)}
        </div>
      }>
        <ResetInner />
      </Suspense>
    </div>
  )
}
