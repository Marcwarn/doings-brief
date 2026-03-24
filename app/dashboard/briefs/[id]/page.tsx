'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, type BriefSession, type BriefResponse } from '@/lib/supabase'

export default function BriefResponsesPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const sb = createClient()

  const [session, setSession]     = useState<BriefSession | null>(null)
  const [responses, setResponses] = useState<BriefResponse[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').eq('id', id).single(),
      sb.from('brief_responses').select('*').eq('session_id', id).order('order_index'),
    ]).then(([{ data: sess }, { data: resp }]) => {
      if (!sess) { router.replace('/dashboard/briefs'); return }
      setSession(sess)
      setResponses(resp || [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingDots />

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard/briefs" className="text-purple-400 hover:text-purple-700 text-sm transition-colors">
          ← Tillbaka
        </Link>
        <span className="text-purple-200">/</span>
        <h1 className="text-xl font-bold text-[#1e0e2e]">{session?.client_name}</h1>
      </div>
      <p className="text-purple-400 text-sm mb-8">
        {session?.client_email} · Besvarad{' '}
        {session?.submitted_at
          ? new Date(session.submitted_at).toLocaleDateString('sv-SE', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '–'}
      </p>

      {responses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-purple-100 p-10 text-center">
          <p className="text-purple-300 text-sm">
            {session?.status === 'submitted'
              ? 'Brifen är besvarad men inga svar hittades.'
              : 'Klienten har inte svarat på brifen ännu.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {responses.map((r, i) => (
            <div key={r.id} className="bg-white rounded-2xl border border-purple-100 p-6">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                      style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">
                    {r.response_type === 'voice' ? '🎙 Röst (transkriberat)' : '✏️ Text'}
                  </p>
                  <p className="text-sm font-medium text-purple-600 mb-3">{r.question_text}</p>
                  <div className="bg-purple-50 rounded-xl px-4 py-3">
                    <p className="text-sm text-[#1e0e2e] leading-relaxed whitespace-pre-wrap">
                      {r.text_content || <span className="text-purple-300 italic">Inget svar</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export options */}
      {responses.length > 0 && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              const text = responses.map((r, i) =>
                `Fråga ${i+1}: ${r.question_text}\nSvar: ${r.text_content || '(inget svar)'}`
              ).join('\n\n')
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
              const url  = URL.createObjectURL(blob)
              const a    = document.createElement('a')
              a.href = url; a.download = `${session?.client_name}-brief.txt`; a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-sm px-4 py-2 rounded-xl font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
            Exportera som text
          </button>
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
