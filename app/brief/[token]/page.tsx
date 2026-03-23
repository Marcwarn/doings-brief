'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const QUESTIONS = [
  { id: 1, label: 'Om er organisation',  question: 'Berätta kort om er organisation — vad ni gör och vad ni står för.' },
  { id: 2, label: 'Utmaningen',           question: 'Vad är den utmaning eller möjlighet som ligger bakom det här uppdraget?' },
  { id: 3, label: 'Målet',               question: 'Vad vill ni uppnå? Beskriv vad framgång ser ut för er.' },
  { id: 4, label: 'Målgruppen',          question: 'Vem är er målgrupp — vilka ska påverkas eller nås?' },
  { id: 5, label: 'Tidsplan',            question: 'Finns det en tidsplan, deadline eller viktiga datum vi bör känna till?' },
  { id: 6, label: 'Budget',              question: 'Vad är er ungefärliga budget för det här uppdraget?' },
  { id: 7, label: 'Övrigt',             question: 'Är det något mer ni vill att vi ska veta om er eller uppdraget?' },
]

type AnswerState = { transcript: string; status: 'idle' | 'recording' | 'transcribing' | 'done' }
type Step = 'brief' | 'review' | 'sending' | 'done'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function BriefPage({ params }: { params: { token: string } }) {
  const [sessionData, setSessionData] = useState<{ id: string; client_name: string; consultant_id: string } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [step, setStep] = useState<Step>('brief')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswerState[]>(QUESTIONS.map(() => ({ transcript: '', status: 'idle' })))
  const [sendError, setSendError] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef    = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef(0)

  const sb = createClient()

  useEffect(() => {
    sb.from('brief_sessions')
      .select('id, client_name, consultant_id, status')
      .eq('token', params.token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); return }
        if (data.status === 'submitted') { setAlreadyDone(true); return }
        setSessionData({ id: data.id, client_name: data.client_name, consultant_id: data.consultant_id })
      })
  }, [params.token])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [current])

  const updateAnswer = useCallback((idx: number, patch: Partial<AnswerState>) => {
    setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        handleTranscribe(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      recorder.start(250)
      setIsRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 500)
      updateAnswer(current, { status: 'recording', transcript: '' })
    } catch { alert('Kunde inte komma åt mikrofonen. Kontrollera att du gett tillstånd.') }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setElapsed(0)
    updateAnswer(current, { status: 'transcribing' })
  }

  async function handleTranscribe(blob: Blob) {
    const fd = new FormData()
    fd.append('file', blob, 'audio.webm')
    fd.append('model', 'KBLab/kb-whisper-large')
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      updateAnswer(current, { transcript: data.text || '', status: 'done' })
    } catch {
      updateAnswer(current, { transcript: '', status: 'done' })
      alert('Transkribering misslyckades. Du kan skriva svaret manuellt.')
    }
  }

  async function submitBrief() {
    if (!sessionData) return
    setStep('sending')
    setSendError('')
    const payload = {
      sessionId: sessionData.id,
      clientName: sessionData.client_name,
      consultantId: sessionData.consultant_id,
      token: params.token,
      answers: QUESTIONS.map((q, i) => ({
        label: q.label, question: q.question, answer: answers[i].transcript,
      })),
    }
    const res = await fetch('/api/submit-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setStep('done')
    } else {
      setSendError('Det gick inte att skicka briefen. Försök igen.')
      setStep('review')
    }
  }

  // ── Loading / error states ──────────────────────────────────────
  if (!sessionData && !notFound && !alreadyDone) return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg">
      <div className="flex gap-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg px-4">
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm max-w-sm">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-doings-purple-dark mb-2">Länken är ogiltig</h1>
        <p className="text-doings-muted text-sm">Kontakta din konsult för en ny länk.</p>
      </div>
    </div>
  )

  if (alreadyDone) return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg px-4">
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm max-w-sm">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-doings-purple-dark mb-2">Brief redan inlämnad</h1>
        <p className="text-doings-muted text-sm">Din brief är redan skickad. Tack!</p>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg px-4">
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm max-w-sm slide-in">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-doings-purple-dark mb-3">Tack! Briefen är skickad.</h1>
        <p className="text-doings-muted text-sm">Vi återkommer till dig inom kort. Ha det fint!</p>
      </div>
    </div>
  )

  const q   = QUESTIONS[current]
  const ans = answers[current]
  const progress = ((current + 1) / QUESTIONS.length) * 100

  // ── Review screen ──────────────────────────────────────────────
  if (step === 'review' || step === 'sending') return (
    <div className="min-h-screen bg-doings-bg py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>D</div>
          <span className="font-semibold text-doings-purple-dark">Doings Brief</span>
        </div>
        <h1 className="text-2xl font-bold text-doings-purple-dark mb-2">Granska din brief</h1>
        <p className="text-doings-muted text-sm mb-8">Kolla igenom dina svar. Du kan gå tillbaka och ändra om något inte stämmer.</p>

        {QUESTIONS.map((q, i) => (
          <div key={q.id} className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs font-semibold text-doings-purple uppercase tracking-wide">
                  Fråga {i + 1} · {q.label}
                </span>
                <p className="text-sm text-doings-muted mt-1 mb-3">{q.question}</p>
                <textarea
                  value={answers[i].transcript}
                  onChange={e => updateAnswer(i, { transcript: e.target.value })}
                  rows={3}
                  placeholder="Inget svar ännu…"
                  className="w-full border border-doings-purple-light rounded-xl px-4 py-2 text-sm
                             focus:outline-none focus:border-doings-purple transition-colors resize-none"
                />
              </div>
              <button onClick={() => { setCurrent(i); setStep('brief') }}
                      className="shrink-0 text-xs text-doings-purple underline mt-6 hover:no-underline">
                Ändra
              </button>
            </div>
          </div>
        ))}

        {sendError && <p className="text-red-500 text-sm text-center mb-4">{sendError}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={() => { setCurrent(QUESTIONS.length - 1); setStep('brief') }}
                  className="flex-1 py-3 rounded-xl font-semibold border-2 border-doings-purple-light text-doings-purple hover:bg-doings-purple-pale transition-colors">
            ← Tillbaka
          </button>
          <button onClick={submitBrief} disabled={step === 'sending'}
                  className="flex-[2] py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>
            {step === 'sending' ? 'Skickar…' : 'Skicka briefen ✓'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Question screen ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-doings-bg flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 bg-white border-b border-doings-purple-light/50">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
             style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>D</div>
        <div>
          <span className="font-semibold text-doings-purple-dark text-sm">Doings Brief</span>
          {sessionData?.client_name && (
            <span className="text-xs text-doings-muted ml-2">· {sessionData.client_name}</span>
          )}
        </div>
        <span className="ml-auto text-xs text-doings-muted">{current + 1} / {QUESTIONS.length}</span>
      </header>

      <div className="h-1 bg-doings-purple-light">
        <div className="h-1 transition-all duration-500" style={{ width: `${progress}%`, background: '#6b2d82' }} />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg slide-in" key={current}>
          <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, #1e0e2e, #3d1a47)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60 text-white">
              Fråga {current + 1} · {q.label}
            </span>
            <p className="text-white text-lg font-medium mt-2 leading-relaxed">{q.question}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            {/* Idle */}
            {!isRecording && ans.status !== 'transcribing' && (
              <div className="flex flex-col items-center gap-4">
                <button onClick={startRecording}
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg shadow-doings-purple/30 hover:scale-105 active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 12z"/>
                  </svg>
                </button>
                <p className="text-sm text-doings-muted">
                  {ans.status === 'done' ? 'Spela in igen' : 'Tryck för att svara med rösten'}
                </p>
              </div>
            )}

            {/* Recording */}
            {isRecording && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-1 h-10">
                  {[...Array(7)].map((_, i) => <div key={i} className="wave-bar" />)}
                </div>
                <p className="text-doings-purple font-semibold text-sm">{formatTime(elapsed)} · Spelar in…</p>
                <button onClick={stopRecording}
                        className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm"
                        style={{ background: '#e8304a' }}>
                  ■ Stoppa inspelning
                </button>
              </div>
            )}

            {/* Transcribing */}
            {ans.status === 'transcribing' && !isRecording && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex gap-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
                         style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-doings-muted">Transkriberar…</p>
              </div>
            )}

            {/* Transcript result */}
            {ans.status === 'done' && ans.transcript && (
              <div className="mt-4 border-t border-doings-purple-light/50 pt-4">
                <p className="text-xs font-semibold text-doings-purple uppercase tracking-wide mb-2">Ditt svar:</p>
                <textarea
                  value={ans.transcript}
                  onChange={e => updateAnswer(current, { transcript: e.target.value })}
                  rows={4}
                  className="w-full border border-doings-purple-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-doings-purple transition-colors resize-none"
                />
              </div>
            )}

            {/* Manual text fallback */}
            {(ans.status === 'idle' || (ans.status === 'done' && !ans.transcript)) && (
              <div className="mt-4 border-t border-doings-purple-light/50 pt-4">
                <p className="text-xs text-doings-muted mb-2">Föredrar du att skriva?</p>
                <textarea
                  value={ans.transcript}
                  onChange={e => updateAnswer(current, { transcript: e.target.value, status: e.target.value ? 'done' : 'idle' })}
                  rows={3} placeholder="Skriv ditt svar här…"
                  className="w-full border border-doings-purple-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-doings-purple transition-colors resize-none"
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {current > 0 && (
              <button onClick={() => setCurrent(c => c - 1)}
                      className="flex-1 py-3 rounded-xl font-semibold border-2 border-doings-purple-light text-doings-purple hover:bg-doings-purple-pale transition-colors text-sm">
                ← Föregående
              </button>
            )}
            <button onClick={() => current < QUESTIONS.length - 1 ? setCurrent(c => c + 1) : setStep('review')}
                    disabled={!ans.transcript.trim()}
                    className="flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>
              {current === QUESTIONS.length - 1 ? 'Granska brief →' : 'Nästa fråga →'}
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {QUESTIONS.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ background: i === current ? '#6b2d82' : answers[i].transcript ? '#e8d9f0' : '#d1d5db', transform: i === current ? 'scale(1.4)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
