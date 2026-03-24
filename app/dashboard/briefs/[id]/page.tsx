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
        <Link href="/dashboard/briefs" className="text-sm transition-colors" style={{ color: '#a0607a' }}>
          ← Tillbaka
        </Link>
        <span style={{ color: '#f0cdd8' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>{session?.client_name}</h1>
      </div>
      <p className="text-sm mb-8" style={{ color: '#a0607a' }}>
        {session?.client_email} · Besvarad{' '}
        {session?.submitted_at
          ? new Date(session.submitted_at).toLocaleDateString('sv-SE', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '–'}
      </p>

      {responses.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <p className="text-sm" style={{ color: '#c4909f' }}>
            {session?.status === 'submitted'
              ? 'Brifen är besvarad men inga svar hittades.'
              : 'Klienten har inte svarat på brifen ännu.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {responses.map((r, i) => (
            <div key={r.id} className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                      style={{ background: '#C62368' }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#a0607a' }}>
                    {r.response_type === 'voice' ? '🎙 Röst (transkriberat)' : '✏️ Text'}
                  </p>
                  <p className="text-sm font-medium mb-3" style={{ color: '#C62368' }}>{r.question_text}</p>
                  <div className="rounded-xl px-4 py-3" style={{ background: '#fdf5f7' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1a1a1a' }}>
                      {r.text_content || <span style={{ color: '#c4909f', fontStyle: 'italic' }}>Inget svar</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
            className="text-sm px-4 py-2 rounded-xl font-medium transition-colors"
            style={{ color: '#C62368', background: '#fdf5f7' }}>
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
          <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
               style={{ background: '#C62368', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
