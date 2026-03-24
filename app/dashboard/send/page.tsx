'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

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
      setSets(data || [])
      setLoading(false)
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: session.client_name,
        clientEmail: session.client_email,
        token: session.token,
        consultantEmail: user?.email,
      }),
    })

    setSent({ token: session.token, email: session.client_email })
    setSending(false)
  }

  function briefUrl(token: string) {
    return `${window.location.origin}/brief/${token}`
  }

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #f0cdd8',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#1a1a1a',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
    background: '#fff',
  }

  if (loading) return <LoadingDots />

  if (sent) {
    const url = briefUrl(sent.token)
    return (
      <div className="p-8 max-w-xl">
        <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: '#dcfce7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1a1a' }}>Brief skickad!</h2>
          <p className="text-sm mb-6" style={{ color: '#a0607a' }}>
            Vi skickade en länk till <strong style={{ color: '#1a1a1a' }}>{sent.email}</strong>.
          </p>
          <div className="rounded-xl p-3 mb-6 text-left" style={{ background: '#fdf5f7' }}>
            <p className="text-xs mb-1" style={{ color: '#a0607a' }}>Länk till klienten</p>
            <p className="text-xs font-mono break-all" style={{ color: '#C62368' }}>{url}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigator.clipboard.writeText(url)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ color: '#C62368', background: '#fdf5f7' }}>
              Kopiera länk
            </button>
            <button onClick={() => { setSent(null); setClientName(''); setClientEmail('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: '#C62368' }}>
              Skicka en till
            </button>
          </div>
          <Link href="/dashboard/briefs" className="block mt-4 text-xs transition-colors" style={{ color: '#a0607a' }}>
            Se alla briefs →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8" style={{ color: '#1a1a1a' }}>Skicka brief</h1>

      <form onSubmit={send} className="flex flex-col gap-5">
        {/* Question set */}
        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#a0607a' }}>
            Frågebatteri *
          </label>
          {sets.length === 0 ? (
            <div className="text-sm" style={{ color: '#a0607a' }}>
              Inga batterier ännu.{' '}
              <Link href="/dashboard/question-sets/new" className="underline" style={{ color: '#C62368' }}>
                Skapa ett →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sets.map(s => (
                <label key={s.id}
                       className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                       style={{
                         border: `1.5px solid ${selectedSet === s.id ? '#C62368' : '#f0cdd8'}`,
                         background: selectedSet === s.id ? '#fdf5f7' : '#fff',
                       }}>
                  <input type="radio" name="questionSet" value={s.id}
                         checked={selectedSet === s.id}
                         onChange={() => setSelectedSet(s.id)}
                         style={{ marginTop: '2px', accentColor: '#C62368' }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>{s.name}</p>
                    {s.description && <p className="text-xs" style={{ color: '#a0607a' }}>{s.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #fbeef3' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#a0607a' }}>
                Förhandsgranskning ({questions.length} frågor)
              </p>
              <ol className="list-decimal list-inside space-y-1">
                {questions.map(q => (
                  <li key={q.id} className="text-xs" style={{ color: '#C62368' }}>{q.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: '#a0607a' }}>
            Klientuppgifter *
          </label>
          <input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Klientens namn eller organisation"
            required
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#C62368')}
            onBlur={e => (e.target.style.borderColor = '#f0cdd8')}
          />
          <input
            type="email"
            value={clientEmail}
            onChange={e => setClientEmail(e.target.value)}
            placeholder="klient@foretag.se"
            required
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#C62368')}
            onBlur={e => (e.target.style.borderColor = '#f0cdd8')}
          />
        </div>

        {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}

        <button type="submit" disabled={sending || sets.length === 0}
                className="py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: '#C62368' }}>
          {sending ? 'Skickar…' : 'Skicka brief till klient →'}
        </button>
      </form>
    </div>
  )
}

export default function SendBriefPage() {
  return (
    <Suspense fallback={<LoadingDots />}>
      <SendBriefInner />
    </Suspense>
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
