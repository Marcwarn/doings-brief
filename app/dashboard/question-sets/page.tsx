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
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
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
    <div style={pageShellStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
            Frågebatterier
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.7, maxWidth: 720 }}>
            Samla dina återanvändbara frågor i en egen yta. Här bygger du underlaget som sedan kan skickas som korta briefs till rätt personer.
          </p>
        </div>
        <Link href="/dashboard/question-sets/new" style={primaryLinkStyle}>
          Nytt batteri
        </Link>
      </div>

      <BriefSubnav active="question-sets" />

      <div style={statsRowStyle}>
        <StatCard label="Batterier" value={`${sets.length}`} text="sparade frågebatterier att utgå från" />
        <StatCard label="Senast uppdaterat" value={sets[0] ? formatDate(sets[0].updated_at) : '–'} text="det senaste batteriet i listan" />
        <StatCard label="Direkt till utskick" value={sets.length > 0 ? 'Ja' : 'Inte än'} text="varje batteri kan skickas direkt vidare" />
      </div>

      {deleteError && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {deleteError}
        </div>
      )}

      {sets.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 10 }}>
            Inga frågebatterier ännu
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.7, maxWidth: 560 }}>
            Skapa ditt första batteri när du vill återanvända en kort fråga, en kickoff-debrief eller ett genomarbetat upplägg i flera utskick.
          </p>
          <Link href="/dashboard/question-sets/new" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
            Skapa första batteriet →
          </Link>
        </div>
      ) : (
        <div style={cardGridStyle}>
          {sets.map(s => {
            const isConfirming = confirming === s.id
            const destructive = !!impact && (impact.sessionCount > 0 || impact.responseCount > 0)
            return (
              <article key={s.id} style={setCardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={eyebrowStyle}>Frågebatteri</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 8 }}>
                      {s.name}
                    </div>
                  </div>
                  <div style={metaPillStyle}>
                    Uppdaterad {formatDate(s.updated_at)}
                  </div>
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7, minHeight: 72 }}>
                  {s.description || 'Ett återanvändbart batteri som kan användas som startpunkt i ett nytt utskick.'}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={`/dashboard/send?set=${s.id}`} style={secondaryActionLinkStyle}>
                    Använd i utskick
                  </Link>
                  <Link href={`/dashboard/question-sets/${s.id}`} style={secondaryActionLinkStyle}>
                    Redigera
                  </Link>
                </div>

                {isConfirming ? (
                  <div style={confirmPanelStyle}>
                    {impactLoading ? (
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Kollar påverkan…</div>
                    ) : impact && (impact.sessionCount > 0 || impact.responseCount > 0) ? (
                      <div style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.65 }}>
                        Batteriet har skickats till <strong>{impact.sessionCount} {impact.sessionCount === 1 ? 'klient' : 'klienter'}</strong> och har <strong>{impact.responseCount} svar</strong>. Om du raderar det försvinner även kopplade svar permanent.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                        Vill du radera batteriet? Det här går inte att ångra.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => deleteSet(s.id)}
                        disabled={deleting === s.id || impactLoading}
                        style={{
                          ...confirmButtonStyle,
                          background: destructive ? '#b91c1c' : 'var(--text)',
                          opacity: deleting === s.id || impactLoading ? 0.5 : 1,
                          cursor: deleting === s.id || impactLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {deleting === s.id ? 'Raderar…' : 'Ja, radera'}
                      </button>
                      <button
                        onClick={() => { setConfirming(null); setImpact(null) }}
                        style={cancelButtonStyle}
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => startConfirm(s.id)} style={deleteButtonStyle}>
                      Radera
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div style={statCardStyle}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.04, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
        {text}
      </div>
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const pageShellStyle: React.CSSProperties = {
  padding: '40px 44px',
  maxWidth: 1320,
  animation: 'fadeUp 0.35s ease both',
}

const statsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const statCardStyle: React.CSSProperties = {
  background: 'rgba(250,248,246,0.9)',
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  padding: '18px 18px 16px',
}

const emptyStateStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  padding: '56px 26px',
  textAlign: 'center',
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
}

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
}

const setCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  padding: '22px',
  display: 'grid',
  gap: 16,
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '12px 18px',
  borderRadius: 14,
  background: 'var(--text)',
  color: '#fff',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.01em',
  textDecoration: 'none',
  boxShadow: '0 10px 24px rgba(14,14,12,0.12)',
}

const secondaryActionLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(250,248,246,0.85)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontSize: 12.5,
  fontWeight: 700,
}

const metaPillStyle: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  background: 'rgba(250,248,246,0.85)',
  border: '1px solid rgba(14,14,12,0.08)',
  fontSize: 11.5,
  color: 'var(--text-3)',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const confirmPanelStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.82)',
  padding: '14px',
  display: 'grid',
  gap: 12,
}

const confirmButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 12,
  border: 'none',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 700,
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const deleteButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text-2)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 8,
}
