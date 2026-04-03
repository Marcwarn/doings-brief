'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LoopListItem = {
  id: string
  title: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  sentCount: number
  totalMessages: number
  recipientCount: number
  nextMessageOrderIndex: number | null
  created_at: string
}

export default function LoopsPage() {
  const [loops, setLoops] = useState<LoopListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<Record<string, string>>({})

  function load() {
    setLoading(true)
    fetch('/api/loops')
      .then(r => r.json())
      .then(payload => {
        if (payload.error) setError(payload.error)
        else setLoops(payload.loops || [])
        setLoading(false)
      })
      .catch(() => { setError('Kunde inte hämta loopar'); setLoading(false) })
  }

  useEffect(load, [])

  async function sendNext(loopId: string) {
    setSending(loopId)
    setSendResult(prev => ({ ...prev, [loopId]: '' }))
    try {
      const res = await fetch(`/api/loops/${loopId}/send-next`, { method: 'POST' })
      const payload = await res.json()
      if (payload.error) {
        setSendResult(prev => ({ ...prev, [loopId]: `Fel: ${payload.error}` }))
      } else {
        setSendResult(prev => ({
          ...prev,
          [loopId]: payload.loopCompleted
            ? 'Loop slutförd!'
            : `Skickat till ${payload.sent} mottagare`,
        }))
        load()
      }
    } catch {
      setSendResult(prev => ({ ...prev, [loopId]: 'Nätverksfel' }))
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Loopar
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-3)', maxWidth: 520 }}>
            Skicka uppföljningsmail i sekvens efter utbildningar och workshops. Välj nästa steg manuellt.
          </p>
        </div>
        <Link href="/dashboard/loopar/skapa" style={primaryLinkStyle}>
          Ny loop
        </Link>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loops.length === 0 ? (
        <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)', fontWeight: 600 }}>Inga loopar ännu</p>
          <p style={{ margin: '8px 0 20px', fontSize: 13, color: 'var(--text-3)' }}>
            Skapa en loop för att börja skicka uppföljningsmail till deltagare.
          </p>
          <Link href="/dashboard/loopar/skapa" style={primaryLinkStyle}>
            Skapa loop
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {loops.map(loop => (
            <div key={loop.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    {loop.title}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill status={loop.status} />
                    <span style={metaStyle}>{loop.sentCount}/{loop.totalMessages} skickade</span>
                    <span style={metaStyle}>{loop.recipientCount} mottagare</span>
                    <span style={metaStyle}>{formatDate(loop.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <Link href={`/dashboard/loopar/${loop.id}`} style={secondaryLinkStyle}>
                    Öppna
                  </Link>
                  {loop.status === 'active' && loop.nextMessageOrderIndex !== null && (
                    <button
                      onClick={() => sendNext(loop.id)}
                      disabled={sending === loop.id}
                      style={sendBtnStyle(sending === loop.id)}
                    >
                      {sending === loop.id ? 'Skickar…' : `Skicka steg ${loop.nextMessageOrderIndex + 1}`}
                    </button>
                  )}
                </div>
              </div>
              {sendResult[loop.id] && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: sendResult[loop.id].startsWith('Fel') ? '#fff0f0' : '#f0fdf4', border: `1px solid ${sendResult[loop.id].startsWith('Fel') ? '#fca5a5' : '#86efac'}`, borderRadius: 6, fontSize: 13, color: sendResult[loop.id].startsWith('Fel') ? '#b91c1c' : '#15803d' }}>
                  {sendResult[loop.id]}
                </div>
              )}
              {loop.totalMessages > 0 && (
                <div style={{ marginTop: 14 }}>
                  <ProgressBar sent={loop.sentCount} total={loop.totalMessages} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{pct}%</span>
    </div>
  )
}

function StatusPill({ status }: { status: LoopListItem['status'] }) {
  const map = {
    draft:     { label: 'Utkast',     bg: '#f3f4f6', color: '#6b7280' },
    active:    { label: 'Aktiv',      bg: '#f0fdf4', color: '#15803d' },
    paused:    { label: 'Pausad',     bg: '#fffbeb', color: '#92400e' },
    completed: { label: 'Slutförd',   bg: '#eff6ff', color: '#1d4ed8' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color, letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '20px 24px',
}

const metaStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-3)',
  background: 'var(--bg)',
  padding: '2px 8px',
  borderRadius: 6,
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '9px 18px',
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const secondaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '7px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

function sendBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '7px 14px',
    background: disabled ? 'var(--border)' : '#6b2d82',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
  }
}
