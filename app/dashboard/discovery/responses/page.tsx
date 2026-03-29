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
  const [remindedSessions, setRemindedSessions] = useState<Record<string, boolean>>({})
  const [remindLoading, setRemindLoading] = useState<string | null>(null)
  const [remindFeedback, setRemindFeedback] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/discovery/sessions')
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || 'Kunde inte läsa utskicken.')
        setSessions(payload?.sessions || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Nätverksfel.')
        setLoading(false)
      })
  }, [])

  async function handleRemind(session: DiscoverySessionListItem) {
    if (session.status !== 'pending') return
    setRemindFeedback(prev => ({ ...prev, [session.id]: '' }))
    setRemindLoading(session.id)

    try {
      const response = await fetch('/api/discovery/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: [session.id] }),
      })
      const payload = await response.json().catch(() => null)
      const sent = typeof payload?.sent === 'number' ? payload.sent : 0

      if (response.ok && sent === 1) {
        setRemindedSessions(prev => ({ ...prev, [session.id]: true }))
        setRemindFeedback(prev => ({ ...prev, [session.id]: 'Påminnelse skickad.' }))
      } else {
        setRemindFeedback(prev => ({
          ...prev,
          [session.id]: payload?.error || 'Kunde inte skicka påminnelse.',
        }))
      }
    } finally {
      setRemindLoading(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1020, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={titleStyle}>Inkomna svar</h1>
          <p style={leadStyle}>
            Följ utskicken, se svarsläge och öppna inkomna svar per mottagare.
          </p>
        </div>
        <Link href="/dashboard/discovery" style={primaryLinkStyle}>
          Till redigeringen
        </Link>
      </div>

      {error && <InlineError text={error} />}

      {sessions.length === 0 ? (
        <EmptyCard
          title="Inga utskick ännu"
          text="Skicka ett upplägg från redigeringen för att börja samla in svar."
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                {session.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void handleRemind(session)}
                    disabled={remindLoading === session.id || remindedSessions[session.id]}
                    style={remindButtonStyle(remindLoading === session.id || remindedSessions[session.id])}
                  >
                    {remindLoading === session.id ? '...' : remindedSessions[session.id] ? 'Skickat' : 'Påminn'}
                  </button>
                )}
                <Link href={`/dashboard/discovery/responses/${session.id}`} style={secondaryLinkStyle}>
                  Öppna
                </Link>
              </div>
              {remindFeedback[session.id] && (
                <div style={{ gridColumn: '1 / -1', paddingTop: 8, fontSize: 11.5, color: remindedSessions[session.id] ? '#15803d' : '#92400e' }}>
                  {remindFeedback[session.id]}
                </div>
              )}
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

function remindButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: disabled ? 'var(--bg)' : 'var(--surface)',
    color: disabled ? 'var(--text-3)' : 'var(--text-2)',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }
}
