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
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>Skickade briefs</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a0607a' }}>Alla briefs och deras svar</p>
        </div>
        <Link href="/dashboard/send"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#C62368' }}>
          + Skicka ny
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <p className="text-sm mb-4" style={{ color: '#c4909f' }}>Inga briefs skickade ännu.</p>
          <Link href="/dashboard/send" className="text-sm font-semibold transition-colors" style={{ color: '#C62368' }}>
            Skicka din första brief →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(s => (
            <div key={s.id}
                 className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition-colors"
                 style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{s.client_name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs" style={{ color: '#a0607a' }}>{s.client_email}</p>
                <p className="text-xs mt-0.5" style={{ color: '#c4909f' }}>
                  {new Date(s.created_at).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'submitted' && (
                  <Link href={`/dashboard/briefs/${s.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all"
                        style={{ background: '#C62368' }}>
                    Se svar
                  </Link>
                )}
                <button onClick={() => navigator.clipboard.writeText(briefUrl(s.token))}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{ color: '#C62368', background: '#fdf5f7' }}>
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
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={status === 'submitted'
            ? { background: '#dcfce7', color: '#16a34a' }
            : { background: '#fdf5f7', color: '#a0607a' }}>
      {status === 'submitted' ? 'Besvarad' : 'Inväntar'}
    </span>
  )
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
