'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient, type BriefSession } from '@/lib/supabase'

type BriefDispatch = {
  dispatchId: string
  label: string
  organisation: string | null
  consultantId: string | null
  questionSetId: string | null
  sessionIds: string[]
  createdAt: string
}

type DispatchPayload = {
  dispatch: BriefDispatch
  sessions: BriefSession[]
}

export default function DispatchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sb = createClient()

  const [payload, setPayload] = useState<DispatchPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        </div>
      </div>

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
