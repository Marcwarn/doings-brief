'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession, type QuestionSet } from '@/lib/supabase'

export default function DashboardPage() {
  const sb = createClient()
  const [sessions, setSessions]       = useState<BriefSession[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(5),
      sb.from('question_sets').select('*').order('created_at', { ascending: false }).limit(5),
    ]).then(([{ data: sess }, { data: qs }]) => {
      setSessions(sess || [])
      setQuestionSets(qs || [])
      setLoading(false)
    })
  }, [])

  const submitted = sessions.filter(s => s.status === 'submitted').length

  if (loading) return <LoadingDots />

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8" style={{ color: '#1a1a1a', fontFamily: 'DM Sans, sans-serif' }}>
        Doings Brief
      </h1>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Skickade briefs" value={sessions.length} />
        <StatCard label="Besvarade" value={submitted} color="#16a34a" />
        <StatCard label="Frågebatterier" value={questionSets.length} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link href="/dashboard/send"
              className="rounded-2xl p-5 transition-all"
              style={{ background: '#fff', border: '1px solid #f0cdd8' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#C62368')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0cdd8')}>
          <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>Skicka ny brief</p>
          <p className="text-xs mt-1" style={{ color: '#a0607a' }}>Välj frågebatteri och klientmail</p>
        </Link>

        <Link href="/dashboard/question-sets/new"
              className="rounded-2xl p-5 transition-all"
              style={{ background: '#fff', border: '1px solid #f0cdd8' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#C62368')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0cdd8')}>
          <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>Nytt frågebatteri</p>
          <p className="text-xs mt-1" style={{ color: '#a0607a' }}>Skapa och spara frågor</p>
        </Link>
      </div>

      {/* Recent briefs */}
      <Section title="Senaste briefs" linkHref="/dashboard/briefs" linkLabel="Visa alla">
        {sessions.length === 0
          ? <EmptyState text="Inga briefs skickade ännu." />
          : sessions.map(s => (
            <Link key={s.id} href={`/dashboard/briefs/${s.id}`}
                  className="flex items-center justify-between py-3 px-4 rounded-xl transition-colors"
                  style={{ color: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fdf5f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <span className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{s.client_name}</span>
                <span className="text-xs ml-2" style={{ color: '#a0607a' }}>{s.client_email}</span>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          ))
        }
      </Section>

      {/* Question sets */}
      <Section title="Frågebatterier" linkHref="/dashboard/question-sets" linkLabel="Hantera alla">
        {questionSets.length === 0
          ? <EmptyState text="Inga frågebatterier än — skapa ett för att komma igång." />
          : questionSets.map(qs => (
            <Link key={qs.id} href={`/dashboard/question-sets/${qs.id}`}
                  className="flex items-center justify-between py-3 px-4 rounded-xl transition-colors"
                  style={{ color: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fdf5f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{qs.name}</span>
              <span className="text-xs" style={{ color: '#a0607a' }}>
                {new Date(qs.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
              </span>
            </Link>
          ))
        }
      </Section>
    </div>
  )
}

function StatCard({ label, value, color = '#C62368' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#a0607a' }}>{label}</p>
    </div>
  )
}

function Section({ title, children, linkHref, linkLabel }: {
  title: string; children: React.ReactNode; linkHref: string; linkLabel: string
}) {
  return (
    <div className="rounded-2xl mb-6" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #fbeef3' }}>
        <h2 className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{title}</h2>
        <Link href={linkHref} className="text-xs transition-colors" style={{ color: '#C62368' }}>
          {linkLabel} →
        </Link>
      </div>
      <div className="px-1 py-2">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={status === 'submitted'
            ? { background: '#dcfce7', color: '#16a34a' }
            : { background: '#fdf5f7', color: '#a0607a' }}>
      {status === 'submitted' ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-center py-6" style={{ color: '#c4909f' }}>{text}</p>
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: '#C62368', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
