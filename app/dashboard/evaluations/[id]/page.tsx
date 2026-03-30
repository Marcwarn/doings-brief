'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PageLoader, InlineError } from '@/app/dashboard/evaluations/ui'

type EvaluationDetailPayload = {
  evaluation: {
    id: string
    token: string
    label: string
    customer: string
    questionSetId: string
    questionSetName: string | null
    collectEmail: boolean
    createdAt: string
  }
  questionSet: {
    id: string
    name: string
    description: string | null
  } | null
  questions: Array<{
    id: string
    text: string
    order_index: number
    type: 'text' | 'scale_1_5'
  }>
  responses: Array<{
    responseId: string
    email: string
    submittedAt: string
    answers: Array<{
      questionId: string | null
      questionText: string
      orderIndex: number
      answer: string
    }>
  }>
}

export default function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [payload, setPayload] = useState<EvaluationDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'questions' | 'participants'>('questions')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch(`/api/evaluations/${id}`)
      .then(async response => {
        const nextPayload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(nextPayload?.error || 'Kunde inte läsa utvärderingen.')
        setPayload(nextPayload)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Nätverksfel.')
        setLoading(false)
      })
  }, [id])

  const publicUrl = useMemo(() => (
    payload ? `${window.location.origin}/evaluation/${payload.evaluation.token}` : ''
  ), [payload])

  const qrUrl = useMemo(() => (
    publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}` : ''
  ), [publicUrl])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  async function downloadQrPng() {
    if (!payload || !qrUrl) return

    const response = await fetch(qrUrl)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `${slugify(payload.evaluation.label)}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  if (loading) return <PageLoader />

  if (error || !payload) {
    return (
      <div style={{ padding: '40px 44px', maxWidth: 920 }}>
        <Link href="/dashboard/evaluations" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 12.5 }}>
          Tillbaka till utvärderingar
        </Link>
        <div style={{ marginTop: 20 }}>
          <InlineError text={error || 'Utvärderingen kunde inte laddas.'} />
        </div>
      </div>
    )
  }

  const { evaluation, questions, responses } = payload
  const latestResponseAt = responses[0]?.submittedAt || null
  const questionGroups = questions.map(question => {
    const entries = responses
      .map(response => {
        const answer = response.answers.find(item => item.questionId === question.id || item.orderIndex === question.order_index)
        if (!answer) return null
        return {
          responseId: response.responseId,
          answer: answer.answer,
          email: response.email,
          submittedAt: response.submittedAt,
        }
      })
      .filter((value): value is { responseId: string; answer: string; email: string; submittedAt: string } => Boolean(value))

    return {
      question,
      entries,
    }
  })

  const filteredQuestionGroups = questionGroups
    .map(group => ({
      ...group,
      entries: group.entries.filter(entry => {
        if (!normalizedSearch) return true
        return [
          group.question.text,
          entry.answer,
          evaluation.collectEmail ? entry.email : '',
        ].join(' ').toLowerCase().includes(normalizedSearch)
      }),
    }))
    .filter(group => {
      if (!normalizedSearch) return true
      return group.entries.length > 0 || group.question.text.toLowerCase().includes(normalizedSearch)
    })

  const filteredResponses = responses.filter(response => {
    if (!normalizedSearch) return true
    return [
      evaluation.collectEmail ? response.email : '',
      ...response.answers.map(answer => `${answer.questionText} ${answer.answer}`),
    ].join(' ').toLowerCase().includes(normalizedSearch)
  })

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1120, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 12.5 }}>
        <Link href="/dashboard/evaluations" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Utvärdering</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{evaluation.label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {evaluation.label}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>
            {evaluation.customer} · skapad {formatDate(evaluation.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <MetricPill label="Frågor" value={questions.length} />
          <MetricPill label="Svar" value={responses.length} tone="ok" />
          <button onClick={() => navigator.clipboard.writeText(publicUrl)} style={ghostButtonStyle}>Kopiera länk</button>
          <button onClick={() => void downloadQrPng()} style={ghostButtonStyle}>Ladda ner QR som PNG</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, marginBottom: 20 }}>
        <SectionCard title="Utvärderingslänk">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11.5, color: 'var(--text)', wordBreak: 'break-all' }}>
              {publicUrl}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <img src={qrUrl} alt="QR-kod för utvärdering" style={{ width: 200, height: 200 }} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Översikt">
          <div style={{ display: 'grid', gap: 10 }}>
            <OverviewRow label="Kund" value={evaluation.customer} />
            <OverviewRow label="Frågor" value={evaluation.questionSetName || payload.questionSet?.name || 'Ej angivet'} />
            <OverviewRow label="Svarsläge" value={evaluation.collectEmail ? 'Med e-post' : 'Anonymt'} />
            <OverviewRow label="Svar hittills" value={`${responses.length}`} />
            <OverviewRow label="Senaste svar" value={latestResponseAt ? formatDateTime(latestResponseAt) : 'Inga ännu'} />
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 18 }}>
        <SectionCard title="Frågor">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map(question => (
              <li key={question.id} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
                {question.text}
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Resultat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setView('questions')} style={pickerButtonStyle(view === 'questions')}>
                Per fråga
              </button>
              <button type="button" onClick={() => setView('participants')} style={pickerButtonStyle(view === 'participants')}>
                Per deltagare
              </button>
            </div>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Sök i svaren"
              style={searchInputStyle}
            />
          </div>

          {responses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)' }}>
              Inga deltagare har svarat ännu.
            </p>
          ) : view === 'questions' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredQuestionGroups.map(group => (
                <details key={group.question.id} open style={detailsStyle}>
                  <summary style={summaryStyle}>
                    <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{group.question.text}</div>
                      <span style={questionTypePillStyle(group.question.type)}>
                        {group.question.type === 'scale_1_5' ? 'Skala 1–5' : 'Fritext'}
                      </span>
                    </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                        {group.entries.length} svar
                      </div>
                    </div>
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {group.entries.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Inga matchande svar för den här frågan.</div>
                    ) : group.entries.map((entry, index) => (
                      <div key={`${entry.responseId}:${index}`} style={responseCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                            {evaluation.collectEmail ? entry.email : `Svar ${index + 1}`}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{formatDateTime(entry.submittedAt)}</div>
                        </div>
                        {group.question.type === 'scale_1_5' ? (
                          <div style={scaleAnswerPillStyle}>{entry.answer || 'Inget svar'}</div>
                        ) : (
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {entry.answer || 'Inget svar'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredResponses.map((response, responseIndex) => (
                <div key={response.responseId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 14px 12px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {evaluation.collectEmail ? response.email : `Svar ${responseIndex + 1}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatDateTime(response.submittedAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {response.answers.map(answer => (
                      <div key={`${response.responseId}:${answer.orderIndex}`}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{answer.questionText}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{answer.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 12px 32px rgba(16,24,40,0.04)' }}>
      <div style={{ padding: '16px 20px 13px', borderBottom: '1px solid var(--border-sub)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      <div style={{ padding: '18px 20px' }}>
        {children}
      </div>
    </div>
  )
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function MetricPill({ label, value, tone = 'muted' }: { label: string; value: number; tone?: 'muted' | 'ok' }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 999,
      border: '1px solid var(--border)',
      background: tone === 'ok' ? '#f0fdf4' : 'var(--surface)',
      fontSize: 12.5,
      color: tone === 'ok' ? '#166534' : 'var(--text)',
      fontWeight: 600,
    }}>
      {label}: {value}
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
  return new Date(value).toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'utvardering'
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

function pickerButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: active ? 'rgba(198,35,104,0.08)' : 'rgba(14,14,12,0.03)',
    color: active ? 'var(--accent)' : 'var(--text-2)',
    fontSize: 12.5,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  }
}

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 240,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 12.5,
  outline: 'none',
}

const detailsStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '12px 14px',
  background: 'var(--bg)',
}

const summaryStyle: React.CSSProperties = {
  listStyle: 'none',
  cursor: 'pointer',
}

const responseCardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 12px 10px',
  background: 'var(--surface)',
}

function questionTypePillStyle(type: 'text' | 'scale_1_5'): React.CSSProperties {
  return {
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: type === 'scale_1_5' ? 'var(--accent-dim)' : 'var(--surface)',
    color: type === 'scale_1_5' ? 'var(--accent)' : 'var(--text-3)',
    fontSize: 11,
    fontWeight: 700,
  }
}

const scaleAnswerPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 36,
  padding: '8px 12px',
  borderRadius: 999,
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 700,
}
