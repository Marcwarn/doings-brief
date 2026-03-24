'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKGROUNDS = [
  '/bg/bg-06.svg','/bg/bg-08.svg','/bg/bg-10.svg','/bg/bg-12.svg',
  '/bg/bg-14.svg','/bg/bg-16.svg','/bg/bg-18.svg','/bg/bg-20.svg',
]

type Question  = { id: string; text: string; order_index: number }
type AnswerState = { text: string; mode: 'voice' | 'text' | null; status: 'idle'|'recording'|'transcribing'|'done' }

function Background({ index }: { index: number }) {
  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {BACKGROUNDS.map((src, i) => (
          <img key={src} src={src} alt="" aria-hidden draggable={false}
               className="absolute inset-0 w-full h-full object-cover select-none"
               style={{ opacity: i === index ? 1 : 0, transition: 'opacity 1.1s cubic-bezier(0.4,0,0.2,1)' }} />
        ))}
      </div>
      <div className="fixed top-5 left-5 z-30 pointer-events-none select-none">
        <img src="/doings-logo-white.svg" alt="Doings" width={72} draggable={false}
             style={{ filter: 'drop-shadow(0 1px 3px rgba(30,14,46,0.45)) drop-shadow(0 0 12px rgba(107,45,130,0.3))' }} />
      </div>
    </>
  )
}

export default function BriefPage() {
  const { token } = useParams<{ token: string }>()
  const sb = createClient()

  const [clientName, setClientName] = useState('')
  const [questions, setQuestions]   = useState<Question[]>([])
  const [answers, setAnswers]       = useState<AnswerState[]>([])
  const [step, setStep]             = useState<'loading'|'intro'|'questions'|'review'|'sending'|'done'|'notfound'>('loading')
  const [current, setCurrent]       = useState(0)
  const [bgIndex, setBgIndex]       = useState(0)

  // Voice recording
  const mediaRef      = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!token) return
    sb.from('brief_sessions').select('*, question_sets(id)').eq('token', token).single()
      .then(async ({ data: session }) => {
        if (!session) { setStep('notfound'); return }
        setClientName(session.client_name)
        if (session.status === 'submitted') { setStep('done'); return }

        const qSetId = session.question_set_id
        if (qSetId) {
          const { data: qs } = await sb.from('questions').select('*')
            .eq('question_set_id', qSetId).order('order_index')
          const qList = qs || []
          setQuestions(qList)
          setAnswers(qList.map(() => ({ text: '', mode: null, status: 'idle' })))
          setStep('intro')
        } else {
          setStep('notfound')
        }
      })
  }, [token])

  // Advance background when question changes
  useEffect(() => {
    setBgIndex(current % BACKGROUNDS.length)
  }, [current])

  function updateAnswer(i: number, patch: Partial<AnswerState>) {
    setAnswers(a => a.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }

  // ── Voice recording ──────────────────────────────────────────────────────────
  async function startRecording(i: number) {
    updateAnswer(i, { status: 'recording', mode: 'voice', text: '' })
    chunksRef.current = []
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(e => e + 1000), 1000)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => stream.getTracks().forEach(t => t.stop())
      mr.start()
    } catch {
      updateAnswer(i, { status: 'idle' })
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  async function stopRecording(i: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    updateAnswer(i, { status: 'transcribing' })
    mediaRef.current?.stop()
    await new Promise(r => setTimeout(r, 300))
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')
    try {
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form })
      const { text } = await res.json()
      updateAnswer(i, { text: text || '', status: 'done', mode: 'voice' })
    } catch {
      updateAnswer(i, { status: 'idle' })
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    setStep('sending')
    const payload = questions.map((q, i) => ({
      questionId:   q.id,
      questionText: q.text,
      orderIndex:   q.order_index,
      responseType: answers[i]?.mode || 'text',
      textContent:  answers[i]?.text || '',
    }))
    await fetch('/api/briefs/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, responses: payload }),
    })
    setStep('done')
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  }

  // ── Screens ──────────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e0e2e' }}>
      <div className="flex gap-2">
        {[0,1,2].map(i => <div key={i} className="w-3 h-3 rounded-full bg-purple-400 animate-bounce"
                                style={{ animationDelay: `${i*.15}s` }} />)}
      </div>
    </div>
  )

  if (step === 'notfound') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#1e0e2e' }}>
      <Background index={0} />
      <div className="glass-card p-10 text-center max-w-sm">
        <p className="font-bold text-doings-purple-dark text-lg mb-2">Brief hittades inte</p>
        <p className="text-doings-muted text-sm">Länken är ogiltig eller har gått ut.</p>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Background index={0} />
      <div className="glass-card p-10 text-center max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
             style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-doings-purple-dark mb-2">Tack, {clientName}!</h1>
        <p className="text-doings-muted text-sm leading-relaxed">
          Dina svar har tagits emot. Vi hör av oss snart!
        </p>
      </div>
    </div>
  )

  if (step === 'intro') return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Background index={0} />
      <div className="glass-card p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
             style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
            <path d="M5 12a7 7 0 0 0 14 0" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-doings-purple-dark mb-2">Hej, {clientName}!</h1>
        <p className="text-doings-muted text-sm leading-relaxed mb-6">
          Du har fått {questions.length} frågor att besvara. Du kan svara med röst eller text — välj det som passar dig.
          Det brukar ta 5–10 minuter.
        </p>
        <div className="flex gap-2 justify-center mb-8">
          {questions.map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-doings-purple-light" />
          ))}
        </div>
        <button onClick={() => setStep('questions')}
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(145deg,#6b2d82,#C62368)', boxShadow:'0 4px 20px rgba(107,45,130,.3)' }}>
          Sätt igång →
        </button>
      </div>
    </div>
  )

  if (step === 'questions') {
    const q = questions[current]
    const a = answers[current]
    const isLast = current === questions.length - 1

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Background index={bgIndex} />

        {/* Progress */}
        <div className="w-full max-w-lg mb-6">
          <div className="flex justify-between text-xs text-white/60 mb-2">
            <span>Fråga {current + 1} av {questions.length}</span>
            <span>{Math.round((current / questions.length) * 100)}% klart</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${((current + 1) / questions.length) * 100}%`,
                          background: 'linear-gradient(90deg,#6b2d82,#C62368)' }} />
          </div>
        </div>

        <div className="glass-card w-full max-w-lg p-7">
          {/* Question */}
          <p className="text-xs font-semibold text-doings-purple-dark/60 uppercase tracking-widest mb-3">
            Fråga {current + 1}
          </p>
          <p className="text-lg font-bold text-doings-purple-dark leading-snug mb-6">{q.text}</p>

          {/* Answer mode toggle */}
          {a.status === 'idle' && a.mode === null && (
            <div className="flex gap-3 mb-6">
              <button onClick={() => startRecording(current)}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(145deg,#6b2d82,#C62368)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 10z" />
                </svg>
                Spela in
              </button>
              <button onClick={() => updateAnswer(current, { mode: 'text' })}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm text-doings-purple-dark bg-white/60 border border-doings-purple-light/60">
                ✏️ Skriv
              </button>
            </div>
          )}

          {/* Recording */}
          {a.status === 'recording' && (
            <div className="text-center mb-6">
              <div className="flex gap-1 justify-center mb-3">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1.5 rounded-full animate-bounce"
                       style={{ height: `${16 + Math.random()*24}px`, background:'#6b2d82', animationDelay:`${i*.1}s` }} />
                ))}
              </div>
              <p className="text-doings-purple text-lg font-mono mb-4">{formatTime(elapsed)}</p>
              <button onClick={() => stopRecording(current)}
                      className="px-8 py-3 rounded-xl font-semibold text-sm text-white bg-red-500 hover:bg-red-600 transition-colors">
                Stoppa inspelning
              </button>
            </div>
          )}

          {/* Transcribing */}
          {a.status === 'transcribing' && (
            <div className="text-center mb-6">
              <p className="text-doings-muted text-sm">Transkriberar…</p>
            </div>
          )}

          {/* Text input */}
          {a.mode === 'text' && a.status !== 'recording' && (
            <textarea
              value={a.text}
              onChange={e => updateAnswer(current, { text: e.target.value, mode: 'text', status: a.text || e.target.value ? 'done' : 'idle' })}
              placeholder="Skriv ditt svar här…"
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm text-doings-purple-dark bg-white/60
                         border border-doings-purple-light/70 focus:outline-none focus:border-doings-purple
                         transition-colors mb-4 resize-none"
            />
          )}

          {/* Voice transcript result */}
          {a.mode === 'voice' && a.status === 'done' && (
            <div className="mb-4">
              <p className="text-xs text-doings-muted mb-2">🎙 Transkriberat svar</p>
              <textarea
                value={a.text}
                onChange={e => updateAnswer(current, { text: e.target.value })}
                rows={4}
                className="w-full rounded-xl px-4 py-3 text-sm text-doings-purple-dark bg-white/60
                           border border-doings-purple-light/70 focus:outline-none focus:border-doings-purple
                           transition-colors resize-none"
              />
              <button onClick={() => { updateAnswer(current, { mode: null, status: 'idle', text: '' }) }}
                      className="text-xs text-doings-muted mt-1 hover:text-doings-purple underline transition-colors">
                Spela in igen
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-2">
            {current > 0 && (
              <button onClick={() => setCurrent(c => c - 1)}
                      className="px-4 py-3 rounded-xl text-sm font-semibold text-doings-purple-dark bg-white/60 border border-doings-purple-light/60">
                ←
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) { setStep('review') }
                else setCurrent(c => c + 1)
              }}
              disabled={a.status === 'recording' || a.status === 'transcribing'}
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(145deg,#6b2d82,#C62368)' }}>
              {a.text?.trim() === '' && a.status !== 'done'
                ? isLast ? 'Hoppa över och granska →' : 'Hoppa över →'
                : isLast ? 'Granska svar →' : 'Nästa fråga →'
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'review') return (
    <div className="min-h-screen px-4 py-12">
      <Background index={0} />
      <div className="max-w-lg mx-auto">
        <div className="glass-card px-6 py-4 flex items-center gap-3 mb-8">
          <span className="font-semibold text-doings-purple-dark text-sm">Doings Brief</span>
          <span className="text-doings-muted text-xs">· Granska dina svar</span>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          {questions.map((q, i) => (
            <div key={q.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-xs font-semibold text-doings-purple-dark/60 uppercase tracking-wide">Fråga {i + 1}</p>
                <button onClick={() => { setCurrent(i); setStep('questions') }}
                        className="text-xs text-doings-purple hover:underline">Ändra</button>
              </div>
              <p className="text-sm font-medium text-doings-purple-dark mb-2">{q.text}</p>
              <p className="text-sm text-doings-muted leading-relaxed">
                {answers[i]?.text?.trim() || <span className="italic text-doings-muted/50">Inget svar</span>}
              </p>
            </div>
          ))}
        </div>

        <button onClick={submit}
                className="w-full py-4 rounded-2xl font-bold text-base text-white"
                style={{ background: 'linear-gradient(145deg,#6b2d82,#C62368)', boxShadow:'0 6px 24px rgba(107,45,130,.35)' }}>
          Skicka in →
        </button>
      </div>
    </div>
  )

  if (step === 'sending') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e0e2e' }}>
      <Background index={0} />
      <div className="glass-card p-10 text-center">
        <div className="flex gap-2 justify-center mb-4">
          {[0,1,2].map(i => <div key={i} className="w-3 h-3 rounded-full bg-purple-400 animate-bounce"
                                  style={{ animationDelay: `${i*.15}s` }} />)}
        </div>
        <p className="text-doings-muted text-sm">Skickar in dina svar…</p>
      </div>
    </div>
  )

  return null
}
