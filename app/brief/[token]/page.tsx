'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const QUESTIONS = [
  { id: 1, label: 'Om er organisation',  question: 'Berätta kort om er organisation — vad ni gör och vad ni står för.' },
  { id: 2, label: 'Utmaningen',          question: 'Vad är den utmaning eller möjlighet som ligger bakom det här uppdraget?' },
  { id: 3, label: 'Målet',              question: 'Vad vill ni uppnå? Beskriv vad framgång ser ut för er.' },
  { id: 4, label: 'Målgruppen',         question: 'Vem är er målgrupp — vilka ska påverkas eller nås?' },
  { id: 5, label: 'Tidsplan',           question: 'Finns det en tidsplan, deadline eller viktiga datum vi bör känna till?' },
  { id: 6, label: 'Budget',             question: 'Vad är er ungefärliga budget för det här uppdraget?' },
  { id: 7, label: 'Övrigt',            question: 'Är det något mer ni vill att vi ska veta om er eller uppdraget?' },
]

// Spread 7 backgrounds evenly across the 13 available
const BACKGROUNDS = [
  '/bg/bg-06.svg',
  '/bg/bg-08.svg',
  '/bg/bg-10.svg',
  '/bg/bg-12.svg',
  '/bg/bg-14.svg',
  '/bg/bg-16.svg',
  '/bg/bg-18.svg',
]

type AnswerState = { transcript: string; status: 'idle' | 'recording' | 'transcribing' | 'done' }
type Step = 'brief' | 'review' | 'sending' | 'done'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const MicIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 12z" />
  </svg>
)

const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
  </svg>
)

const CheckIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// Full-bleed background layers that cross-fade with CSS
function Background({ index }: { index: number }) {
  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {BACKGROUNDS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none"
            style={{
              opacity: i === index ? 1 : 0,
              transition: 'opacity 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        ))}
      </div>

      {/* Doings logo — top-left corner */}
      <div className="fixed top-5 left-5 z-30 pointer-events-none select-none">
        <img
          src="/doings-logo-white.svg"
          alt="Doings"
          width={72}
          draggable={false}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(30,14,46,0.45)) drop-shadow(0 0 12px rgba(107,45,130,0.3))' }}
        />
      </div>
    </>
  )
}

// Dots / pill progress
function ProgressDots({
  total, current, answers, onJump,
}: {
  total: number; current: number; answers: AnswerState[]; onJump: (i: number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Fråga ${i + 1}`}
          className="rounded-full transition-all duration-300"
          style={{
            height: 7,
            width: i === current ? 22 : 7,
            background: i === current
              ? '#C62368'
              : answers[i].transcript
              ? 'rgba(107,45,130,0.55)'
              : 'rgba(107,45,130,0.18)',
          }}
        />
      ))}
    </div>
  )
}

export default function BriefPage({ params }: { params: { token: string } }) {
  const [sessionData, setSessionData] = useState<{
    id: string; client_name: string; consultant_id: string
  } | null>(null)
  const [notFound, setNotFound]   = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [step, setStep]           = useState<Step>('brief')
  const [current, setCurrent]     = useState(0)
  const [activeBg, setActiveBg]   = useState(0)
  const [answers, setAnswers]     = useState<AnswerState[]>(
    QUESTIONS.map(() => ({ transcript: '', status: 'idle' }))
  )
  const [sendError, setSendError] = useState('')

  const recorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed]         = useState(0)
  const timerRef     = useRef<NodeJS.Timeout | null>(null)
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

  // Sync background index to current question
  useEffect(() => { setActiveBg(current) }, [current])

  const updateAnswer = useCallback((idx: number, patch: Partial<AnswerState>) =>
    setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))
  , [])

  async function startRecording() {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
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
    } catch {
      alert('Kunde inte komma åt mikrofonen. Kontrollera att du gett tillstånd.')
    }
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
      const res  = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      updateAnswer(current, { transcript: data.text || '', status: 'done' })
    } catch {
      updateAnswer(current, { transcript: '', status: 'done' })
    }
  }

  async function submitBrief() {
    if (!sessionData) return
    setStep('sending')
    setSendError('')
    const res = await fetch('/api/submit-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId:    sessionData.id,
        clientName:   sessionData.client_name,
        consultantId: sessionData.consultant_id,
        token:        params.token,
        answers:      QUESTIONS.map((q, i) => ({
          label: q.label, question: q.question, answer: answers[i].transcript,
        })),
      }),
    })
    if (res.ok) {
      setStep('done')
    } else {
      setSendError('Det gick inte att skicka briefen. Försök igen.')
      setStep('review')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (!sessionData && !notFound && !alreadyDone) return (
    <>
      <Background index={0} />
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
                 style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </>
  )

  // ── Not found ────────────────────────────────────────────────────
  if (notFound) return (
    <>
      <Background index={0} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card max-w-sm w-full text-center p-10">
          <p className="text-5xl font-bold text-doings-purple-dark mb-3 tabular-nums tracking-tight">404</p>
          <h1 className="text-lg font-semibold text-doings-purple-dark mb-2">Länken är ogiltig</h1>
          <p className="text-doings-muted text-sm leading-relaxed">Kontakta din konsult för att få en ny länk.</p>
        </div>
      </div>
    </>
  )

  // ── Already submitted ────────────────────────────────────────────
  if (alreadyDone) return (
    <>
      <Background index={3} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card max-w-sm w-full text-center p-12">
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
            <CheckIcon size={22} />
          </div>
          <h1 className="text-xl font-semibold text-doings-purple-dark mb-2">Brief redan inlämnad</h1>
          <p className="text-doings-muted text-sm">Din brief är redan skickad.</p>
        </div>
      </div>
    </>
  )

  // ── Done ─────────────────────────────────────────────────────────
  if (step === 'done') return (
    <>
      <Background index={6} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card max-w-sm w-full text-center p-14 slide-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
            <CheckIcon size={26} />
          </div>
          <h1 className="text-2xl font-bold text-doings-purple-dark mb-3">Tack — briefen är skickad</h1>
          <p className="text-doings-muted leading-relaxed">Vi återkommer till dig inom kort.</p>
        </div>
      </div>
    </>
  )

  const q   = QUESTIONS[current]
  const ans = answers[current]
  const progress = ((current + 1) / QUESTIONS.length) * 100

  // ── Review ───────────────────────────────────────────────────────
  if (step === 'review' || step === 'sending') return (
    <>
      <Background index={activeBg} />
      <div className="min-h-screen py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass-header px-5 py-3 flex items-center gap-3 mb-10">
            <span className="font-semibold text-doings-purple-dark text-sm">Doings Brief</span>
          </div>

          <h1 className="text-2xl font-bold text-doings-purple-dark mb-1.5">Granska din brief</h1>
          <p className="text-doings-muted text-sm mb-8 leading-relaxed">
            Kolla igenom dina svar — du kan justera innan du skickar.
          </p>

          {QUESTIONS.map((q, i) => (
            <div key={q.id} className="glass-card p-6 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="text-xs font-semibold tracking-[0.16em] uppercase mb-1 block"
                        style={{ color: '#C62368' }}>
                    {q.label}
                  </span>
                  <p className="text-sm text-doings-muted mb-3 leading-relaxed">{q.question}</p>
                  <textarea
                    value={answers[i].transcript}
                    onChange={e => updateAnswer(i, { transcript: e.target.value })}
                    rows={3}
                    placeholder="Inget svar ännu…"
                    className="w-full rounded-xl px-4 py-3 text-sm text-doings-purple-dark leading-relaxed
                               bg-white/50 border border-doings-purple-light/60
                               focus:outline-none focus:border-doings-purple transition-colors resize-none
                               placeholder:text-doings-muted/40"
                  />
                </div>
                <button onClick={() => { setCurrent(i); setStep('brief') }}
                        className="shrink-0 text-xs text-doings-purple underline mt-7
                                   hover:no-underline transition-all">
                  Ändra
                </button>
              </div>
            </div>
          ))}

          {sendError && <p className="text-red-500 text-sm text-center mb-4">{sendError}</p>}

          <div className="flex gap-3 mt-8">
            <button onClick={() => { setCurrent(QUESTIONS.length - 1); setStep('brief') }}
                    className="flex-1 py-3.5 rounded-xl font-medium text-sm glass-btn-outline">
              Tillbaka
            </button>
            <button onClick={submitBrief} disabled={step === 'sending'}
                    className="flex-[2] py-3.5 rounded-xl font-semibold text-sm text-white
                               transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
              {step === 'sending' ? 'Skickar…' : 'Skicka briefen'}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  // ── Question screen ──────────────────────────────────────────────
  return (
    <>
      <Background index={activeBg} />

      {/* Thin progress line at very top */}
      <div className="fixed top-0 left-0 right-0 z-20 h-[3px]" style={{ background: 'rgba(247,202,202,0.4)' }}>
        <div className="h-full transition-all duration-700 ease-out"
             style={{ width: `${progress}%`, background: '#C62368' }} />
      </div>

      {/* Floating header */}
      <header className="fixed top-3 left-0 right-0 z-10 px-4">
        <div className="max-w-lg mx-auto glass-header px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-doings-purple-dark text-sm">Doings Brief</span>
            {sessionData?.client_name && (
              <span className="text-xs text-doings-muted hidden sm:inline ml-0.5">
                · {sessionData.client_name}
              </span>
            )}
          </div>
          <span className="text-xs font-medium tabular-nums" style={{ color: '#C62368' }}>
            {current + 1} <span className="text-doings-muted font-normal">/ {QUESTIONS.length}</span>
          </span>
        </div>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-24">
        <div className="w-full max-w-lg" key={current}>

          {/* Main glass card */}
          <div className="glass-card p-8 mb-5 slide-in">

            {/* Question */}
            <div className="mb-7">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase block mb-3"
                    style={{ color: '#C62368' }}>
                {q.label}
              </span>
              <p className="text-[1.2rem] leading-[1.65] font-semibold text-doings-purple-dark">
                {q.question}
              </p>
            </div>

            <div className="border-t border-black/5 pt-7">

              {/* Idle / done — show mic button */}
              {!isRecording && ans.status !== 'transcribing' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {/* Idle pulse hint (very subtle) */}
                    {ans.status === 'idle' && (
                      <div className="absolute inset-0 rounded-full idle-ring" />
                    )}
                    <button
                      onClick={startRecording}
                      className="mic-btn relative z-10 w-[76px] h-[76px] rounded-full
                                 flex items-center justify-center text-white"
                      aria-label="Starta inspelning"
                    >
                      <MicIcon />
                    </button>
                  </div>
                  <p className="text-sm text-doings-muted">
                    {ans.status === 'done' && ans.transcript
                      ? 'Spela in ett nytt svar'
                      : 'Spela in ditt svar'}
                  </p>
                </div>
              )}

              {/* Recording */}
              {isRecording && (
                <div className="flex flex-col items-center gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full pulse-ring" />
                    <div className="absolute inset-0 rounded-full pulse-ring"
                         style={{ animationDelay: '0.65s' }} />
                    <button
                      onClick={stopRecording}
                      className="mic-btn mic-btn--recording relative z-10 w-[76px] h-[76px] rounded-full
                                 flex items-center justify-center text-white"
                      aria-label="Stoppa inspelning"
                    >
                      <StopIcon />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-end gap-[3px] h-7">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="wave-bar" />
                      ))}
                    </div>
                    <span className="text-sm font-semibold tabular-nums"
                          style={{ color: '#C62368' }}>
                      {formatTime(elapsed)}
                    </span>
                  </div>
                </div>
              )}

              {/* Transcribing */}
              {ans.status === 'transcribing' && !isRecording && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-doings-purple animate-bounce"
                           style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-sm text-doings-muted">Transkriberar…</p>
                </div>
              )}

              {/* Transcript result */}
              {ans.status === 'done' && ans.transcript && (
                <div className="mt-6 pt-6 border-t border-black/5">
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-doings-purple mb-2.5">
                    Ditt svar
                  </p>
                  <textarea
                    value={ans.transcript}
                    onChange={e => updateAnswer(current, { transcript: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl px-4 py-3 text-sm text-doings-purple-dark leading-relaxed
                               bg-white/50 border border-doings-purple-light/50
                               focus:outline-none focus:border-doings-purple transition-colors resize-none"
                  />
                </div>
              )}

              {/* Manual text fallback */}
              {(ans.status === 'idle' || (ans.status === 'done' && !ans.transcript)) && (
                <div className="mt-6 pt-6 border-t border-black/5">
                  <p className="text-xs text-doings-muted mb-2.5">Föredrar du att skriva?</p>
                  <textarea
                    value={ans.transcript}
                    onChange={e =>
                      updateAnswer(current, {
                        transcript: e.target.value,
                        status: e.target.value ? 'done' : 'idle',
                      })
                    }
                    rows={3}
                    placeholder="Skriv ditt svar här…"
                    className="w-full rounded-xl px-4 py-3 text-sm text-doings-purple-dark leading-relaxed
                               bg-white/50 border border-doings-purple-light/50
                               focus:outline-none focus:border-doings-purple transition-colors resize-none
                               placeholder:text-doings-muted/40"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Navigation row */}
          <div className="flex items-center gap-3">
            {current > 0 ? (
              <button
                onClick={() => setCurrent(c => c - 1)}
                className="glass-btn-outline w-12 h-12 rounded-xl flex items-center justify-center
                           font-medium text-base shrink-0"
                aria-label="Föregående fråga"
              >
                ←
              </button>
            ) : (
              <div className="w-12 shrink-0" />
            )}

            <div className="flex-1 flex items-center justify-center">
              <ProgressDots
                total={QUESTIONS.length}
                current={current}
                answers={answers}
                onJump={setCurrent}
              />
            </div>

            <button
              onClick={() =>
                current < QUESTIONS.length - 1
                  ? setCurrent(c => c + 1)
                  : setStep('review')
              }
              disabled={!ans.transcript.trim()}
              className="w-12 h-12 rounded-xl font-semibold text-sm text-white shrink-0
                         transition-all disabled:opacity-30 disabled:cursor-not-allowed
                         flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}
              aria-label={current === QUESTIONS.length - 1 ? 'Granska brief' : 'Nästa fråga'}
            >
              {current === QUESTIONS.length - 1 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : '→'}
            </button>
          </div>

        </div>
      </main>
    </>
  )
}
