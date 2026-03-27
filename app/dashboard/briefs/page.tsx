'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient, type BriefSession } from '@/lib/supabase'
import { groupBriefSessions, type BriefBatchLookupMap } from '@/lib/brief-batches'

export default function BriefsPage() {
  const sb = createClient()
  const router = useRouter()
  const [sessions, setSessions]     = useState<BriefSession[]>([])
  const [batchLookup, setBatchLookup] = useState<BriefBatchLookupMap>({})
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const groups = useMemo(() => groupBriefSessions(sessions, batchLookup), [sessions, batchLookup])

  async function load() {
    setLoading(true)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await sb.from('brief_sessions').select('*').order('created_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      setBatchLookup({})
      return
    }

    fetch('/api/briefs/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: sessions.map(session => session.id) }),
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error('Kunde inte läsa batchmetadata')
        }

        const payload = await response.json()
        setBatchLookup(payload.batchLookup || {})
      })
      .catch(error => {
        console.error(error)
        setBatchLookup({})
      })
  }, [sessions])

  async function deleteSession(id: string) {
    setPageError(null)
    setDeleting(id)
    const response = await fetch('/api/briefs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: [id] }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setPageError(`Kunde inte radera: ${payload?.error || 'Okänt fel.'}`)
      setDeleting(null); setConfirming(null); return
    }
    setSessions(prev => prev.filter(s => s.id !== id))
    setConfirming(null); setDeleting(null)
    router.refresh()
  }

  async function deleteGroup(groupKey: string, sessionIds: string[]) {
    setPageError(null)
    setDeletingGroup(groupKey)
    const response = await fetch('/api/briefs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setPageError(`Kunde inte radera utskicket: ${payload?.error || 'Okänt fel.'}`)
      setDeletingGroup(null)
      setConfirmingGroup(null)
      return
    }

    const deletedIds = new Set<string>(payload?.deletedSessionIds || sessionIds)
    setSessions(prev => prev.filter(session => !deletedIds.has(session.id)))
    setExpandedGroups(prev => prev.filter(key => key !== groupKey))
    setConfirmingGroup(null)
    setDeletingGroup(null)
    router.refresh()
  }

  async function deleteSelectedGroups() {
    setPageError(null)
    const selectedSessionIds = groups
      .filter(group => selectedGroups.includes(group.key))
      .flatMap(group => group.sessions.map(session => session.id))

    if (selectedSessionIds.length === 0) return

    setBulkDeleting(true)
    const response = await fetch('/api/briefs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: selectedSessionIds }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setPageError(`Kunde inte radera valda utskick: ${payload?.error || 'Okänt fel.'}`)
      setBulkDeleting(false)
      return
    }

    const deletedIds = new Set<string>(payload?.deletedSessionIds || selectedSessionIds)
    setSessions(prev => prev.filter(session => !deletedIds.has(session.id)))
    setExpandedGroups(prev => prev.filter(key => !selectedGroups.includes(key)))
    setSelectedGroups([])
    setConfirmingBulkDelete(false)
    setBulkDeleting(false)
    router.refresh()
  }

  function briefUrl(token: string) { return `${window.location.origin}/brief/${token}` }
  function toggleGroup(groupKey: string) {
    setExpandedGroups(prev => prev.includes(groupKey) ? prev.filter(key => key !== groupKey) : [...prev, groupKey])
  }
  function toggleGroupSelection(groupKey: string) {
    setSelectedGroups(prev => prev.includes(groupKey) ? prev.filter(key => key !== groupKey) : [...prev, groupKey])
  }
  function toggleSelectAllGroups() {
    setSelectedGroups(prev => prev.length === groups.length ? [] : groups.map(group => group.key))
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 880, animation: 'fadeUp 0.35s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            Utskick
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>
            Följ vem som har fått, svarat eller fortfarande väntar
          </p>
        </div>
        <Link href="/dashboard/send" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 8,
          background: 'var(--surface)', color: 'var(--text)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.01em', textDecoration: 'none',
          transition: 'border-color 0.15s, background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--accent)'
          el.style.background = 'var(--accent-dim)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--border)'
          el.style.background = 'var(--surface)'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Skicka ny
        </Link>
      </div>

      {pageError && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(185, 28, 28, 0.18)',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: 13,
        }}>
          {pageError}
        </div>
      )}

      {groups.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={groups.length > 0 && selectedGroups.length === groups.length}
                onChange={toggleSelectAllGroups}
              />
              Välj alla utskick
            </label>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {selectedGroups.length === 0 ? 'Inga valda' : `${selectedGroups.length} valda`}
            </span>
          </div>
          {selectedGroups.length > 0 && (
            confirmingBulkDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Radera valda utskick?</span>
                <button onClick={() => void deleteSelectedGroups()} disabled={bulkDeleting} style={confirmButtonStyle(bulkDeleting)}>
                  {bulkDeleting ? 'Raderar…' : 'Ja'}
                </button>
                <button onClick={() => setConfirmingBulkDelete(false)} disabled={bulkDeleting} style={cancelButtonStyle}>
                  Avbryt
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmingBulkDelete(true)} style={bulkDeleteButtonStyle}>
                Radera valda
              </button>
            )
          )}
        </div>
      )}

      {sessions.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '64px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '0 0 16px', fontStyle: 'italic' }}>
            Inga utskick skickade ännu.
          </p>
          <Link href="/dashboard/send" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
            Skapa ditt första utskick →
          </Link>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 140px 150px 220px',
            padding: '9px 22px', background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['', 'Företag', 'Respondenter', 'Senast skickad', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.01em' }}>{h}</span>
            ))}
          </div>

          {groups.map(group => {
            const isExpanded = expandedGroups.includes(group.key)
            const dispatchId = batchLookup[group.sessions[0]?.id || '']?.dispatchId || null

            return (
              <div key={group.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 140px 150px 220px',
                    alignItems: 'center',
                    padding: '14px 22px',
                    background: 'var(--surface)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.key)}
                      onChange={() => toggleGroupSelection(group.key)}
                      aria-label={`Välj utskick ${group.label}`}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <button
                      onClick={() => toggleGroup(group.key)}
                      aria-label={isExpanded ? 'Dölj personer' : 'Visa personer'}
                      style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      {isExpanded ? '−' : '+'}
                    </button>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--accent), #6b2d82)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>
                      {group.label.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.sublabel}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{group.sessions.length} totalt</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <CountPill label="Svarade" value={group.submittedCount} tone="ok" />
                      <CountPill label="Väntar" value={group.pendingCount} tone="muted" />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(group.lastSentAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    {dispatchId && (
                      <Link
                        href={`/dashboard/dispatches/${dispatchId}`}
                        style={{
                          padding: '6px 13px', borderRadius: 6,
                          background: 'var(--surface)', color: 'var(--text)',
                          border: '1px solid var(--border)',
                          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                          letterSpacing: '0.01em', textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        Öppna utskick
                      </Link>
                    )}
                    {confirmingGroup === group.key ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Radera hela utskicket?</span>
                        <button onClick={() => deleteGroup(group.key, group.sessions.map(session => session.id))} disabled={deletingGroup === group.key} style={{
                          padding: '5px 10px', borderRadius: 6, border: 'none',
                          background: 'var(--text)', color: 'var(--bg)',
                          fontSize: 12, fontWeight: 600, cursor: deletingGroup === group.key ? 'not-allowed' : 'pointer',
                          opacity: deletingGroup === group.key ? 0.5 : 1,
                        }}>
                          {deletingGroup === group.key ? '…' : 'Ja'}
                        </button>
                        <button onClick={() => setConfirmingGroup(null)} style={{
                          padding: '5px 10px', borderRadius: 6,
                          border: '1px solid var(--border)', background: 'none',
                          fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                        }}>
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleGroup(group.key)}
                          style={{
                            padding: '6px 13px', borderRadius: 6,
                            background: 'var(--surface)', color: 'var(--text)',
                            border: '1px solid var(--border)',
                            fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                            letterSpacing: '0.01em', cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          {isExpanded ? 'Dölj personer' : 'Visa personer'}
                        </button>
                        <button
                          onClick={() => setConfirmingGroup(group.key)}
                          style={{
                            padding: '6px 10px', borderRadius: 6,
                            background: 'none', border: '1px solid transparent',
                            fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                            transition: 'border-color 0.1s, color 0.1s', flexShrink: 0,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
                        >
                          Radera utskick
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: 'var(--bg)', padding: '8px 14px 14px', borderTop: '1px solid var(--border-sub)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.sessions.map(session => (
                        <div
                          key={session.id}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr auto',
                            gap: 12, alignItems: 'center',
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{session.client_name}</span>
                              <Pill ok={session.status === 'submitted'} />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{session.client_email}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                              Skickad {new Date(session.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {session.status === 'submitted' && (
                              <Link href={`/dashboard/briefs/${session.id}`} style={{
                                padding: '6px 13px', borderRadius: 6,
                                background: 'var(--surface)', color: 'var(--text)',
                                border: '1px solid var(--border)',
                                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                                letterSpacing: '0.01em', textDecoration: 'none', flexShrink: 0,
                              }}>
                                Se svar
                              </Link>
                            )}
                            <button onClick={() => navigator.clipboard.writeText(briefUrl(session.token))} title="Kopiera länk" style={{
                              padding: '6px 10px', borderRadius: 6,
                              border: '1px solid var(--border)', background: 'var(--surface)',
                              fontSize: 12, fontWeight: 500, color: 'var(--text-2)',
                              cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              transition: 'border-color 0.15s', flexShrink: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                              Kopiera länk
                            </button>
                            {confirming === session.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Radera?</span>
                                <button onClick={() => deleteSession(session.id)} disabled={deleting === session.id} style={{
                                  padding: '5px 10px', borderRadius: 6, border: 'none',
                                  background: 'var(--text)', color: 'var(--bg)',
                                  fontSize: 12, fontWeight: 600, cursor: deleting === session.id ? 'not-allowed' : 'pointer',
                                  opacity: deleting === session.id ? 0.5 : 1,
                                }}>
                                  {deleting === session.id ? '…' : 'Ja'}
                                </button>
                                <button onClick={() => setConfirming(null)} style={{
                                  padding: '5px 10px', borderRadius: 6,
                                  border: '1px solid var(--border)', background: 'none',
                                  fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                                }}>
                                  Avbryt
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirming(session.id)} style={{
                                padding: '6px 10px', borderRadius: 6,
                                background: 'none', border: '1px solid transparent',
                                fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                                transition: 'border-color 0.1s, color 0.1s', flexShrink: 0,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}>
                                Radera
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'muted' }) {
  return (
    <span style={{
      fontSize: 10.5,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 999,
      letterSpacing: '0.01em',
      background: tone === 'ok' ? '#f0fdf4' : '#f5f5f4',
      color: tone === 'ok' ? '#16a34a' : '#78716c',
      flexShrink: 0,
    }}>
      {label}: {value}
    </span>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.01em',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#a8a29e',
      flexShrink: 0,
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
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

const bulkDeleteButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'none',
  color: 'var(--text)',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'none',
  fontSize: 12,
  color: 'var(--text-3)',
  cursor: 'pointer',
}

function confirmButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--text)',
    color: 'var(--bg)',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
