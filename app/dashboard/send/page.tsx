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
  const [consultantEmail, setConsultantEmail] = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setConsultantEmail(user.email!)
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
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        consultant_email: user?.email,
        question_set_id: selectedSet,
      })
      .select().single()

    if (sessErr || !session) { setError('Kunde inte skapa brief.'); setSending(false); return }

    // Send invite email to client
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

  if (loading) return <LoadingDots />

  if (sent) {
    const url = briefUrl(sent.token)
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-white rounded-2xl border border-green-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1e0e2e] mb-2">Brief skickad!</h2>
          <p className="text-sm text-purple-400 mb-6">
            Vi skickade en länk till <strong className="text-[#1e0e2e]">{sent.email}</strong>.
          </p>
          <div className="bg-purple-50 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-purple-400 mb-1">Länk till klienten</p>
            <p className="text-xs font-mono text-purple-700 break-all">{url}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigator.clipboard.writeText(url)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
              Kopiera länk
            </button>
            <button onClick={() => { setSent(null); setClientName(''); setClientEmail('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
              Skicka en till
            </button>
          </div>
          <Link href="/dashboard/briefs" className="block mt-4 text-xs text-purple-400 hover:text-purple-600 transition-colors">
            Se alla briefs →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-[#1e0e2e]">Skicka brief</h1>
      </div>

      <form onSubmit={send} className="flex flex-col gap-5">
        {/* Question set */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6">
          <label className="block text-xs font-semibold text-purple-500 uppercase tracking-wide mb-3">
            Frågebatteri *
          </label>
          {sets.length === 0 ? (
            <div className="text-sm text-purple-400">
              Inga batterier ännu. <Link href="/dashboard/question-sets/new" className="text-purple-600 underline">Skapa ett →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sets.map(s => (
                <label key={s.id}
                       className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                         selectedSet === s.id
                           ? 'border-purple-400 bg-purple-50'
                           : 'border-purple-100 hover:border-purple-200'
                       }`}>
                  <input type="radio" name="questionSet" value={s.id}
                         checked={selectedSet === s.id}
                         onChange={() => setSelectedSet(s.id)}
                         className="mt-0.5 accent-purple-600" />
                  <div>
                    <p className="font-medium text-[#1e0e2e] text-sm">{s.name}</p>
                    {s.description && <p className="text-xs text-purple-400">{s.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Preview questions */}
          {questions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-purple-50">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2">
                Förhandsgranskning ({questions.length} frågor)
              </p>
              <ol className="list-decimal list-inside space-y-1">
                {questions.map(q => (
                  <li key={q.id} className="text-xs text-purple-600">{q.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="bg-white rounded-2xl border border-purple-100 p-6 flex flex-col gap-4">
          <label className="block text-xs font-semibold text-purple-500 uppercase tracking-wide">
            Klientuppgifter *
          </label>
          <input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Klientens namn eller organisation"
            required
            className="w-full border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-[#1e0e2e]
                       focus:outline-none focus:border-purple-400 transition-colors"
          />
          <input
            type="email"
            value={clientEmail}
            onChange={e => setClientEmail(e.target.value)}
            placeholder="klient@foretag.se"
            required
            className="w-full border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-[#1e0e2e]
                       focus:outline-none focus:border-purple-400 transition-colors"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={sending || sets.length === 0}
                className="py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
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
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
