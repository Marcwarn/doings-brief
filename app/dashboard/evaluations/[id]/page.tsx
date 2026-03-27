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

  return (
    <div style={{ padding: '40px 44px', maxWidth: 980, animation: 'fadeUp 0.35s ease both' }}>
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
            <OverviewRow label="Frågebatteri" value={evaluation.questionSetName || payload.questionSet?.name || 'Ej angivet'} />
            <OverviewRow label="Svar hittills" value={`${responses.length}`} />
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

        <SectionCard title="Inkomna svar">
          {responses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)' }}>
              Inga deltagare har svarat ännu.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {responses.map(response => (
                <div key={response.responseId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 14px 12px', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{response.email}</div>
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
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      <div style={{ padding: '16px 18px' }}>
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

const ghostButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}
