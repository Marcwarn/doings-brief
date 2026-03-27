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
    <div style={{ padding: '40px 44px', maxWidth: 980, animation: 'fadeUp 0.35s ease both' }}>
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
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={tableHeaderStyle}>
            {['Tillfälle', 'Kund', 'Svar', 'Skapad', ''].map(header => (
              <span key={header} style={tableHeaderCellStyle}>{header}</span>
            ))}
          </div>
          {evaluations.map(evaluation => (
            <div key={evaluation.id} style={tableRowStyle}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{evaluation.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  {evaluation.questionSetName || 'Frågebatteri'}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{evaluation.customer}</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{evaluation.responseCount}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{formatDate(evaluation.createdAt)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link href={`/dashboard/evaluations/${evaluation.id}`} style={secondaryLinkStyle}>
                  Öppna
                </Link>
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
  padding: '10px 18px',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}

const secondaryLinkStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  fontWeight: 700,
}

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 80px 140px 120px',
  padding: '9px 18px',
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
}

const tableHeaderCellStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-3)',
  letterSpacing: '0.01em',
}

const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 80px 140px 120px',
  alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border-sub)',
}
