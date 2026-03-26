'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, type BriefSession } from '@/lib/supabase'

export default function BriefsPage() {
  const sb = createClient()
  const router = useRouter()
  const [sessions, setSessions]     = useState<BriefSession[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
    const query = sb.from('brief_sessions').select('*').order('created_at', { ascending: false })
    const { data } = profile?.role === 'admin'
      ? await query
      : await query.eq('consultant_id', user.id)
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSession(id: string) {
    setDeleting(id)
    const { error, count } = await sb.from('brief_sessions').delete({ count: 'exact' }).eq('id', id)
    if (error || count === 0) {
      alert(`Kunde inte radera: ${error?.message || 'Behörighet saknas — briefen kan tillhöra en annan användare.'}`)
      setDeleting(null); setConfirming(null); return
    }
    setSessions(prev => prev.filter(s => s.id !== id))
    setConfirming(null); setDeleting(null)
    router.refresh()
  }

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
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 110px 130px 220px',
            padding: '9px 22px', background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Kund', 'Status', 'Skickad', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {sessions.map(s => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 130px 220px',
              alignItems: 'center',
              padding: '14px 22px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>

              {/* Kund */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), #6b2d82)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff',
                }}>
                  {s.client_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.client_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.client_email}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div><Pill ok={s.status === 'submitted'} /></div>

              {/* Datum */}
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {new Date(s.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              {/* Åtgärder */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                {s.status === 'submitted' && (
                  <Link href={`/dashboard/briefs/${s.id}`} style={{
                    padding: '6px 13px', borderRadius: 6,
                    background: 'var(--accent)', color: '#fff',
                    fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.01em', textDecoration: 'none', flexShrink: 0,
                  }}>
                    Se svar
                  </Link>
                )}
                <button onClick={() => navigator.clipboard.writeText(briefUrl(s.token))} title="Kopiera länk" style={{
                  padding: '6px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: 12, fontWeight: 500, color: 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s', flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  Kopiera länk
                </button>
                {confirming === s.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Radera?</span>
                    <button onClick={() => deleteSession(s.id)} disabled={deleting === s.id} style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none',
                      background: 'var(--text)', color: 'var(--bg)',
                      fontSize: 12, fontWeight: 600, cursor: deleting === s.id ? 'not-allowed' : 'pointer',
                      opacity: deleting === s.id ? 0.5 : 1,
                    }}>
                      {deleting === s.id ? '…' : 'Ja'}
                    </button>
                    <button onClick={() => setConfirming(null)} style={{
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'none',
                      fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                    }}>
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirming(s.id)} style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: 'none', border: '1px solid transparent',
                    fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                    transition: 'border-color 0.1s, color 0.1s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}>
                    Radera
                  </button>
                )}
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
