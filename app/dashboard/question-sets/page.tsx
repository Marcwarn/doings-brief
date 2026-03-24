'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type QuestionSet } from '@/lib/supabase'

export default function QuestionSetsPage() {
  const sb = createClient()
  const [sets, setSets]       = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.from('question_sets').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setSets(data || []); setLoading(false) })
  }, [])

  async function deleteSet(id: string) {
    if (!confirm('Radera det här frågebatteriet och alla dess frågor?')) return
    await sb.from('question_sets').delete().eq('id', id)
    setSets(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <LoadingDots />

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>Frågebatterier</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a0607a' }}>Skapa och hantera dina frågeuppsättningar</p>
        </div>
        <Link href="/dashboard/question-sets/new"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#C62368' }}>
          + Nytt batteri
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <p className="text-sm mb-4" style={{ color: '#c4909f' }}>Inga frågebatterier ännu.</p>
          <Link href="/dashboard/question-sets/new"
                className="text-sm font-semibold transition-colors" style={{ color: '#C62368' }}>
            Skapa ditt första →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sets.map(s => (
            <div key={s.id}
                 className="rounded-2xl px-5 py-4 flex items-center justify-between transition-colors"
                 style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{s.name}</p>
                {s.description && <p className="text-xs mt-0.5" style={{ color: '#a0607a' }}>{s.description}</p>}
                <p className="text-xs mt-1" style={{ color: '#c4909f' }}>
                  Uppdaterat {new Date(s.updated_at).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/send?set=${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all"
                      style={{ background: '#C62368' }}>
                  Skicka
                </Link>
                <Link href={`/dashboard/question-sets/${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      style={{ color: '#C62368', background: '#fdf5f7' }}>
                  Redigera
                </Link>
                <button onClick={() => deleteSet(s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{ color: '#dc2626' }}>
                  Radera
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
