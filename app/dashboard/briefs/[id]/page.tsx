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
    <div style={{ padding: '40px 44px', maxWidth: 780, animation: 'fadeUp 0.35s ease both' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/briefs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Briefs</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{session?.client_name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            {session?.client_name}
          </h1>
          <Pill ok={session?.status === 'submitted'} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          {session?.client_email}
          {session?.submitted_at && (
            <> · Besvarad {new Date(session.submitted_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
      </div>

      {responses.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' }}>
            {session?.status === 'submitted' ? 'Inga svar hittades.' : 'Klienten har inte svarat ännu.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
          {responses.map((r, i) => (
            <div key={r.id} style={{ background: 'var(--surface)', padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: '#fff',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {r.response_type === 'voice' ? 'Röst' : 'Text'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{r.question_text}</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 7, padding: '12px 16px', border: '1px solid var(--border-sub)' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {r.text_content || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Inget svar</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {responses.length > 0 && (
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
            padding: '9px 18px', borderRadius: 7,
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 13, fontWeight: 500, color: 'var(--text-2)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          Exportera som text
        </button>
      )}
    </div>
  )
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#a8a29e',
      flexShrink: 0,
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
