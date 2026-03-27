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

  const dispatchGroups = useMemo(() => groupBriefSessions(sessions, batchLookup), [sessions, batchLookup])
  const customers = useMemo(() => groupCustomers(dispatchGroups, batchLookup), [dispatchGroups, batchLookup])
  const activeDispatches = dispatchGroups.filter(group => group.pendingCount > 0).slice(0, 4)

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

  if (loading) return <Loader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 980, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            Brief
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, maxWidth: 720 }}>
            Samla kund, frågor, mottagare och utskick i ett flöde.
          </p>
        </div>
        <Link href="/dashboard/send" style={primaryLinkStyle}>
          Nytt utskick
        </Link>
      </div>

      <BriefSubnav active="overview" />

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, marginBottom: 30 }}>
        <Panel title="Vad är en brief?" href="/dashboard/send" linkText="Skapa utskick">
          <div style={{ padding: '18px 0 2px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
              En brief är ett enkelt sätt att samla in rätt svar från kunden innan arbetet börjar.
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
              Du väljer frågor, skickar dem till en eller flera personer och följer sedan vilka som har svarat.
            </p>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
              När svaren kommit in kan du läsa varje svar, jämföra perspektiv och använda underlaget i nästa steg med kunden.
            </p>
          </div>
        </Panel>

        <Panel title="Så arbetar du" href="/dashboard/customers" linkText="Öppna kunder">
          <div style={{ padding: '18px 0 2px' }}>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Skapa en kund du vill skicka frågor till.',
                'Välj eller skapa frågorna du behöver svar på.',
                'Bestäm vem eller vilka som ska svara.',
                'Skicka utskicket och följ svarsläget.',
                'Öppna svaren när de kommit in.',
              ].map(item => (
                <li key={item} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{item}</li>
              ))}
            </ol>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 30 }}>
        <StepCard
          step="1"
          title="Kunddialog"
          text="Utgå från företaget du pratar med och se tidigare utskick."
          href="/dashboard/customers"
          linkText="Öppna kunder"
        />
        <StepCard
          step="2"
          title="Frågor"
          text="Välj eller skapa frågebatteriet som behövs inför utskicket."
          href="/dashboard/question-sets"
          linkText="Se frågebatterier"
        />
        <StepCard
          step="3"
          title="Mottagare"
          text="Bestäm vilka personer som ska svara från företaget."
          href="/dashboard/send"
          linkText="Nytt utskick"
        />
        <StepCard
          step="4"
          title="Skicka"
          text="Skicka ut länkar och följ vilka som fortfarande väntar."
          href="/dashboard/briefs"
          linkText="Följ utskick"
        />
        <StepCard
          step="5"
          title="Svaren"
          text="Gå från utskicket till de enskilda svaren när det behövs."
          href="/dashboard/briefs"
          linkText="Se svar"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20 }}>
        <Panel title="Kunder att jobba vidare med" href="/dashboard/customers" linkText="Alla kunder">
          {customers.length === 0
            ? <BriefEmptyCard title="Inga kunder ännu" text="Skapa en kund genom att börja med ett nytt utskick." />
            : customers.slice(0, 5).map(customer => (
              <div key={customer.key} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{customer.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                    {customer.dispatchCount} utskick · {customer.submittedCount} svarade · {customer.pendingCount} väntar
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Link href={`/dashboard/send?organisation=${encodeURIComponent(customer.label)}`} style={smallGhostLink}>
                    Nytt utskick
                  </Link>
                  <Link href={`/dashboard/customers/${encodeURIComponent(customer.label.trim().toLowerCase())}`} style={smallGhostLink}>
                    Kund
                  </Link>
                  <Link href={customer.latestDispatchId ? `/dashboard/dispatches/${customer.latestDispatchId}` : '/dashboard/briefs'} style={smallLink}>
                    Se senaste
                  </Link>
                </div>
              </div>
            ))}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel title="Behöver uppmärksamhet" href="/dashboard/briefs" linkText="Alla utskick">
            {activeDispatches.length === 0
              ? <BriefEmptyCard title="Inga pågående utskick" text="Det finns inga aktiva utskick som väntar på svar just nu." />
              : activeDispatches.map(group => (
                <Link
                  key={group.key}
                  href={batchLookup[group.sessions[0]?.id || '']?.dispatchId ? `/dashboard/dispatches/${batchLookup[group.sessions[0]?.id || '']?.dispatchId}` : '/dashboard/briefs'}
                  style={{ ...rowStyle, textDecoration: 'none' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{group.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      {group.pendingCount} väntar · senaste utskick {formatDate(group.lastSentAt)}
                    </div>
                  </div>
                  <Pill ok={group.pendingCount === 0} />
                </Link>
              ))}
          </Panel>

          <Panel title="Frågebatterier att använda" href="/dashboard/question-sets" linkText="Hantera">
            {questionSets.length === 0
              ? <BriefEmptyCard title="Inga frågebatterier ännu" text="Skapa ditt första frågebatteri för att komma igång med briefs." />
              : questionSets.slice(0, 4).map(qs => (
                <Link key={qs.id} href={`/dashboard/send?set=${qs.id}`} style={{ ...rowStyle, textDecoration: 'none' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{qs.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Uppdaterad {formatDate(qs.updated_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>Använd</span>
                </Link>
              ))}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function StepCard({
  step,
  title,
  text,
  href,
  linkText,
}: {
  step: string
  title: string
  text: string
  href: string
  linkText: string
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '18px 16px', minHeight: 178 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
        {step}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55, minHeight: 58 }}>
        {text}
      </div>
      <Link href={href} style={{ display: 'inline-block', marginTop: 14, fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
        {linkText} →
      </Link>
    </div>
  )
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

function Panel({ title, href, linkText, children }: { title: string; href: string; linkText: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid var(--border-sub)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.01em' }}>{title}</span>
        <Link href={href} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{linkText} →</Link>
      </div>
      <div style={{ padding: '0 18px 6px' }}>{children}</div>
    </div>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.01em',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#a8a29e',
      flexShrink: 0, marginLeft: 10,
    }}>
      {ok ? 'Klart' : 'Pågår'}
    </span>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid var(--border-sub)',
}

const smallLink: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
}

const smallGhostLink: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  fontSize: 12,
  textDecoration: 'none',
}

function Loader() {
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
