'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type LoopMessage = {
  id: string
  order_index: number
  subject: string
  body_text: string
  body_html: string
  status: 'draft' | 'approved' | 'sent'
  sent_at: string | null
}

type LoopRecipient = {
  id: string
  name: string
  email: string
}

type LoopSend = {
  id: string
  message_id: string
  recipient_id: string
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
}

type LoopDetail = {
  id: string
  title: string
  topic_description: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  created_at: string
  messages: LoopMessage[]
  recipients: LoopRecipient[]
  sends: LoopSend[]
}

type Tab = 'Översikt' | 'Meddelanden'

export default function LoopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loop, setLoop] = useState<LoopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Översikt')

  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch(`/api/loops/${id}`)
      .then(r => r.json())
      .then(payload => {
        if (payload.error) { setError(payload.error); setLoading(false); return }
        setLoop({ ...payload.loop, messages: payload.messages || [], recipients: payload.recipients || [], sends: payload.sends || [] })
        setLoading(false)
      })
      .catch(() => { setError('Kunde inte hämta loopen'); setLoading(false) })
  }

  useEffect(load, [id])

  async function sendNext() {
    if (!loop) return
    setSending(true)
    setSendResult('')
    try {
      const res = await fetch(`/api/loops/${id}/send-next`, { method: 'POST' })
      const payload = await res.json()
      if (payload.error) {
        setSendResult(`Fel: ${payload.error}`)
      } else {
        setSendResult(payload.loopCompleted ? 'Loop slutförd!' : `Skickat till ${payload.sent} mottagare`)
        load()
      }
    } catch {
      setSendResult('Nätverksfel')
    } finally {
      setSending(false)
    }
  }

  async function approveMessage(messageId: string) {
    await fetch(`/api/loops/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, status: 'approved' }),
    })
    load()
  }

  async function saveEdit(messageId: string) {
    setSaving(true)
    await fetch(`/api/loops/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, subject: editSubject, bodyText: editBody }),
    })
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function deleteLoop() {
    if (!confirm('Ta bort loopen och alla tillhörande meddelanden och mottagare?')) return
    await fetch(`/api/loops/${id}`, { method: 'DELETE' })
    router.push('/dashboard/loops')
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

  if (error || !loop) {
    return (
      <div style={{ padding: '40px 44px' }}>
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{error || 'Loopen hittades inte'}</p>
        <Link href="/dashboard/loops" style={{ fontSize: 13, color: 'var(--accent)' }}>← Tillbaka till loopar</Link>
      </div>
    )
  }

  const sentCount = loop.messages.filter(m => m.status === 'sent').length
  const totalMessages = loop.messages.length
  const nextMsg = loop.messages.find(m => m.status === 'approved' && !m.sent_at)
  const canSendNext = loop.status === 'active' && !!nextMsg

  return (
    <div style={{ padding: '40px 44px', maxWidth: 900, animation: 'fadeUp 0.35s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/dashboard/loops" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          ← Loopar
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {loop.title}
            </h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill status={loop.status} />
              <span style={metaStyle}>{sentCount}/{totalMessages} skickade</span>
              <span style={metaStyle}>{loop.recipients.length} mottagare</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canSendNext && (
              <button
                onClick={sendNext}
                disabled={sending}
                style={sendBtnStyle(sending)}
              >
                {sending ? 'Skickar…' : `Skicka steg ${(nextMsg?.order_index ?? 0) + 1}`}
              </button>
            )}
            <button onClick={deleteLoop} style={ghostBtnStyle}>
              Ta bort
            </button>
          </div>
        </div>
        {sendResult && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: sendResult.startsWith('Fel') ? '#fff0f0' : '#f0fdf4', border: `1px solid ${sendResult.startsWith('Fel') ? '#fca5a5' : '#86efac'}`, borderRadius: 6, fontSize: 13, color: sendResult.startsWith('Fel') ? '#b91c1c' : '#15803d' }}>
            {sendResult}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalMessages > 0 && (
        <div style={{ marginBottom: 24 }}>
          <ProgressBar sent={sentCount} total={totalMessages} />
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {(['Översikt', 'Meddelanden'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-3)',
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Översikt tab */}
      {activeTab === 'Översikt' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {loop.topic_description && (
            <div style={cardStyle}>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ämne</p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>{loop.topic_description}</p>
            </div>
          )}

          {/* Mottagare */}
          <div style={cardStyle}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mottagare ({loop.recipients.length})
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {loop.recipients.map(r => {
                const recipientSends = loop.sends.filter(s => s.recipient_id === r.id)
                const sentMessages = recipientSends.filter(s => s.status === 'sent').length
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{r.name}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{r.email}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sentMessages}/{totalMessages} skickade</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Meddelanden tab */}
      {activeTab === 'Meddelanden' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {loop.messages.map((msg, i) => {
            const isEditing = editingId === msg.id
            const sentSends = loop.sends.filter(s => s.message_id === msg.id && s.status === 'sent').length
            return (
              <div key={msg.id} style={{ ...cardStyle, opacity: msg.status === 'sent' ? 0.8 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>STEG {i + 1}</span>
                      <MessageStatusPill status={msg.status} />
                      {msg.sent_at && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {formatDate(msg.sent_at)} · {sentSends}/{loop.recipients.length} mottagare
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <input
                          value={editSubject}
                          onChange={e => setEditSubject(e.target.value)}
                          style={inputStyle}
                          placeholder="Ämnesrad"
                        />
                        <textarea
                          value={editBody}
                          onChange={e => setEditBody(e.target.value)}
                          rows={5}
                          style={{ ...inputStyle, resize: 'vertical' }}
                          placeholder="Brödtext"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => saveEdit(msg.id)} disabled={saving} style={primaryBtnSmall(saving)}>
                            {saving ? 'Sparar…' : 'Spara'}
                          </button>
                          <button onClick={() => setEditingId(null)} style={ghostBtnSmall}>
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{msg.subject}</p>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                          {msg.body_text?.slice(0, 200)}{(msg.body_text?.length || 0) > 200 ? '…' : ''}
                        </p>
                      </>
                    )}
                  </div>

                  {!isEditing && msg.status !== 'sent' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {msg.status === 'draft' && (
                        <button onClick={() => approveMessage(msg.id)} style={primaryBtnSmall(false)}>
                          Godkänn
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingId(msg.id)
                          setEditSubject(msg.subject)
                          setEditBody(msg.body_text || '')
                        }}
                        style={ghostBtnSmall}
                      >
                        Redigera
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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
      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{pct}% skickade</span>
    </div>
  )
}

function StatusPill({ status }: { status: LoopDetail['status'] }) {
  const map = {
    draft:     { label: 'Utkast',   bg: '#f3f4f6', color: '#6b7280' },
    active:    { label: 'Aktiv',    bg: '#f0fdf4', color: '#15803d' },
    paused:    { label: 'Pausad',   bg: '#fffbeb', color: '#92400e' },
    completed: { label: 'Slutförd', bg: '#eff6ff', color: '#1d4ed8' },
  }
  const s = map[status]
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color }}>{s.label}</span>
}

function MessageStatusPill({ status }: { status: LoopMessage['status'] }) {
  const map = {
    draft:    { label: 'Utkast',    bg: '#f3f4f6', color: '#6b7280' },
    approved: { label: 'Godkänt',   bg: '#fffbeb', color: '#92400e' },
    sent:     { label: 'Skickat',   bg: '#f0fdf4', color: '#15803d' },
  }
  const s = map[status]
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: s.bg, color: s.color, letterSpacing: '0.03em' }}>{s.label}</span>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 22px',
}

const metaStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-3)',
  background: 'var(--bg)',
  padding: '2px 8px',
  borderRadius: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function sendBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    background: disabled ? 'var(--border)' : '#6b2d82',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function primaryBtnSmall(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: disabled ? 'var(--border)' : 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const ghostBtnSmall: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}
