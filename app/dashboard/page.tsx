'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession, type QuestionSet } from '@/lib/supabase'
import { BriefEmptyCard, BriefSubnav } from '@/app/dashboard/brief/ui'
import {
  groupBriefSessions,
  groupCustomers,
  type BriefBatchLookupMap,
} from '@/lib/brief-batches'

export default function DashboardPage() {
  const sb = createClient()
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [batchLookup, setBatchLookup] = useState<BriefBatchLookupMap>({})
  const [loading, setLoading] = useState(true)
  const [remindedGroups, setRemindedGroups] = useState<Record<string, boolean>>({})
  const [remindLoading, setRemindLoading] = useState<string | null>(null)
  const [remindFeedback, setRemindFeedback] = useState<Record<string, string>>({})

  const dispatchGroups = useMemo(() => groupBriefSessions(sessions, batchLookup), [sessions, batchLookup])
  const customers = useMemo(() => groupCustomers(dispatchGroups, batchLookup), [dispatchGroups, batchLookup])
  const activeDispatches = dispatchGroups.filter(group => group.pendingCount > 0).slice(0, 4)
  const submittedCount = sessions.filter(session => session.status === 'submitted').length
  const pendingCount = sessions.filter(session => session.status === 'pending').length

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(40),
      sb.from('question_sets').select('*').order('updated_at', { ascending: false }).limit(6),
    ]).then(([{ data: sess }, { data: qs }]) => {
      setSessions(sess || [])
      setQuestionSets(qs || [])
      setLoading(false)
    })
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

  async function handleRemind(group: ReturnType<typeof groupBriefSessions>[number]) {
    const pendingSessions = group.sessions.filter(s => s.status === 'pending')
    if (pendingSessions.length === 0) return
    setRemindFeedback(prev => ({ ...prev, [group.key]: '' }))
    setRemindLoading(group.key)
    try {
      const res = await fetch('/api/briefs/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: pendingSessions.map(s => s.id) }),
      })
      const payload = await res.json().catch(() => null)
      const sent = typeof payload?.sent === 'number' ? payload.sent : 0
      const failed = typeof payload?.failed === 'number' ? payload.failed : Math.max(pendingSessions.length - sent, 0)

      if (res.ok && sent === pendingSessions.length) {
        setRemindedGroups(prev => ({ ...prev, [group.key]: true }))
        setRemindFeedback(prev => ({ ...prev, [group.key]: 'Påminnelse skickad.' }))
      } else if (sent > 0) {
        setRemindFeedback(prev => ({
          ...prev,
          [group.key]: `${sent} skickades, ${failed} misslyckades.`,
        }))
      } else {
        setRemindFeedback(prev => ({
          ...prev,
          [group.key]: payload?.error || 'Kunde inte skicka påminnelse.',
        }))
      }
    } finally {
      setRemindLoading(null)
    }
  }

  if (loading) return <Loader />

  return (
    <div style={pageShellStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
            Översikt
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.7, maxWidth: 700 }}>
            Följ aktiva utskick, se var svar saknas och håll ihop kunder, frågebatterier och nästa steg i samma arbetsyta.
          </p>
        </div>
        <Link href="/dashboard/send" style={primaryLinkStyle}>
          Nytt utskick
        </Link>
      </div>

      <BriefSubnav active="overview" />

      <div style={statsRowStyle}>
        <OverviewStatCard label="Utskicksgrupper" value={`${dispatchGroups.length}`} text="aktiva och historiska grupper i vyn" />
        <OverviewStatCard label="Väntar på svar" value={`${pendingCount}`} text="personer som ännu inte har svarat" />
        <OverviewStatCard label="Svar inkomna" value={`${submittedCount}`} text="briefs som redan är besvarade" />
        <OverviewStatCard label="Kunder" value={`${customers.length}`} text="organisationer med utskick eller historik" />
      </div>

      <div style={journeyGridStyle}>
        <JourneyCard
          title="Nytt utskick"
          text="Börja med kund, fråga och mottagare. Bygg briefen och se direkt hur den kommer att landa hos mottagaren."
          href="/dashboard/send"
          linkText="Öppna arbetsytan"
        />
        <JourneyCard
          title="Kunder"
          text="Fånga upp vilka kunder som redan har utskick, vilka som väntar och var det är naturligt att ta nästa steg."
          href="/dashboard/customers"
          linkText="Se kundläget"
        />
        <JourneyCard
          title="Frågebatterier"
          text="Utgå från befintliga frågor eller skapa nya batterier som passar den dialog du är i just nu."
          href="/dashboard/question-sets"
          linkText="Hantera frågor"
        />
      </div>

      <div style={contentGridStyle}>
        <SurfacePanel title="Behöver uppmärksamhet" subtitle="Det här är utskick där det fortfarande finns väntande svar." href="/dashboard/briefs" linkText="Alla utskick">
          {activeDispatches.length === 0 ? (
            <BriefEmptyCard title="Inga pågående utskick" text="Det finns inga aktiva utskick som väntar på svar just nu." />
          ) : (
            activeDispatches.map(group => {
              const reminded = !!remindedGroups[group.key]
              const isLoading = remindLoading === group.key
              const feedback = remindFeedback[group.key]
              const dispatchHref = batchLookup[group.sessions[0]?.id || '']?.dispatchId
                ? `/dashboard/dispatches/${batchLookup[group.sessions[0]?.id || '']?.dispatchId}`
                : '/dashboard/briefs'
              return (
                <div key={group.key} style={listCardStyle}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link href={dispatchHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{group.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.6 }}>
                        {group.pendingCount} väntar · senaste utskick {formatDate(group.lastSentAt)}
                      </div>
                    </Link>
                    {feedback && (
                      <div style={{ fontSize: 12, color: reminded ? '#15803d' : '#92400e', marginTop: 8 }}>
                        {feedback}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleRemind(group)}
                      disabled={reminded || isLoading}
                      style={{
                        ...secondaryActionStyle,
                        background: reminded ? '#f0fdf4' : 'rgba(255,255,255,0.88)',
                        color: reminded ? '#16a34a' : 'var(--text)',
                        cursor: reminded || isLoading ? 'default' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? '...' : reminded ? 'Skickat' : 'Påminn'}
                    </button>
                    <Pill ok={group.pendingCount === 0} />
                  </div>
                </div>
              )
            })
          )}
        </SurfacePanel>

        <SurfacePanel title="Kunder att jobba vidare med" subtitle="Utgå från kunden när du vill se nästa naturliga brief eller följa historiken." href="/dashboard/customers" linkText="Alla kunder">
          {customers.length === 0 ? (
            <BriefEmptyCard title="Inga kunder ännu" text="Skapa en kund genom att börja med ett nytt utskick." />
          ) : (
            customers.slice(0, 5).map(customer => (
              <div key={customer.key} style={listCardStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{customer.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.6 }}>
                    {customer.dispatchCount} utskick · {customer.submittedCount} svarade · {customer.pendingCount} väntar
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link href={`/dashboard/send?organisation=${encodeURIComponent(customer.label)}`} style={secondaryActionLinkStyle}>
                    Nytt utskick
                  </Link>
                  <Link href={`/dashboard/customers/${encodeURIComponent(customer.label.trim().toLowerCase())}`} style={secondaryActionLinkStyle}>
                    Kund
                  </Link>
                </div>
              </div>
            ))
          )}
        </SurfacePanel>

        <SurfacePanel title="Frågebatterier att använda" subtitle="Det senaste du kan utgå från när du skickar en ny brief." href="/dashboard/question-sets" linkText="Hantera">
          {questionSets.length === 0 ? (
            <BriefEmptyCard title="Inga frågebatterier ännu" text="Skapa ditt första frågebatteri för att komma igång med briefs." />
          ) : (
            questionSets.slice(0, 4).map(qs => (
              <div key={qs.id} style={listCardStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{qs.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
                    Uppdaterad {formatDate(qs.updated_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link href={`/dashboard/send?set=${qs.id}`} style={secondaryActionLinkStyle}>
                    Använd
                  </Link>
                  <Link href={`/dashboard/question-sets/${qs.id}`} style={secondaryActionLinkStyle}>
                    Redigera
                  </Link>
                </div>
              </div>
            ))
          )}
        </SurfacePanel>
      </div>
    </div>
  )
}

function JourneyCard({
  title,
  text,
  href,
  linkText,
}: {
  title: string
  text: string
  href: string
  linkText: string
}) {
  return (
    <div style={journeyCardStyle}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.72, marginBottom: 20 }}>
        {text}
      </div>
      <Link href={href} style={{ fontSize: 12.5, color: 'var(--text)', textDecoration: 'none', fontWeight: 700 }}>
        {linkText} →
      </Link>
    </div>
  )
}

function OverviewStatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div style={statCardStyle}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.02, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
        {text}
      </div>
    </div>
  )
}

function SurfacePanel({
  title,
  subtitle,
  href,
  linkText,
  children,
}: {
  title: string
  subtitle: string
  href: string
  linkText: string
  children: React.ReactNode
}) {
  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 620 }}>
            {subtitle}
          </div>
        </div>
        <Link href={href} style={{ fontSize: 12.5, color: 'var(--text)', textDecoration: 'none', fontWeight: 700 }}>
          {linkText} →
        </Link>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {children}
      </div>
    </section>
  )
}

function Loader() {
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

function Pill({ ok }: { ok: boolean }) {
  return (
    <div style={{
      padding: '5px 8px',
      borderRadius: 999,
      background: ok ? '#f0fdf4' : '#fff7ed',
      border: `1px solid ${ok ? '#bbf7d0' : '#fed7aa'}`,
      fontSize: 11.5,
      fontWeight: 700,
      color: ok ? '#15803d' : '#c2410c',
    }}>
      {ok ? 'Klart' : 'Aktivt'}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'okänt datum'
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
  })
}

const pageShellStyle: React.CSSProperties = {
  padding: '40px 44px',
  maxWidth: 1320,
  animation: 'fadeUp 0.35s ease both',
}

const statsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const journeyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.05fr 1.05fr 0.9fr',
  gap: 18,
  alignItems: 'start',
}

const statCardStyle: React.CSSProperties = {
  background: 'rgba(250,248,246,0.9)',
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  padding: '18px 18px 16px',
}

const journeyCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  padding: '22px 22px 20px',
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  padding: '22px',
}

const listCardStyle: React.CSSProperties = {
  background: 'rgba(250,248,246,0.82)',
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  padding: '16px 16px 15px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '12px 18px',
  borderRadius: 14,
  background: 'var(--text)',
  color: '#fff',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.01em',
  textDecoration: 'none',
  boxShadow: '0 10px 24px rgba(14,14,12,0.12)',
}

const secondaryActionStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 700,
}

const secondaryActionLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontSize: 12.5,
  fontWeight: 700,
}
