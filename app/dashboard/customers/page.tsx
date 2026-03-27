'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession } from '@/lib/supabase'
import {
  groupBriefSessions,
  groupCustomers,
  type BriefBatchLookupMap,
} from '@/lib/brief-batches'

export default function CustomersPage() {
  const sb = createClient()
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [batchLookup, setBatchLookup] = useState<BriefBatchLookupMap>({})
  const [loading, setLoading] = useState(true)

  const dispatchGroups = useMemo(() => groupBriefSessions(sessions, batchLookup), [sessions, batchLookup])
  const customers = useMemo(() => groupCustomers(dispatchGroups, batchLookup), [dispatchGroups, batchLookup])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const query = sb.from('brief_sessions').select('*').order('created_at', { ascending: false })
      const { data } = profile?.role === 'admin'
        ? await query
        : await query.eq('consultant_id', user.id)

      setSessions(data || [])
      setLoading(false)
    }

    load()
  }, [])

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
        if (!response.ok) throw new Error('Kunde inte läsa utskick')
        const payload = await response.json()
        setBatchLookup(payload.batchLookup || {})
      })
      .catch(() => setBatchLookup({}))
  }, [sessions])

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 940, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 30 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            Kunder
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>
            Här börjar arbetet. Välj kund, fundera igenom frågorna och skicka sedan ditt utskick.
          </p>
        </div>
        <Link href="/dashboard/send" style={primaryLinkStyle}>
          Nytt utskick
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, marginBottom: 22 }}>
        <InfoCard title="Arbetsordning">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Börja med kunddialogen och vilket företag arbetet gäller.',
              'Välj eller skapa frågebatteriet som behövs för att komma vidare.',
              'Bestäm vilka personer som ska svara och skicka utskicket.',
              'Följ vem som har svarat och gå sedan ner i enskilda svar.',
            ].map(item => (
              <li key={item} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{item}</li>
            ))}
          </ol>
        </InfoCard>
        <InfoCard title="Snabbval">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/dashboard/question-sets" style={quickLinkStyle}>Se frågebatterier</Link>
            <Link href="/dashboard/send" style={quickLinkStyle}>Skapa nytt utskick</Link>
            <Link href="/dashboard/briefs" style={quickLinkStyle}>Följ utskick och svar</Link>
          </div>
        </InfoCard>
      </div>

      {customers.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '60px 28px', border: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)' }}>
            Inga kunder eller utskick ännu. Börja med att välja frågor och skicka första utskicket.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 160px 220px',
            padding: '9px 18px',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Kund', 'Utskick', 'Status', ''].map(header => (
              <span key={header} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.01em' }}>
                {header}
              </span>
            ))}
          </div>

          {customers.map(customer => (
            <div
              key={customer.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 160px 220px',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border-sub)',
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{customer.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  Senaste aktivitet {formatDate(customer.lastSentAt)}
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{customer.dispatchCount}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                {customer.submittedCount} svarade · {customer.pendingCount} väntar
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/dashboard/send?organisation=${encodeURIComponent(customer.label)}`} style={ghostLinkStyle}>
                  Nytt utskick
                </Link>
                {customer.latestDispatchId ? (
                  <Link href={`/dashboard/dispatches/${customer.latestDispatchId}`} style={filledLinkStyle}>
                    Se senaste utskick
                  </Link>
                ) : (
                  <Link href="/dashboard/briefs" style={filledLinkStyle}>
                    Se utskick
                  </Link>
                )}
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

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '10px 18px',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.01em',
  textDecoration: 'none',
}

const quickLinkStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontSize: 13.5,
}

const ghostLinkStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 500,
}

const filledLinkStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.01em',
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
