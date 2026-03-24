'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession, type QuestionSet } from '@/lib/supabase'

const S: React.CSSProperties = { fontFamily: 'DM Sans, sans-serif' }

export default function DashboardPage() {
  const sb = createClient()
  const [sessions, setSessions]         = useState<BriefSession[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(6),
      sb.from('question_sets').select('*').order('created_at', { ascending: false }).limit(5),
    ]).then(([{ data: sess }, { data: qs }]) => {
      setSessions(sess || [])
      setQuestionSets(qs || [])
      setLoading(false)
    })
  }, [])

  const submitted = sessions.filter(s => s.status === 'submitted').length

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '36px 40px', maxWidth: 880, ...S }}>

      {/* Page title */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: 0 }}>Översikt</h1>
        <p style={{ fontSize: 13.5, color: '#9ca3af', margin: '4px 0 0' }}>Välkommen till Doings Brief</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Skickade briefs"  value={sessions.length}  />
        <StatCard label="Besvarade"        value={submitted}        color="#16a34a" />
        <StatCard label="Frågebatterier"   value={questionSets.length} />
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
        <ActionCard
          href="/dashboard/send"
          title="Skicka ny brief"
          desc="Välj frågebatteri och klientmail"
          icon={<ArrowUpRight />}
          primary
        />
        <ActionCard
          href="/dashboard/question-sets/new"
          title="Nytt frågebatteri"
          desc="Skapa och spara frågor"
          icon={<PlusIcon />}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent briefs */}
        <Card title="Senaste briefs" linkHref="/dashboard/briefs" linkLabel="Visa alla">
          {sessions.length === 0
            ? <Empty text="Inga briefs skickade ännu." />
            : sessions.slice(0, 5).map(s => (
              <Link key={s.id} href={`/dashboard/briefs/${s.id}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0', borderBottom: '1px solid #f4f4f4', textDecoration: 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{s.client_name}</div>
                  <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{s.client_email}</div>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))
          }
        </Card>

        {/* Question sets */}
        <Card title="Frågebatterier" linkHref="/dashboard/question-sets" linkLabel="Hantera">
          {questionSets.length === 0
            ? <Empty text="Inga frågebatterier ännu." />
            : questionSets.map(qs => (
              <Link key={qs.id} href={`/dashboard/question-sets/${qs.id}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0', borderBottom: '1px solid #f4f4f4', textDecoration: 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{qs.name}</div>
                <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
                  {new Date(qs.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </div>
              </Link>
            ))
          }
        </Card>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color = '#C62368' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function ActionCard({ href, title, desc, icon, primary }: {
  href: string; title: string; desc: string; icon: React.ReactNode; primary?: boolean
}) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: primary ? '#C62368' : '#fff',
      borderRadius: 12, padding: '18px 20px', textDecoration: 'none',
      boxShadow: primary
        ? '0 4px 14px rgba(198,35,104,0.25)'
        : '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: primary ? 'rgba(255,255,255,0.18)' : '#FFF0F4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: primary ? '#fff' : '#C62368',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: primary ? '#fff' : '#111' }}>{title}</div>
        <div style={{ fontSize: 12, marginTop: 2, color: primary ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>{desc}</div>
      </div>
    </Link>
  )
}

function Card({ title, children, linkHref, linkLabel }: {
  title: string; children: React.ReactNode; linkHref: string; linkLabel: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid #f4f4f4',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{title}</span>
        <Link href={linkHref} style={{ fontSize: 12, color: '#C62368', textDecoration: 'none' }}>{linkLabel} →</Link>
      </div>
      <div style={{ padding: '2px 18px 4px' }}>{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'submitted'
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20,
      background: ok ? '#dcfce7' : '#f3f4f6',
      color: ok ? '#15803d' : '#6b7280',
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: '#d1d5db', padding: '16px 0', margin: 0 }}>{text}</p>
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#C62368',
            animation: 'bounce 0.9s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// Icons
const ArrowUpRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
