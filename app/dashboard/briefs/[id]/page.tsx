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
      setSession(sess); setResponses(resp || []); setLoading(false)
    })
  }, [id])

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '36px 40px', maxWidth: 760, fontFamily: 'DM Sans, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
        <Link href="/dashboard/briefs" style={{ color: '#9ca3af', textDecoration: 'none' }}>Briefs</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ color: '#111', fontWeight: 500 }}>{session?.client_name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: 0 }}>{session?.client_name}</h1>
          <StatusBadge status={session?.status || 'pending'} />
        </div>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
          {session?.client_email}
          {session?.submitted_at && (
            <> · Besvarad {new Date(session.submitted_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
      </div>

      {responses.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
            {session?.status === 'submitted' ? 'Inga svar hittades.' : 'Klienten har inte svarat ännu.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {responses.map((r, i) => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: '#C62368', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                    {r.response_type === 'voice' ? '🎙 Röst' : '✏️ Text'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 10 }}>{r.question_text}</div>
                  <div style={{ background: '#f5f4f6', borderRadius: 8, padding: '12px 14px' }}>
                    <p style={{ fontSize: 13.5, color: '#111', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {r.text_content || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Inget svar</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {responses.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => {
              const text = responses.map((r, i) => `Fråga ${i+1}: ${r.question_text}\nSvar: ${r.text_content || '(inget svar)'}`).join('\n\n')
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `${session?.client_name}-brief.txt`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{
              padding: '9px 16px', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 13, fontWeight: 500, color: '#374151',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}>
            Exportera som text
          </button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'submitted'
  return (
    <span style={{ fontSize: 11.5, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: ok ? '#dcfce7' : '#f3f4f6', color: ok ? '#15803d' : '#6b7280' }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C62368', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
