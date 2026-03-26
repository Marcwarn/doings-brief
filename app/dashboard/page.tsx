'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession, type QuestionSet } from '@/lib/supabase'

export default function DashboardPage() {
  const sb = createClient()
  const [sessions, setSessions]         = useState<BriefSession[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(6),
      sb.from('question_sets').select('*').order('created_at', { ascending: false }).limit(6),
    ]).then(([{ data: sess }, { data: qs }]) => {
      setSessions(sess || [])
      setQuestionSets(qs || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <Loader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 900, animation: 'fadeUp 0.35s ease both' }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          Översikt
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>
          Doings Brief — hantera och skicka kundintervjuer
        </p>
      </div>

      {/* Action row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
        <Link href="/dashboard/send" style={{
          display: 'block', padding: '20px 22px', borderRadius: 10,
          background: 'var(--accent)', textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(198,35,104,0.20)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 28px rgba(198,35,104,0.28)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 20px rgba(198,35,104,0.20)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>
            Skicka ny brief
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
            Välj frågebatteri och klientmail
          </div>
        </Link>

        <Link href="/dashboard/question-sets/new" style={{
          display: 'block', padding: '20px 22px', borderRadius: 10,
          background: 'var(--surface)', textDecoration: 'none',
          border: '1px solid var(--border)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent)'; el.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = '' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.01em' }}>
            Nytt frågebatteri
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
            Skapa och spara frågor
          </div>
        </Link>
      </div>

      {/* Two-col feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent briefs */}
        <Panel title="Senaste briefs" href="/dashboard/briefs" linkText="Visa alla">
          {sessions.length === 0
            ? <Empty text="Inga briefs skickade ännu" />
            : sessions.slice(0, 5).map(s => (
              <Link key={s.id} href={`/dashboard/briefs/${s.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-sub)', textDecoration: 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.client_name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{s.client_email}</div>
                </div>
                <Pill ok={s.status === 'submitted'} />
              </Link>
            ))}
        </Panel>

        {/* Question sets */}
        <Panel title="Frågebatterier" href="/dashboard/question-sets" linkText="Hantera">
          {questionSets.length === 0
            ? <Empty text="Inga frågebatterier skapade ännu" />
            : questionSets.slice(0, 5).map(qs => (
              <Link key={qs.id} href={`/dashboard/question-sets/${qs.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-sub)', textDecoration: 'none' }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{qs.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0, marginLeft: 12 }}>
                  {new Date(qs.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </div>
              </Link>
            ))}
        </Panel>
      </div>
    </div>
  )
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
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '18px 0', fontStyle: 'italic' }}>{text}</p>
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
