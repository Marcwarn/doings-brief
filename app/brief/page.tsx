'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ──────────────────────────────────────────────
// Questions
// ──────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1,
    label: 'Om er organisation',
    question: 'Berätta kort om er organisation — vad ni gör och vad ni står för.',
  },
  {
    id: 2,
    label: 'Utmaningen',
    question: 'Vad är den utmaning eller möjlighet som ligger bakom det här uppdraget?',
  },
  {
    id: 3,
    label: 'Målet',
    question: 'Vad vill ni uppnå? Beskriv vad framgång ser ut för er.',
  },
  {
    id: 4,
    label: 'Målgruppen',
    question: 'Vem är er målgrupp — vilka ska påverkas eller nås av det ni vill göra?',
  },
  {
    id: 5,
    label: 'Tidsplan',
    question: 'Finns det en tidsplan, deadline eller viktiga datum vi bör känna till?',
  },
  {
    id: 6,
    label: 'Budget',
    question: 'Vad är er ungefärliga budget för det här uppdraget?',
  },
  {
    id: 7,
    label: 'Övrigt',
    question:
      'Är det något mer ni vill att vi ska veta om er, uppdraget eller vad ni önskar er av samarbetet?',
  },
]

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type AnswerState = {
  transcript: string
  audioBlob: Blob | null
  status: 'idle' | 'recording' | 'transcribing' | 'done'
}

type Step = 'brief' | 'review' | 'sending' | 'done'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ──────────────────────────────────────────────
// Main page component
// ──────────────────────────────────────────────
export default function BriefPage() {
  const router = useRouter()

  // Auth
  useEffect(() => {
    const token = sessionStorage.getItem('brief_auth')
    if (!token) router.replace('/')
  }, [router])

  const [step, setStep] = useState<Step>('brief')
  const [current, setCurrent] = useState(0) // question index
  const [answers, setAnswers] = useState<AnswerState[]>(
    QUESTIONS.map(() => ({ transcript: '', audioBlob: null, status: 'idle' }))
  )
  const [clientName, setClientName] = useState('')
  const [sendError, setSendError] = useState('')

  // Recording state for current question
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef(0)

  const q = QUESTIONS[current]
  const ans = answers[current]

  // ── Scroll to top on question change ──
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [current])

  // ── Update single answer ──
  const updateAnswer = useCallback((idx: number, patch: Partial<AnswerState>) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }, [])

  // ── Start recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        handleTranscribe(blob)
      }

      recorder.start(250)
      setIsRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current)
      }, 500)

      updateAnswer(current, { status: 'recording', audioBlob: null, transcript: '' })
    } catch (err) {
      console.error('Mic error:', err)
      alert('Kunde inte komma åt mikrofonen. Kontrollera att du har gett tillstånd.')
    }
  }

  // ── Stop recording ──
  function stopRecording() {
    recorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setElapsed(0)
    updateAnswer(current, { status: 'transcribing' })
  }

  // ── Transcribe via Berget AI ──
  async function handleTranscribe(blob: Blob) {
    const MAX_BYTES = 4 * 1024 * 1024
    const formData = new FormData()
    formData.append('file', blob, 'audio.webm')
    formData.append('model', 'KBLab/kb-whisper-large')

    try {
      // If blob > 4MB, warn but try anyway (short answers will be fine)
      if (blob.size > MAX_BYTES) {
        console.warn('Audio is large:', (blob.size / 1024 / 1024).toFixed(1) + 'MB')
      }

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      updateAnswer(current, {
        transcript: data.text || '',
        audioBlob: blob,
        status: 'done',
      })
    } catch (err) {
      console.error('Transcription error:', err)
      updateAnswer(current, {
        transcript: '',
        audioBlob: blob,
        status: 'done',
      })
      alert('Transkribering misslyckades. Du kan skriva svaret manuellt.')
    }
  }

  // ── Navigate questions ──
  function goNext() {
    if (current < QUESTIONS.length - 1) setCurrent(c => c + 1)
    else setStep('review')
  }
  function goPrev() {
    if (current > 0) setCurrent(c => c - 1)
  }

  // ── Send brief ──
  async function sendBrief() {
    setStep('sending')
    setSendError('')
    try {
      const payload = {
        clientName,
        answers: QUESTIONS.map((q, i) => ({
          question: q.question,
          label: q.label,
          answer: answers[i].transcript,
        })),
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Send failed')
      setStep('done')
    } catch (err) {
      console.error(err)
      setSendError('Det gick inte att skicka briefen. Försök igen.')
      setStep('review')
    }
  }

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────

  const progress = ((current + 1) / QUESTIONS.length) * 100
  const allAnswered = answers.every(a => a.transcript.trim().length > 0)

  // ── DONE screen ──
  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-doings-bg px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 text-center slide-in">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-doings-purple-dark mb-3">
            Tack! Briefen är skickad.
          </h1>
          <p className="text-doings-muted text-sm">
            Vi återkommer till dig inom kort. Ha det fint!
          </p>
          <p className="mt-6 text-xs text-doings-muted">
            <a href="mailto:marcus.warn@doings.se" className="underline">
              marcus.warn@doings.se
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── REVIEW screen ──
  if (step === 'review' || step === 'sending') {
    return (
      <div className="min-h-screen bg-doings-bg py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
            >D</div>
            <span className="font-semibold text-doings-purple-dark">Doings Brief</span>
          </div>

          <h1 className="text-2xl font-bold text-doings-purple-dark mb-2">Granska din brief</h1>
          <p className="text-doings-muted text-sm mb-8">
            Kolla igenom dina svar nedan. Du kan gå tillbaka och ändra om något inte stämmer.
          </p>

          {/* Client name */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <label className="block text-xs font-semibold text-doings-purple uppercase tracking-wide mb-2">
              Ditt namn / organisation
            </label>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Namn eller företagsnamn (valfritt)"
              className="w-full border border-doings-purple-light rounded-xl px-4 py-2 text-sm
                         focus:outline-none focus:border-doings-purple transition-colors"
            />
          </div>

          {/* Answers */}
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
                <button
                  onClick={() => { setCurrent(i); setStep('brief') }}
                  className="shrink-0 text-xs text-doings-purple underline mt-6 hover:no-underline"
                >
                  Ändra
                </button>
              </div>
            </div>
          ))}

          {sendError && (
            <p className="text-red-500 text-sm text-center mb-4">{sendError}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setCurrent(QUESTIONS.length - 1); setStep('brief') }}
              className="flex-1 py-3 rounded-xl font-semibold border-2 border-doings-purple-light
                         text-doings-purple hover:bg-doings-purple-pale transition-colors"
            >
              ← Tillbaka
            </button>
            <button
              onClick={sendBrief}
              disabled={step === 'sending'}
              className="flex-2 flex-grow py-3 rounded-xl font-semibold text-white transition-all
                         disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
            >
              {step === 'sending' ? 'Skickar…' : 'Skicka briefen ✓'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── BRIEF (question) screen ──
  return (
    <div className="min-h-screen bg-doings-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 bg-white border-b border-doings-purple-light/50">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
        >D</div>
        <span className="font-semibold text-doings-purple-dark text-sm">Doings Brief</span>
        <span className="ml-auto text-xs text-doings-muted">
          {current + 1} / {QUESTIONS.length}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-doings-purple-light">
        <div
          className="h-1 transition-all duration-500"
          style={{ width: `${progress}%`, background: '#6b2d82' }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg slide-in" key={current}>
          {/* Question */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: 'linear-gradient(135deg, #1e0e2e, #3d1a47)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60 text-white">
              Fråga {current + 1} · {q.label}
            </span>
            <p className="text-white text-lg font-medium mt-2 leading-relaxed">
              {q.question}
            </p>
          </div>

          {/* Recorder */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            {/* Idle / done state */}
            {!isRecording && ans.status !== 'transcribing' && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full flex items-center justify-center
                             text-white shadow-lg shadow-doings-purple/30 hover:scale-105
                             active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
                  title="Spela in svar"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 12z"/>
                  </svg>
                </button>
                <p className="text-sm text-doings-muted">
                  {ans.status === 'done' ? 'Spela in igen' : 'Tryck för att svara med rösten'}
                </p>
              </div>
            )}

            {/* Recording state */}
            {isRecording && (
              <div className="flex flex-col items-center gap-4">
                {/* Waveform animation */}
                <div className="flex items-center gap-1 h-10">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="wave-bar" />
                  ))}
                </div>
                <p className="text-doings-purple font-semibold text-sm">
                  {formatTime(elapsed)} · Spelar in…
                </p>
                <button
                  onClick={stopRecording}
                  className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all
                             hover:opacity-90"
                  style={{ background: '#e8304a' }}
                >
                  ■ Stoppa inspelning
                </button>
              </div>
            )}

            {/* Transcribing state */}
            {ans.status === 'transcribing' && !isRecording && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex gap-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-doings-muted">Transkriberar…</p>
              </div>
            )}

            {/* Transcript result */}
            {ans.status === 'done' && ans.transcript && (
              <div className="mt-4 border-t border-doings-purple-light/50 pt-4">
                <p className="text-xs font-semibold text-doings-purple uppercase tracking-wide mb-2">
                  Ditt svar:
                </p>
                <textarea
                  value={ans.transcript}
                  onChange={e => updateAnswer(current, { transcript: e.target.value })}
                  rows={4}
                  className="w-full border border-doings-purple-light rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:border-doings-purple transition-colors resize-none"
                />
              </div>
            )}

            {/* Manual text fallback */}
            {ans.status === 'idle' && (
              <div className="mt-4 border-t border-doings-purple-light/50 pt-4">
                <p className="text-xs text-doings-muted mb-2">
                  Föredrar du att skriva?
                </p>
                <textarea
                  value={ans.transcript}
                  onChange={e => updateAnswer(current, {
                    transcript: e.target.value,
                    status: e.target.value ? 'done' : 'idle',
                  })}
                  rows={3}
                  placeholder="Skriv ditt svar här…"
                  className="w-full border border-doings-purple-light rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:border-doings-purple transition-colors resize-none"
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {current > 0 && (
              <button
                onClick={goPrev}
                className="flex-1 py-3 rounded-xl font-semibold border-2 border-doings-purple-light
                           text-doings-purple hover:bg-doings-purple-pale transition-colors text-sm"
              >
                ← Föregående
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!ans.transcript.trim()}
              className="flex-1 py-3 rounded-xl font-semibold text-white transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
            >
              {current === QUESTIONS.length - 1 ? 'Granska brief →' : 'Nästa fråga →'}
            </button>
          </div>

          {/* Question dots */}
          <div className="flex justify-center gap-2 mt-6">
            {QUESTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  background: i === current ? '#6b2d82' : answers[i].transcript ? '#e8d9f0' : '#d1d5db',
                  transform: i === current ? 'scale(1.4)' : 'scale(1)',
                }}
                title={`Fråga ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
