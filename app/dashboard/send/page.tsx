'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid #e5e7eb', background: '#fff',
  fontSize: 13.5, color: '#111', outline: 'none',
  fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.15s',
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
      <div style={{ padding: '36px 40px', maxWidth: 560, fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '48px 36px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: '0 0 8px' }}>Brief skickad!</h2>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: '0 0 24px' }}>
            Vi skickade en länk till <strong style={{ color: '#111', fontWeight: 500 }}>{sent.email}</strong>.
          </p>
          <div style={{ background: '#f5f4f6', borderRadius: 8, padding: '12px 14px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginBottom: 4 }}>Länk till klienten</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all' }}>{url}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigator.clipboard.writeText(url)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: 13.5, fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}>
              Kopiera länk
            </button>
            <button onClick={() => { setSent(null); setClientName(''); setClientEmail('') }} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#C62368', fontSize: 13.5, fontWeight: 500, color: '#fff',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 2px 8px rgba(198,35,104,0.22)',
            }}>
              Skicka en till
            </button>
          </div>
          <Link href="/dashboard/briefs" style={{ display: 'block', marginTop: 16, fontSize: 13, color: '#9ca3af', textDecoration: 'none' }}>
            Se alla briefs →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 680, fontFamily: 'DM Sans, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: '0 0 28px' }}>Skicka brief</h1>

      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Question set */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Frågebatteri *
          </div>
          {sets.length === 0 ? (
            <p style={{ fontSize: 13.5, color: '#9ca3af', margin: 0 }}>
              Inga batterier ännu.{' '}
              <Link href="/dashboard/question-sets/new" style={{ color: '#C62368', textDecoration: 'none', fontWeight: 500 }}>Skapa ett →</Link>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map(s => (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${selectedSet === s.id ? '#C62368' : '#e5e7eb'}`,
                  background: selectedSet === s.id ? '#FFF0F4' : '#fff',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="radio" name="qs" value={s.id}
                         checked={selectedSet === s.id}
                         onChange={() => setSelectedSet(s.id)}
                         style={{ marginTop: 2, accentColor: '#C62368' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: '#111' }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {questions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f4f4f4' }}>
              <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {questions.length} frågor
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {questions.map(q => (
                  <li key={q.id} style={{ fontSize: 12.5, color: '#6b7280' }}>{q.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Client info */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Klientuppgifter *
          </div>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
                 placeholder="Klientens namn eller organisation" required style={F}
                 onFocus={e => (e.target.style.borderColor = '#C62368')}
                 onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                 placeholder="klient@foretag.se" required style={F}
                 onFocus={e => (e.target.style.borderColor = '#C62368')}
                 onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
        </div>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

        <button type="submit" disabled={sending || sets.length === 0} style={{
          padding: '13px 0', borderRadius: 8, border: 'none',
          background: (sending || sets.length === 0) ? '#e08aaa' : '#C62368',
          fontSize: 14, fontWeight: 500, color: '#fff',
          cursor: (sending || sets.length === 0) ? 'not-allowed' : 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          boxShadow: '0 2px 8px rgba(198,35,104,0.22)',
        }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C62368', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}
