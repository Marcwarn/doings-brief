'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient, type BriefSession } from '@/lib/supabase'
import {
  groupBriefSessions,
  groupCustomers,
  type BriefBatchLookupMap,
  type BriefDispatchContact,
  type CustomerSummary,
} from '@/lib/brief-batches'

export default function CustomerDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const sb = createClient()
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [batchLookup, setBatchLookup] = useState<BriefBatchLookupMap>({})
  const [loading, setLoading] = useState(true)
  const [lookupLoading, setLookupLoading] = useState(true)

  const dispatchGroups = useMemo(() => groupBriefSessions(sessions, batchLookup), [sessions, batchLookup])
  const customers = useMemo(() => groupCustomers(dispatchGroups, batchLookup), [dispatchGroups, batchLookup])
  const customer = useMemo(() => {
    const normalizedSlug = decodeURIComponent(slug || '').trim().toLowerCase()
    return customers.find(item => slugify(item.label) === normalizedSlug) || null
  }, [customers, slug])
  const customerDispatches = useMemo(() => {
    if (!customer) return []
    return dispatchGroups.filter(group => group.label === customer.label)
  }, [customer, dispatchGroups])
  const customerContacts = useMemo(() => dedupeContacts(customer?.contacts || []), [customer])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await sb.from('brief_sessions').select('*').order('created_at', { ascending: false })

      setSessions(data || [])
      setLoading(false)
    }

    load()
  }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      setBatchLookup({})
      setLookupLoading(false)
      return
    }

    setLookupLoading(true)

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
      .finally(() => setLookupLoading(false))
  }, [sessions])

  if (loading || lookupLoading) return <PageLoader />

  if (!customer) {
    return (
      <div style={{ padding: '40px 44px', maxWidth: 940 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/customers" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 12.5 }}>
            Tillbaka till kunder
          </Link>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '40px 28px' }}>
          <h1 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)' }}>
            Kunden hittades inte
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)' }}>
            Kunden kan ha bytt namn eller saknar utskick i den här miljön.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 980, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 26, fontSize: 12.5 }}>
        <Link href="/dashboard/customers" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Kunder</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{customer.label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            {customer.label}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 8 }}>
            Här samlas kundens kontaktpersoner, utskick och svarshistorik.
          </p>
        </div>
        <Link href={`/dashboard/send?organisation=${encodeURIComponent(customer.label)}`} style={primaryLinkStyle}>
          Nytt utskick
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Utskick" value={customer.dispatchCount} />
        <MetricCard label="Kontakter" value={customerContacts.length} />
        <MetricCard label="Svar" value={customer.submittedCount} />
        <MetricCard label="Väntar" value={customer.pendingCount} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 20, marginBottom: 20 }}>
        <SectionCard title="Kontaktpersoner">
          {customerContacts.length === 0 ? (
            <EmptyText text="Inga kontaktpersoner sparade ännu." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customerContacts.map(contact => (
                <div key={contact.sessionId} style={cardRowStyle}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{contact.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{contact.email}</div>
                  </div>
                  <span style={rolePillStyle}>
                    {contact.role || 'Roll ej satt'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Senaste aktivitet">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TimelineItem title="Senaste utskick" meta={formatDate(customer.lastSentAt)} />
            <TimelineItem title="Svarade hittills" meta={`${customer.submittedCount} av ${customer.recipientCount}`} />
            <TimelineItem title="Pågående utskick" meta={`${customer.pendingCount > 0 ? 'Ja' : 'Nej'}`} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Utskick för kunden">
        {customerDispatches.length === 0 ? (
          <EmptyText text="Inga utskick hittades för kunden." />
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px', padding: '9px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Utskick', 'Mottagare', 'Status', ''].map(header => (
                <span key={header} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.01em' }}>{header}</span>
              ))}
            </div>
            {customerDispatches.map(group => {
              const dispatchId = batchLookup[group.sessions[0]?.id || '']?.dispatchId || null
              return (
                <div key={group.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px', alignItems: 'center', padding: '14px 18px', background: 'var(--surface)', borderBottom: '1px solid var(--border-sub)' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{group.sublabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Skickad {formatDate(group.lastSentAt)}</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{group.sessions.length}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{group.submittedCount} svarade · {group.pendingCount} väntar</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {dispatchId ? (
                      <Link href={`/dashboard/dispatches/${dispatchId}`} style={filledLinkStyle}>Öppna utskick</Link>
                    ) : (
                      <Link href="/dashboard/briefs" style={filledLinkStyle}>Se utskick</Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function slugify(value: string) {
  return value.trim().toLowerCase()
}

function dedupeContacts(contacts: BriefDispatchContact[]) {
  const seen = new Map<string, BriefDispatchContact>()
  for (const contact of contacts) {
    const key = contact.email.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, contact)
    }
  }
  return Array.from(seen.values())
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function TimelineItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div style={cardRowStyle}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{meta}</div>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', fontStyle: 'italic' }}>{text}</p>
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

const rolePillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 999,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
}

const cardRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid var(--border-sub)',
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
