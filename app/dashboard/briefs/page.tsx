'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type BriefSession } from '@/lib/supabase'

export default function BriefsPage() {
  const sb = createClient()
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    sb.from('brief_sessions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setSessions(data || []); setLoading(false) })
  }, [])

  function briefUrl(token: string) {
    return `${window.location.origin}/brief/${token}`
  }

  if (loading) return <LoadingDots />

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1e0e2e]">Skickade briefs</h1>
          <p className="text-purple-400 text-sm mt-0.5">Alla briefs och deras svar</p>
        </div>
        <Link href="/dashboard/send"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
          + Skicka ny
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-purple-100 p-12 text-center">
          <p className="text-purple-300 text-sm mb-4">Inga briefs skickade ännu.</p>
          <Link href="/dashboard/send" className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors">
            Skicka din första brief →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(s => (
            <div key={s.id}
                 className="bg-white rounded-2xl border border-purple-100 px-5 py-4 flex items-center justify-between gap-4 hover:border-purple-200 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#1e0e2e] text-sm">{s.client_name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-purple-400">{s.client_email}</p>
                <p className="text-xs text-purple-300 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'submitted' && (
                  <Link href={`/dashboard/briefs/${s.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all"
                        style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
                    Se svar
                  </Link>
                )}
                <button onClick={() => navigator.clipboard.writeText(briefUrl(s.token))}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                  Kopiera länk
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
