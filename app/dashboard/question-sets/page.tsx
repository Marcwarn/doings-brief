'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type QuestionSet } from '@/lib/supabase'

export default function QuestionSetsPage() {
  const sb = createClient()
  const [sets, setSets]     = useState<QuestionSet[]>([])
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
          <h1 className="text-2xl font-bold text-[#1e0e2e]">Frågebatterier</h1>
          <p className="text-purple-400 text-sm mt-0.5">Skapa och hantera dina frågeuppsättningar</p>
        </div>
        <Link href="/dashboard/question-sets/new"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
          + Nytt batteri
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-purple-100 p-12 text-center">
          <p className="text-purple-300 text-sm mb-4">Inga frågebatterier ännu.</p>
          <Link href="/dashboard/question-sets/new"
                className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors">
            Skapa ditt första →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sets.map(s => (
            <div key={s.id}
                 className="bg-white rounded-2xl border border-purple-100 px-5 py-4 flex items-center justify-between hover:border-purple-200 transition-colors">
              <div>
                <p className="font-semibold text-[#1e0e2e] text-sm">{s.name}</p>
                {s.description && <p className="text-xs text-purple-400 mt-0.5">{s.description}</p>}
                <p className="text-xs text-purple-300 mt-1">
                  Uppdaterat {new Date(s.updated_at).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/send?set=${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-all"
                      style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
                  Skicka
                </Link>
                <Link href={`/dashboard/question-sets/${s.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                  Redigera
                </Link>
                <button onClick={() => deleteSet(s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-400 hover:bg-red-50 transition-colors">
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
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
