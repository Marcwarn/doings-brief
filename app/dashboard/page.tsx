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
      <h1 className="text-2xl font-bold text-[#1e0e2e] mb-1">Välkommen</h1>
      <p className="text-purple-400 text-sm mb-8">Här är en översikt av ditt arbete.</p>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Skickade briefs" value={sessions.length} />
        <StatCard label="Besvarade" value={submitted} color="#16a34a" />
        <StatCard label="Frågebatterier" value={questionSets.length} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link href="/dashboard/send"
              className="flex items-center gap-3 bg-white rounded-2xl p-5 border border-purple-100
                         hover:border-purple-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
               style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#1e0e2e] text-sm">Skicka ny brief</p>
            <p className="text-xs text-purple-400">Välj frågebatteri och klientmail</p>
          </div>
        </Link>

        <Link href="/dashboard/question-sets/new"
              className="flex items-center gap-3 bg-white rounded-2xl p-5 border border-purple-100
                         hover:border-purple-300 hover:shadow-sm transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
               style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#1e0e2e] text-sm">Nytt frågebatteri</p>
            <p className="text-xs text-purple-400">Skapa och spara frågor</p>
          </div>
        </Link>
      </div>

      {/* Recent briefs */}
      <Section title="Senaste briefs" linkHref="/dashboard/briefs" linkLabel="Visa alla">
        {sessions.length === 0
          ? <EmptyState text="Inga briefs skickade ännu." />
          : sessions.map(s => (
            <Link key={s.id} href={`/dashboard/briefs/${s.id}`}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-purple-50 transition-colors">
              <div>
                <span className="font-medium text-[#1e0e2e] text-sm">{s.client_name}</span>
                <span className="text-xs text-purple-400 ml-2">{s.client_email}</span>
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
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-purple-50 transition-colors">
              <span className="font-medium text-[#1e0e2e] text-sm">{qs.name}</span>
              <span className="text-xs text-purple-400">
                {new Date(qs.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
              </span>
            </Link>
          ))
        }
      </Section>
    </div>
  )
}

function StatCard({ label, value, color = '#6b2d82' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-purple-100">
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-purple-400 mt-1">{label}</p>
    </div>
  )
}

function Section({ title, children, linkHref, linkLabel }: {
  title: string; children: React.ReactNode; linkHref: string; linkLabel: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-50">
        <h2 className="font-semibold text-[#1e0e2e] text-sm">{title}</h2>
        <Link href={linkHref} className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
          {linkLabel} →
        </Link>
      </div>
      <div className="px-1 py-2">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-600'
    }`}>
      {status === 'submitted' ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-purple-300 text-center py-6">{text}</p>
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
