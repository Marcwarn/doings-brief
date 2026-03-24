'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession } from '@/lib/supabase'

export default function BriefsPage() {
  const sb = createClient()
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    sb.from('brief_sessions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setSessions(data || []); setLoading(false) })
  }, [])

  function briefUrl(token: string) { return `${window.location.origin}/brief/${token}` }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 880, animation: 'fadeUp 0.35s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            Skickade briefs
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>
            Alla briefs och deras svar
          </p>
        </div>
        <Link href="/dashboard/send" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 8,
          background: 'var(--accent)', color: '#fff',
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.01em', textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(198,35,104,0.22)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 20px rgba(198,35,104,0.30)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 16px rgba(198,35,104,0.22)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Skicka ny
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '64px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '0 0 16px', fontStyle: 'italic' }}>
            Inga briefs skickade ännu.
          </p>
          <Link href="/dashboard/send" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
            Skicka din första brief →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {sessions.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface)', padding: '16px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.client_name}</span>
                  <Pill ok={s.status === 'submitted'} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{s.client_email}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, opacity: 0.7 }}>
                  {new Date(s.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {s.status === 'submitted' && (
                  <Link href={`/dashboard/briefs/${s.id}`} style={{
                    padding: '7px 14px', borderRadius: 6,
                    background: 'var(--accent)', color: '#fff',
                    fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.01em', textDecoration: 'none',
                  }}>
                    Se svar
                  </Link>
                )}
                <button onClick={() => navigator.clipboard.writeText(briefUrl(s.token))} style={{
                  padding: '7px 14px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  Kopiera länk
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#a8a29e',
      flexShrink: 0,
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
