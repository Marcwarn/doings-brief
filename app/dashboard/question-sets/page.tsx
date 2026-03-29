'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, type QuestionSet } from '@/lib/supabase'
import { BriefSubnav } from '@/app/dashboard/brief/ui'

type Impact = { sessionCount: number; responseCount: number }

export default function QuestionSetsPage() {
  const sb = createClient()
  const router = useRouter()
  const [sets, setSets]             = useState<QuestionSet[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [impact, setImpact]         = useState<Impact | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    sb.from('question_sets').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setSets(data || []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function startConfirm(id: string) {
    setConfirming(id)
    setImpact(null)
    setDeleteError(null)
    setImpactLoading(true)
    try {
      const res = await fetch(`/api/question-sets/delete?id=${id}`)
      if (res.ok) setImpact(await res.json())
    } finally {
      setImpactLoading(false)
    }
  }

  async function deleteSet(id: string) {
    setDeleting(id)
    setDeleteError(null)
    try {
      const res = await fetch('/api/question-sets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const body = await res.json()
        setDeleteError(body.error || 'Kunde inte radera')
        setConfirming(null)
        return
      }
      setSets(prev => prev.filter(s => s.id !== id))
      setConfirming(null)
      setImpact(null)
    } finally {
      setDeleting(null)
    }
    router.refresh()
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 860, animation: 'fadeUp 0.35s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            Frågebatterier
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>
            Skapa och hantera dina frågeuppsättningar
          </p>
        </div>
        <Link href="/dashboard/question-sets/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 8,
          background: 'var(--surface)', color: 'var(--text)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.01em', textDecoration: 'none',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-dim)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nytt batteri
        </Link>
      </div>

      <BriefSubnav active="question-sets" />

      {deleteError && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {deleteError}
        </div>
      )}

      {sets.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 10, padding: '64px 24px', textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '0 0 16px', fontStyle: 'italic' }}>
            Inga frågebatterier skapade ännu.
          </p>
          <Link href="/dashboard/question-sets/new" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
            Skapa ditt första →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {sets.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface)', padding: '16px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                {s.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{s.description}</div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, opacity: 0.7 }}>
                  Uppdaterat {new Date(s.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Link href={`/dashboard/send?set=${s.id}`} style={{
                  padding: '7px 14px', borderRadius: 6,
                  background: 'var(--surface)', color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.01em', textDecoration: 'none',
                }}>
                  Skicka
                </Link>
                <Link href={`/dashboard/question-sets/${s.id}`} style={{
                  padding: '7px 14px', borderRadius: 6,
                  background: 'var(--bg)', color: 'var(--text-2)',
                  fontSize: 12.5, fontWeight: 500, textDecoration: 'none',
                  border: '1px solid var(--border)',
                }}>
                  Redigera
                </Link>
                {confirming === s.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {impactLoading ? (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Kollar…</span>
                    ) : impact && (impact.sessionCount > 0 || impact.responseCount > 0) ? (
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', maxWidth: 260, lineHeight: 1.5 }}>
                        Batteriet har skickats till <strong>{impact.sessionCount} {impact.sessionCount === 1 ? 'klient' : 'klienter'}</strong> med <strong>{impact.responseCount} {impact.responseCount === 1 ? 'svar' : 'svar'}</strong>. Alla svar raderas permanent.
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Radera batteriet?</span>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => deleteSet(s.id)} disabled={deleting === s.id || impactLoading} style={{
                        padding: '5px 10px', borderRadius: 6, border: 'none',
                        background: impact && (impact.sessionCount > 0 || impact.responseCount > 0) ? '#b91c1c' : 'var(--text)',
                        color: '#fff',
                        fontSize: 12, fontWeight: 600,
                        cursor: deleting === s.id || impactLoading ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-sans)',
                        opacity: deleting === s.id || impactLoading ? 0.5 : 1,
                      }}>
                        {deleting === s.id ? '…' : 'Ja, radera'}
                      </button>
                      <button onClick={() => { setConfirming(null); setImpact(null) }} style={{
                        padding: '5px 10px', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'none',
                        fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}>
                        Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startConfirm(s.id)} style={{
                    padding: '7px 10px', borderRadius: 6,
                    background: 'none', border: '1px solid transparent',
                    fontSize: 12.5, color: 'var(--text-3)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', transition: 'border-color 0.1s, color 0.1s',
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
