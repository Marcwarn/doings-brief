'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient, type BriefSession, type BriefResponse } from '@/lib/supabase'

type BriefDispatch = {
  dispatchId: string
  label: string
  organisation: string | null
  consultantId: string | null
  questionSetId: string | null
  sessionIds: string[]
  contacts: Array<{
    sessionId: string
    name: string
    email: string
    role: string | null
  }>
  createdAt: string
}

type DispatchPayload = {
  dispatch: BriefDispatch
  sessions: BriefSession[]
}

type QuestionGroup = {
  orderIndex: number
  questionText: string
  answers: Array<{ sessionId: string; name: string; role: string | null; text: string }>
}

type BriefComparisonQuestion = { questionText: string; consensus: string; divergence: string }
type BriefComparison = {
  overview: string
  questionComparisons: BriefComparisonQuestion[]
  commonThemes: string[]
  keyDifferences: string[]
}

export default function DispatchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sb = createClient()

  const [payload, setPayload] = useState<DispatchPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletingDispatch, setDeletingDispatch] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'data'>('overview')
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [comparison, setComparison] = useState<BriefComparison | null>(null)
  const [comparisonUpdatedAt, setComparisonUpdatedAt] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        const response = await fetch(`/api/briefs/dispatches/${id}`)
        const nextPayload = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok || !nextPayload?.dispatch) {
          setError(nextPayload?.error || 'Kunde inte läsa utskicket.')
          setLoading(false)
          return
        }

        setPayload(nextPayload)
        setLoading(false)
      } catch {
        if (cancelled) return
        setError('Nätverksfel. Försök igen.')
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [id, router, sb])

  const sessions = payload?.sessions || []
  const submittedCount = useMemo(
    () => sessions.filter(session => session.status === 'submitted').length,
    [sessions]
  )
  const pendingCount = sessions.length - submittedCount

  const submittedSessions = useMemo(
    () => sessions.filter(s => s.status === 'submitted'),
    [sessions]
  )

  // Load response data + cached comparison when Data tab is activated
  useEffect(() => {
    if (activeTab !== 'data' || !payload || submittedSessions.length === 0) return
    if (questionGroups.length > 0) return // already loaded

    let cancelled = false
    setLoadingData(true)

    const sessionIds = submittedSessions.map(s => s.id)
    const contactBySessionId = Object.fromEntries(
      payload.dispatch.contacts.map(c => [c.sessionId, c])
    )

    Promise.all([
      sb.from('brief_responses')
        .select('*')
        .in('session_id', sessionIds)
        .order('order_index'),
      payload.dispatch.dispatchId
        ? fetch('/api/briefs/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dispatchId: payload.dispatch.dispatchId,
              sessionIds,
              cachedOnly: true,
            }),
          }).then(r => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]).then(([{ data: responses }, cachedPayload]) => {
      if (cancelled) return

      if (responses) {
        const map = new Map<number, QuestionGroup>()
        for (const r of responses as BriefResponse[]) {
          const existing = map.get(r.order_index)
          const session = submittedSessions.find(s => s.id === r.session_id)
          const contact = contactBySessionId[r.session_id]
          const answer = {
            sessionId: r.session_id,
            name: session?.client_name || r.session_id,
            role: contact?.role || null,
            text: r.text_content?.trim() || 'Inget svar',
          }
          if (existing) {
            existing.answers.push(answer)
          } else {
            map.set(r.order_index, { orderIndex: r.order_index, questionText: r.question_text, answers: [answer] })
          }
        }
        setQuestionGroups(
          Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, q]) => q)
        )
      }

      if (cachedPayload?.comparison) {
        setComparison(cachedPayload.comparison)
        setComparisonUpdatedAt(cachedPayload.updatedAt || null)
      }

      setLoadingData(false)
    }).catch(() => {
      if (!cancelled) setLoadingData(false)
    })

    return () => { cancelled = true }
  }, [activeTab, payload, submittedSessions, questionGroups.length])

  async function runComparison(regenerate = false) {
    if (!payload || submittedSessions.length < 2 || comparing) return
    setComparing(true)
    setCompareError(null)
    try {
      const response = await fetch('/api/briefs/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchId: payload.dispatch.dispatchId,
          sessionIds: submittedSessions.map(s => s.id),
          regenerate,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.comparison) {
        setCompareError(data?.error || 'Kunde inte analysera svaren.')
        return
      }
      setComparison(data.comparison)
      setComparisonUpdatedAt(data.updatedAt || null)
    } catch {
      setCompareError('Nätverksfel. Försök igen.')
    } finally {
      setComparing(false)
    }
  }

  async function deleteDispatch() {
    if (!payload) return

    setDeletingDispatch(true)
    const response = await fetch('/api/briefs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: payload.sessions.map(session => session.id) }),
    })
    const nextPayload = await response.json().catch(() => null)

    if (!response.ok) {
      alert(`Kunde inte radera utskicket: ${nextPayload?.error || 'Okänt fel.'}`)
      setDeletingDispatch(false)
      return
    }

    router.push('/dashboard/briefs')
    router.refresh()
  }

  if (loading) return <PageLoader />

  if (error || !payload) {
    return (
      <div style={{ padding: '40px 44px', maxWidth: 880 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/briefs" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 12.5 }}>
            Tillbaka till briefs
          </Link>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '40px 28px', border: '1px solid var(--border)' }}>
          <h1 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)' }}>
            Utskicket kunde inte laddas
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#b91c1c' }}>{error || 'Okänt fel.'}</p>
        </div>
      </div>
    )
  }

  const { dispatch } = payload
  const contactBySessionId = Object.fromEntries(
    dispatch.contacts.map(contact => [contact.sessionId, contact])
  )

  return (
    <div style={{ padding: '40px 44px', maxWidth: 940, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/briefs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Briefs</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>Utskick</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            {dispatch.organisation || dispatch.label}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>
            {dispatch.label} · Skapad {formatDateTime(dispatch.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <MetricPill label="Mottagare" value={sessions.length} />
          <MetricPill label="Svar" value={submittedCount} tone="ok" />
          <MetricPill label="Väntar" value={pendingCount} />
          {confirmingDelete ? (
            <>
              <button onClick={() => void deleteDispatch()} disabled={deletingDispatch} style={confirmButtonStyle(deletingDispatch)}>
                {deletingDispatch ? 'Raderar…' : 'Bekräfta radera'}
              </button>
              <button onClick={() => setConfirmingDelete(false)} disabled={deletingDispatch} style={cancelButtonStyle}>
                Avbryt
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} style={deleteTriggerStyle}>
              Radera utskick
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {(['overview', 'data'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--text)' : 'var(--text-3)',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.1s',
            }}
          >
            {tab === 'overview' ? 'Översikt' : 'Data'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 18, marginBottom: 18 }}>
        <SectionCard title="Översikt">
          <OverviewGrid
            items={[
              { label: 'Organisation', value: dispatch.organisation || 'Ej angiven' },
              { label: 'Utskickstitel', value: dispatch.label },
              { label: 'Skapad', value: formatDateTime(dispatch.createdAt) },
              { label: 'Svarsfrekvens', value: `${sessions.length === 0 ? 0 : Math.round((submittedCount / sessions.length) * 100)}%` },
            ]}
          />
        </SectionCard>

        <SectionCard title="Status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatusRow label="Skickade" value={sessions.length} tone="muted" />
            <StatusRow label="Besvarade" value={submittedCount} tone="ok" />
            <StatusRow label="Inväntar svar" value={pendingCount} tone="muted" />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Mottagare">
        {sessions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Inga mottagare hittades i utskicket.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 180px 220px',
              padding: '9px 18px',
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
            }}>
              {['Respondent', 'Status', 'Skickad', ''].map(header => (
                <span key={header} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.01em' }}>
                  {header}
                </span>
              ))}
            </div>

            {sessions.map(session => (
              <div
                key={session.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 180px 220px',
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: 'var(--surface)',
                  borderBottom: '1px solid var(--border-sub)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{session.client_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{session.client_email}</div>
                  {contactBySessionId[session.id]?.role && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                      Roll: {contactBySessionId[session.id].role}
                    </div>
                  )}
                </div>
                <div>
                  <Pill ok={session.status === 'submitted'} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {formatDate(session.created_at)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/brief/${session.token}`)}
                    style={ghostButtonStyle}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    Kopiera länk
                  </button>
                  {session.status === 'submitted' && (
                    <Link href={`/dashboard/briefs/${session.id}`} style={linkButtonStyle}>
                      Se svar
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div style={{ marginTop: 18 }}>
        <SectionCard title="Historik">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HistoryItem
              title="Utskicket skapades"
              meta={`${sessions.length} mottagare lades till`}
              timestamp={dispatch.createdAt}
            />
            {submittedCount > 0 && (
              <HistoryItem
                title="Svar har kommit in"
                meta={`${submittedCount} av ${sessions.length} respondenter har svarat`}
                timestamp={latestSubmittedAt(sessions)}
              />
            )}
          </div>
        </SectionCard>
      </div>
      </>
      )}

      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {submittedSessions.length === 0 ? (
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
                Inga svar har kommit in ännu.
              </p>
            </div>
          ) : loadingData ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Response grid per question */}
              {questionGroups.map((q, qi) => (
                <div key={q.orderIndex} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-sub)', background: 'var(--bg)' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Fråga {qi + 1}
                    </span>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                      {q.questionText}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
                    {q.answers.map(a => (
                      <div key={a.sessionId} style={{ background: 'var(--surface)', padding: '14px 18px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>
                          {a.name}{a.role ? <span style={{ fontWeight: 400 }}> · {a.role}</span> : null}
                        </div>
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {a.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* AI comparison section */}
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      AI-jämförelse
                    </span>
                    {comparisonUpdatedAt && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                        Senast genererad {new Date(comparisonUpdatedAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  {submittedSessions.length >= 2 && (
                    <button
                      onClick={() => void runComparison(Boolean(comparison))}
                      disabled={comparing}
                      style={{
                        padding: '8px 16px', borderRadius: 7,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)',
                        cursor: comparing ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s',
                        opacity: comparing ? 0.65 : 1, flexShrink: 0,
                      }}
                      onMouseEnter={e => { if (!comparing) e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {comparing ? 'Analyserar...' : (comparison ? 'Analysera om' : 'Analysera med AI')}
                    </button>
                  )}
                </div>

                <div style={{ padding: '18px' }}>
                  {submittedSessions.length < 2 && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                      Jämförelse kräver minst 2 respondenter som svarat.
                    </p>
                  )}
                  {compareError && (
                    <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#b91c1c' }}>{compareError}</p>
                  )}
                  {!comparison && !compareError && submittedSessions.length >= 2 && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
                      Klicka på "Analysera med AI" för att se var respondenterna är överens och var de divergerar.
                    </p>
                  )}
                  {comparison && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <DataBlock title="Övergripande analys">
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7 }}>{comparison.overview}</p>
                      </DataBlock>

                      {comparison.questionComparisons.map((qc, i) => (
                        <DataBlock key={i} title={`Fråga ${i + 1}: ${qc.questionText}`}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '10px 14px' }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', letterSpacing: '0.05em', marginBottom: 6 }}>ÖVERENS</div>
                              <p style={{ margin: 0, fontSize: 13, color: '#14532d', lineHeight: 1.6 }}>{qc.consensus || '–'}</p>
                            </div>
                            <div style={{ background: '#fef9c3', borderRadius: 7, padding: '10px 14px' }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400e', letterSpacing: '0.05em', marginBottom: 6 }}>SKILJER SIG</div>
                              <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{qc.divergence || '–'}</p>
                            </div>
                          </div>
                        </DataBlock>
                      ))}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <DataBlock title="Gemensamma teman">
                          <DataList items={comparison.commonThemes} emptyLabel="Inga gemensamma teman identifierades." />
                        </DataBlock>
                        <DataBlock title="Viktiga skillnader">
                          <DataList items={comparison.keyDifferences} emptyLabel="Inga tydliga skillnader identifierades." />
                        </DataBlock>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function latestSubmittedAt(sessions: BriefSession[]) {
  const submitted = sessions
    .map(session => session.submitted_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  return submitted[0] || new Date().toISOString()
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.01em' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

function OverviewGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {items.map(item => (
        <div key={item.label}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>{item.label}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function MetricPill({ label, value, tone = 'muted' }: { label: string; value: number; tone?: 'muted' | 'ok' }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: '8px 12px',
      borderRadius: 999,
      border: `1px solid ${tone === 'ok' ? '#bbf7d0' : 'var(--border)'}`,
      background: tone === 'ok' ? '#f0fdf4' : 'var(--surface)',
      color: tone === 'ok' ? '#15803d' : 'var(--text)',
      letterSpacing: '0.01em',
    }}>
      {label}: {value}
    </span>
  )
}

function StatusRow({ label, value, tone }: { label: string; value: number; tone: 'muted' | 'ok' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</span>
      <MetricPill label={label} value={value} tone={tone} />
    </div>
  )
}

function HistoryItem({ title, meta, timestamp }: { title: string; meta: string; timestamp: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-sub)' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{meta}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
        {formatDateTime(timestamp)}
      </div>
    </div>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5,
      fontWeight: 600,
      padding: '4px 9px',
      borderRadius: 999,
      letterSpacing: '0.01em',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#78716c',
      display: 'inline-flex',
      alignItems: 'center',
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-2)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.15s',
  textDecoration: 'none',
}

const deleteTriggerStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-3)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.01em',
  cursor: 'pointer',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'none',
  color: 'var(--text-3)',
  fontSize: 11,
  cursor: 'pointer',
}

function confirmButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 999,
    border: 'none',
    background: 'var(--text)',
    color: 'var(--bg)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

const linkButtonStyle: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.01em',
  textDecoration: 'none',
}

function DataBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em' }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function DataList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>{emptyLabel}</p>
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(item => (
        <li key={item} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{item}</li>
      ))}
    </ul>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
