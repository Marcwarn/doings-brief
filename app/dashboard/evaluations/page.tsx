'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EmptyCard, EvaluationSubnav, InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'

type EvaluationListItem = {
  id: string
  token: string
  label: string
  customer: string
  questionSetId: string
  questionSetName: string | null
  createdBy: string
  createdAt: string
  responseCount: number
}

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState<EvaluationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/evaluations')
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Kunde inte läsa utvärderingar.')
        setEvaluations(payload?.evaluations || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Nätverksfel.')
        setLoading(false)
      })
  }, [])

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={titleStyle}>Utvärdering</h1>
          <p style={leadStyle}>
            Skapa QR-baserade utvärderingar för utbildningar och följ inkomna svar per tillfälle.
          </p>
        </div>
        <Link href="/dashboard/evaluations/new" style={primaryLinkStyle}>
          Skapa utvärdering
        </Link>
      </div>

      <EvaluationSubnav active="overview" />

      {error && <InlineError text={error} />}

      {evaluations.length === 0 ? (
        <EmptyCard
          title="Inga utvärderingar ännu"
          text="Skapa en utvärdering för ett utbildningstillfälle, generera QR-koden och börja samla in svar."
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {evaluations.map(evaluation => (
            <div key={evaluation.id} style={cardStyle}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      {evaluation.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
                      {evaluation.customer} · {evaluation.questionSetName || 'Frågebatteri'}
                    </div>
                  </div>
                  <Link href={`/dashboard/evaluations/${evaluation.id}`} style={secondaryLinkStyle}>
                    Öppna
                  </Link>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <MetaPill label="Svar" value={`${evaluation.responseCount}`} tone="ok" />
                  <MetaPill label="Skapad" value={formatDate(evaluation.createdAt)} />
                </div>
              </div>
            </div>
          ))}
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

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '-0.02em',
  lineHeight: 1,
  margin: 0,
}

const leadStyle: React.CSSProperties = {
  fontSize: 13.5,
  color: 'var(--text-3)',
  marginTop: 6,
  maxWidth: 700,
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '11px 18px',
  borderRadius: 10,
  background: 'var(--text)',
  color: '#fff',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}

const secondaryLinkStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  fontWeight: 700,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: '20px 22px',
  boxShadow: '0 12px 32px rgba(16,24,40,0.04)',
}

function MetaPill({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'muted' | 'ok' }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 999,
      border: '1px solid var(--border)',
      background: tone === 'ok' ? '#f0fdf4' : 'rgba(14,14,12,0.03)',
      fontSize: 12.5,
      color: tone === 'ok' ? '#166534' : 'var(--text-2)',
      fontWeight: 600,
    }}>
      {label}: {value}
    </div>
  )
}
