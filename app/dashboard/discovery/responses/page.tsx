'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EmptyCard, InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'

type DiscoverySessionListItem = {
  id: string
  templateId: string
  templateName: string
  clientName: string
  clientEmail: string
  clientOrganisation: string | null
  status: 'pending' | 'submitted'
  createdAt: string
  submittedAt: string | null
}

export default function DiscoveryResponsesPage() {
  const [sessions, setSessions] = useState<DiscoverySessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/discovery/sessions')
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Kunde inte läsa discovery-utskicken.')
        setSessions(payload?.sessions || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Nätverksfel.')
        setLoading(false)
      })
  }, [])

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1020, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={titleStyle}>Discovery-svar</h1>
          <p style={leadStyle}>
            Följ utskickade discovery-länkar, se svarsläge och öppna inkomna svar per mottagare.
          </p>
        </div>
        <Link href="/dashboard/discovery" style={primaryLinkStyle}>
          Till buildern
        </Link>
      </div>

      {error && <InlineError text={error} />}

      {sessions.length === 0 ? (
        <EmptyCard
          title="Inga discovery-utskick ännu"
          text="Skicka ett discovery-upplägg från buildern för att börja samla in svar."
        />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={tableHeaderStyle}>
            {['Mottagare', 'Organisation', 'Upplägg', 'Status', 'Skickad', ''].map(header => (
              <span key={header} style={tableHeaderCellStyle}>{header}</span>
            ))}
          </div>
          {sessions.map(session => (
            <div key={session.id} style={tableRowStyle}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{session.clientName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{session.clientEmail}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{session.clientOrganisation || 'Ej angiven'}</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{session.templateName}</div>
              <div>
                <StatusPill status={session.status} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{formatDate(session.createdAt)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link href={`/dashboard/discovery/responses/${session.id}`} style={secondaryLinkStyle}>
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

function StatusPill({ status }: { status: 'pending' | 'submitted' }) {
  const ok = status === 'submitted'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 9px',
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 700,
      background: ok ? '#f0fdf4' : '#fff7ed',
      color: ok ? '#166534' : '#9a3412',
      border: ok ? '1px solid #bbf7d0' : '1px solid #fed7aa',
    }}>
      {ok ? 'Besvarad' : 'Väntar'}
    </span>
  )
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
  gridTemplateColumns: '1.2fr 1fr 1fr 110px 140px 120px',
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
  gridTemplateColumns: '1.2fr 1fr 1fr 110px 140px 120px',
  alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border-sub)',
}
