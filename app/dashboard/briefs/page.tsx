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
    <div style={{ padding: '36px 40px', maxWidth: 820, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: 0 }}>Skickade briefs</h1>
          <p style={{ fontSize: 13.5, color: '#9ca3af', margin: '4px 0 0' }}>Alla briefs och deras svar</p>
        </div>
        <Link href="/dashboard/send" style={{
          padding: '9px 16px', borderRadius: 8,
          background: '#C62368', color: '#fff',
          fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(198,35,104,0.22)',
        }}>
          + Skicka ny
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>Inga briefs skickade ännu.</p>
          <Link href="/dashboard/send" style={{ fontSize: 13.5, fontWeight: 500, color: '#C62368', textDecoration: 'none' }}>
            Skicka din första brief →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => (
            <div key={s.id} style={{
              background: '#fff', borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{s.client_name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{s.client_email}</div>
                <div style={{ fontSize: 11.5, color: '#d1d5db', marginTop: 2 }}>
                  {new Date(s.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {s.status === 'submitted' && (
                  <Link href={`/dashboard/briefs/${s.id}`} style={{
                    padding: '6px 14px', borderRadius: 7,
                    background: '#C62368', color: '#fff',
                    fontSize: 12.5, fontWeight: 500, textDecoration: 'none',
                  }}>
                    Se svar
                  </Link>
                )}
                <button onClick={() => navigator.clipboard.writeText(briefUrl(s.token))} style={{
                  padding: '6px 12px', borderRadius: 7,
                  border: '1px solid #e5e7eb', background: '#fff',
                  fontSize: 12.5, fontWeight: 500, color: '#374151',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>
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

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'submitted'
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20,
      background: ok ? '#dcfce7' : '#f3f4f6',
      color: ok ? '#15803d' : '#6b7280',
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C62368', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
