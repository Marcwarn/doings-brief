'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13.5, color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s',
}

function SendBriefInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sb = createClient()

  const [sets, setSets]               = useState<QuestionSet[]>([])
  const [selectedSet, setSelectedSet] = useState<string>(searchParams.get('set') || '')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [clientName, setClientName]   = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState<{ token: string; email: string } | null>(null)
  const [error, setError]             = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data } = await sb.from('question_sets').select('*').order('updated_at', { ascending: false })
      setSets(data || []); setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedSet) { setQuestions([]); return }
    sb.from('questions').select('*').eq('question_set_id', selectedSet).order('order_index')
      .then(({ data }) => setQuestions(data || []))
  }, [selectedSet])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSet) { setError('Välj ett frågebatteri.'); return }
    if (!clientName.trim() || !clientEmail.trim()) { setError('Fyll i klientens namn och e-post.'); return }
    setSending(true); setError('')
    const { data: { user } } = await sb.auth.getUser()
    const { data: session, error: sessErr } = await sb
      .from('brief_sessions')
      .insert({
        consultant_id: user?.id,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        consultant_email: user?.email,
        question_set_id: selectedSet,
      })
      .select().single()
    if (sessErr || !session) { setError('Kunde inte skapa brief.'); setSending(false); return }
    await fetch('/api/briefs/send-invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: session.client_name, clientEmail: session.client_email, token: session.token, consultantEmail: user?.email }),
    })
    setSent({ token: session.token, email: session.client_email })
    setSending(false)
  }

  function briefUrl(token: string) { return `${window.location.origin}/brief/${token}` }

  if (loading) return <PageLoader />

  if (sent) {
    const url = briefUrl(sent.token)
    return (
      <div style={{ padding: '40px 44px', maxWidth: 560, animation: 'fadeUp 0.35s ease both' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 36px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #bbf7d0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            Brief skickad!
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '0 0 28px' }}>
            Vi skickade en länk till <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sent.email}</strong>.
          </p>
          <div style={{ background: 'var(--bg)', borderRadius: 7, padding: '12px 14px', marginBottom: 24, textAlign: 'left', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Länk till klienten
            </div>
            <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-2)', wordBreak: 'break-all' }}>{url}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigator.clipboard.writeText(url)} style={{
              flex: 1, padding: '10px 0', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              Kopiera länk
            </button>
            <button onClick={() => { setSent(null); setClientName(''); setClientEmail('') }} style={{
              flex: 1, padding: '10px 0', borderRadius: 7, border: 'none',
              background: 'var(--accent)',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700,
              letterSpacing: '0.01em', color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(198,35,104,0.22)',
            }}>
              Skicka en till
            </button>
          </div>
          <Link href="/dashboard/briefs" style={{ display: 'block', marginTop: 18, fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            Se alla briefs →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 700, animation: 'fadeUp 0.35s ease both' }}>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 32px' }}>
        Skicka brief
      </h1>

      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Question set */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Frågebatteri *
          </div>
          {sets.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0 }}>
              Inga batterier ännu.{' '}
              <Link href="/dashboard/question-sets/new" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Skapa ett →</Link>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map(s => (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 7, cursor: 'pointer',
                  border: `1.5px solid ${selectedSet === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedSet === s.id ? 'var(--accent-dim)' : 'var(--bg)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="radio" name="qs" value={s.id}
                         checked={selectedSet === s.id}
                         onChange={() => setSelectedSet(s.id)}
                         style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {questions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-sub)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {questions.length} frågor
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {questions.map(q => (
                  <li key={q.id} style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{q.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Client info */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Klientuppgifter *
          </div>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
                 placeholder="Klientens namn eller organisation" required style={F}
                 onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                 onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
          <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                 placeholder="klient@foretag.se" required style={F}
                 onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                 onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 7, border: '1px solid #fecaca' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={sending || sets.length === 0} style={{
          padding: '13px 0', borderRadius: 7, border: 'none',
          background: (sending || sets.length === 0) ? 'rgba(198,35,104,0.4)' : 'var(--accent)',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
          letterSpacing: '0.01em', color: '#fff',
          cursor: (sending || sets.length === 0) ? 'not-allowed' : 'pointer',
          boxShadow: (sending || sets.length === 0) ? 'none' : '0 4px 16px rgba(198,35,104,0.22)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { if (!sending && sets.length > 0) { const el = e.currentTarget; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 22px rgba(198,35,104,0.30)' } }}
        onMouseLeave={e => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = (sending || sets.length === 0) ? 'none' : '0 4px 16px rgba(198,35,104,0.22)' }}>
          {sending ? 'Skickar…' : 'Skicka brief till klient →'}
        </button>
      </form>
    </div>
  )
}

export default function SendBriefPage() {
  return <Suspense fallback={<PageLoader />}><SendBriefInner /></Suspense>
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
