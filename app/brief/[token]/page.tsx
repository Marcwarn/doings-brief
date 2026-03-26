'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKGROUNDS = [
  '/bg/bg-06.svg','/bg/bg-08.svg','/bg/bg-10.svg','/bg/bg-12.svg',
  '/bg/bg-14.svg','/bg/bg-16.svg','/bg/bg-18.svg','/bg/bg-20.svg',
]

type Question    = { id: string; text: string; order_index: number }
type AnswerState = { text: string; mode: 'voice' | 'text' | null; status: 'idle'|'recording'|'transcribing'|'done' }

// Pick the first MIME type the browser supports
function getSupportedMime(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

function mimeToExt(mime: string): string {
  if (mime.includes('ogg'))  return 'ogg'
  if (mime.includes('mp4'))  return 'mp4'
  if (mime.includes('mpeg')) return 'mp3'
  return 'webm'
}

// ── Shared background ──────────────────────────────────────────────────────
function Background({ index }: { index: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden' }}>
      {BACKGROUNDS.map((src, i) => (
        <img key={src} src={src} alt="" aria-hidden draggable={false}
             style={{
               position: 'absolute', inset: 0, width: '100%', height: '100%',
               objectFit: 'cover', userSelect: 'none', pointerEvents: 'none',
               opacity: i === index ? 1 : 0,
               transition: 'opacity 1.1s cubic-bezier(0.4,0,0.2,1)',
             }} />
      ))}
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────
const DoingsLogo = () => (
  <svg style={{ width: 36, height: 'auto' }} viewBox="0 0 47.6 45.06" xmlns="http://www.w3.org/2000/svg">
    <path fill="#fff" d="M0,0V25.82H7.82A17.07,17.07,0,0,0,13.36,25a12.59,12.59,0,0,0,3.78-2,10.12,10.12,0,0,0,2.38-2.75,13.29,13.29,0,0,0,1.27-2.89,13.22,13.22,0,0,0,.52-2.5c.07-.75.1-1.28.1-1.58a11.29,11.29,0,0,0-.1-1.59,13.22,13.22,0,0,0-.52-2.5A13.29,13.29,0,0,0,19.52,6.3a10.27,10.27,0,0,0-2.38-2.75A11.1,11.1,0,0,0,14.62,2H29.26A11,11,0,0,0,26.2,4.22a11.84,11.84,0,0,0-2.51,3.92,13.34,13.34,0,0,0-.91,5,13.54,13.54,0,0,0,.91,5,11.83,11.83,0,0,0,2.51,3.94,11.1,11.1,0,0,0,3.86,2.58,13.82,13.82,0,0,0,9.93,0,11,11,0,0,0,5.61-5V30a3.44,3.44,0,0,0-1.2-.66A8,8,0,0,0,42.18,29a5.48,5.48,0,0,0-2.19.39,5,5,0,0,0-1.49,1A3.78,3.78,0,0,0,37.38,33a4,4,0,0,0,.52,2.19,4.18,4.18,0,0,0,1.29,1.29,6.49,6.49,0,0,0,1.68.75c.61.18,1.16.37,1.68.56a5,5,0,0,1,1.29.72,1.53,1.53,0,0,1,.52,1.25,2,2,0,0,1-.26,1,2.49,2.49,0,0,1-.67.74,3.09,3.09,0,0,1-.91.45,3.37,3.37,0,0,1-1,.15,4,4,0,0,1-1.67-.37,3.16,3.16,0,0,1-1.33-1.15L37,41.94a4,4,0,0,0,1.23,1.12H33.68a6.81,6.81,0,0,0,.94-.46v-7H29.56v1.8H32.7v3.94a5.31,5.31,0,0,1-1.55.55,9.57,9.57,0,0,1-1.93.19A5.44,5.44,0,0,1,27,41.67a5.09,5.09,0,0,1-1.74-1.19,5.47,5.47,0,0,1-1.16-1.79,5.89,5.89,0,0,1-.42-2.23,6.51,6.51,0,0,1,.38-2.19,5.19,5.19,0,0,1,2.76-3,5.19,5.19,0,0,1,2.2-.45,6.53,6.53,0,0,1,2.06.33A5,5,0,0,1,33,32.32l1.36-1.46a6,6,0,0,0-2.08-1.35,8.93,8.93,0,0,0-3.2-.49,7.7,7.7,0,0,0-3,.57,7,7,0,0,0-2.33,1.57,7.35,7.35,0,0,0-1.52,2.36,7.75,7.75,0,0,0-.55,2.94,8.16,8.16,0,0,0,.51,2.85,7,7,0,0,0,1.48,2.37,6.8,6.8,0,0,0,1.94,1.38H18.92V29.38H17V41h0L9.16,29.38H6.64V43.06H2V29H0V45.06H47.6V0ZM18.15,8.59a11,11,0,0,1,.92,4.67,11,11,0,0,1-.92,4.66,9,9,0,0,1-2.52,3.25,10.57,10.57,0,0,1-3.77,1.9,16.24,16.24,0,0,1-4.65.62H2.38V2.82H7.21a16.24,16.24,0,0,1,4.65.62,10.57,10.57,0,0,1,3.77,1.9A9,9,0,0,1,18.15,8.59Zm26.21,8.65a9.75,9.75,0,0,1-2,3.31,9.31,9.31,0,0,1-3.16,2.21,11.21,11.21,0,0,1-8.33,0,9.31,9.31,0,0,1-3.16-2.21,9.75,9.75,0,0,1-2-3.31,12,12,0,0,1-.7-4.11A11.86,11.86,0,0,1,25.69,9a9.85,9.85,0,0,1,2-3.31,9.15,9.15,0,0,1,3.16-2.2,11.11,11.11,0,0,1,8.33,0,9.15,9.15,0,0,1,3.16,2.2,9.85,9.85,0,0,1,2,3.31,12.05,12.05,0,0,1,.7,4.12A11.8,11.8,0,0,1,44.36,17.24Zm-.51-13A10.88,10.88,0,0,0,40.79,2H45.6V6.59a11.26,11.26,0,0,0-1.75-2.37ZM42.91,35.7a16.43,16.43,0,0,1-1.68-.54,4.05,4.05,0,0,1-1.29-.78A1.74,1.74,0,0,1,39.42,33a2.07,2.07,0,0,1,.13-.7,1.83,1.83,0,0,1,.45-.71,2.37,2.37,0,0,1,.85-.54,3.78,3.78,0,0,1,1.33-.21,3.26,3.26,0,0,1,1.5.34,2.63,2.63,0,0,1,1,.9l.9-.82v6a3.89,3.89,0,0,0-1-.85,8,8,0,0,0-1.67-.73ZM8.56,31.9h0l7.55,11.16H8.56ZM44.49,43.06a4.87,4.87,0,0,0,.47-.32A4.1,4.1,0,0,0,45.6,42v1Z"/>
  </svg>
)

// ── Modal shell ───────────────────────────────────────────────────────────
function Modal({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', maxWidth: 520,
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      border: '0.5px solid rgba(198,35,104,0.15)',
      boxShadow: '0 24px 64px rgba(198,35,104,0.18), 0 4px 20px rgba(0,0,0,0.08)',
    }}>
      <div style={{ background: '#C62368', padding: '1.6rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
          <DoingsLogo />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
            Brief
          </span>
        </div>
        {header}
      </div>
      <div style={{ padding: '1.8rem 2rem 2rem', background: '#fdf5f7' }}>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff',
  border: '1.5px solid #f0cdd8', borderRadius: 10,
  padding: '12px 14px', fontFamily: 'var(--font-sans)',
  fontSize: 15, color: '#1a1a1a', outline: 'none',
  transition: 'border-color 0.18s', resize: 'none' as const,
  lineHeight: 1.6, display: 'block', boxSizing: 'border-box' as const,
}

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 20px',
  background: '#C62368', color: '#fff', border: 'none', borderRadius: 10,
  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
  letterSpacing: '0.01em', cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(198,35,104,0.22)',
}

// Auto-grow textarea helper — call on ref and on change
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 500) + 'px'
}

// ── Main component ────────────────────────────────────────────────────────
export default function BriefPage() {
  const { token } = useParams<{ token: string }>()
  const sb = createClient()

  const [clientName, setClientName] = useState('')
  const [questions, setQuestions]   = useState<Question[]>([])
  const [answers, setAnswers]       = useState<AnswerState[]>([])
  const [step, setStep]             = useState<'loading'|'intro'|'questions'|'review'|'sending'|'done'|'notfound'>('loading')
  const [current, setCurrent]       = useState(0)
  const [bgIndex, setBgIndex]       = useState(0)
  const [voiceError, setVoiceError] = useState('')

  const mediaRef     = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const mimeRef      = useRef<string>('')
  const rafRef       = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const timerDisplayRef = useRef<HTMLSpanElement | null>(null)

  // Clean up RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function startTimer() {
    startTimeRef.current = Date.now()
    const tick = () => {
      const ms = Date.now() - startTimeRef.current
      const s  = Math.floor(ms / 1000)
      const display = `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
      if (timerDisplayRef.current) timerDisplayRef.current.textContent = display
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function stopTimer() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (timerDisplayRef.current) timerDisplayRef.current.textContent = '00:00'
  }

  useEffect(() => {
    if (!token) return
    sb.from('brief_sessions').select('*, question_sets(id)').eq('token', token).single()
      .then(async ({ data: session }) => {
        if (!session) { setStep('notfound'); return }
        setClientName(session.client_name)
        if (session.status === 'submitted') { setStep('done'); return }
        const qSetId = session.question_set_id
        if (qSetId) {
          const { data: qs } = await sb.from('questions').select('*').eq('question_set_id', qSetId).order('order_index')
          const qList = qs || []
          setQuestions(qList)
          setAnswers(qList.map(() => ({ text: '', mode: null, status: 'idle' })))
          setStep('intro')
        } else { setStep('notfound') }
      })
  }, [token])

  useEffect(() => { setBgIndex(current % BACKGROUNDS.length) }, [current])

  function updateAnswer(i: number, patch: Partial<AnswerState>) {
    setAnswers(a => a.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  async function startRecording(i: number) {
    setVoiceError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = getSupportedMime()
      mimeRef.current = mime
      chunksRef.current = []

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => stream.getTracks().forEach(t => t.stop())
      mr.start(250) // collect chunks every 250ms
      startTimer()
      updateAnswer(i, { status: 'recording', mode: 'voice', text: '' })
    } catch {
      setVoiceError('Kunde inte komma åt mikrofonen. Kontrollera webbläsarbehörigheter och försök igen.')
      updateAnswer(i, { status: 'idle' })
    }
  }

  async function stopRecording(i: number) {
    stopTimer()
    updateAnswer(i, { status: 'transcribing' })
    setVoiceError('')

    // Wait for all data to be flushed — use onstop promise
    await new Promise<void>(resolve => {
      const mr = mediaRef.current
      if (!mr || mr.state === 'inactive') { resolve(); return }
      mr.addEventListener('stop', () => resolve(), { once: true })
      mr.stop()
    })

    // Small extra buffer for final ondataavailable
    await new Promise(r => setTimeout(r, 150))

    if (!chunksRef.current.length) {
      setVoiceError('Ingen ljuddata fångades. Försök igen.')
      updateAnswer(i, { status: 'idle', mode: null })
      return
    }

    const mime = mimeRef.current || 'audio/webm'
    const ext  = mimeToExt(mime)
    const blob = new Blob(chunksRef.current, { type: mime })
    const form = new FormData()
    form.append('file', blob, `recording.${ext}`)
    form.append('model', 'KBLab/kb-whisper-large')

    try {
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const text = (data.text || '').trim()
      updateAnswer(i, { text, status: 'done', mode: 'voice' })
    } catch (err) {
      console.error('Transcription error:', err)
      setVoiceError('Transkribering misslyckades. Skriv ditt svar istället, eller försök igen.')
      updateAnswer(i, { status: 'idle', mode: null })
    }
  }

  async function submit() {
    setStep('sending')
    const payload = questions.map((q, i) => ({
      questionId: q.id, questionText: q.text, orderIndex: q.order_index,
      responseType: answers[i]?.mode || 'text', textContent: answers[i]?.text || '',
    }))
    await fetch('/api/briefs/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, responses: payload }),
    })
    setStep('done')
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf5f7' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C62368', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  )

  // ── Not found ─────────────────────────────────────────────────────────────
  if (step === 'notfound') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <Background index={0} />
      <Modal header={
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, position: 'relative', zIndex: 1 }}>
          Brief hittades inte
        </h1>
      }>
        <p style={{ fontSize: 14, color: '#a0607a', fontFamily: 'var(--font-sans)' }}>
          Länken är ogiltig eller har gått ut.
        </p>
      </Modal>
    </div>
  )

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <Background index={0} />
      <Modal header={
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Tack, {clientName}!
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 300 }}>
            Dina svar har tagits emot.
          </p>
        </div>
      }>
        <p style={{ fontSize: 13.5, color: '#a0607a', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          Vi hör av oss snart!
        </p>
      </Modal>
    </div>
  )

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (step === 'intro') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <Background index={0} />
      <Modal header={
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Hej, {clientName}!
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 300 }}>
            {questions.length} frågor — tar bara några minuter.
          </p>
        </div>
      }>
        <p style={{ fontSize: 14, color: '#6b3348', fontFamily: 'var(--font-sans)', lineHeight: 1.65, marginBottom: 20 }}>
          Du är den viktigaste personen i det här rummet — och det här är ditt tillfälle att sätta tonen för hela projektet. Inga rätta svar. Bara dina.
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0cdd8' }} />
          ))}
        </div>
        <button onClick={() => setStep('questions')} style={primaryBtn}>
          Sätt igång →
        </button>
      </Modal>
    </div>
  )

  // ── Questions ─────────────────────────────────────────────────────────────
  if (step === 'questions') {
    const q = questions[current]
    const a = answers[current]
    const isLast = current === questions.length - 1

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <Background index={bgIndex} />

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 520, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Fråga {current + 1} av {questions.length}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{Math.round(((current + 1) / questions.length) * 100)}%</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#C62368', borderRadius: 99, width: `${((current + 1) / questions.length) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <Modal header={
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>
              Fråga {current + 1}
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 500, color: '#fff', margin: 0, lineHeight: 1.45 }}>
              {q.text}
            </p>
          </div>
        }>

          {/* Error banner */}
          {voiceError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>{voiceError}</p>
            </div>
          )}

          {/* ── Idle: pick mode ── */}
          {a.status === 'idle' && a.mode === null && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => startRecording(current)} style={{
                flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                background: '#C62368', color: '#fff', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(198,35,104,0.28)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 10z" />
                </svg>
                Spela in svar
              </button>
              <button onClick={() => updateAnswer(current, { mode: 'text', status: 'idle' })} style={{
                flex: 1, padding: '14px 0', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid #f0cdd8', background: '#fff',
                fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 500, color: '#6b3348',
              }}>
                Skriv svar
              </button>
            </div>
          )}

          {/* ── Recording ── */}
          {a.status === 'recording' && (
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              {/* Waveform */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 14, height: 44, alignItems: 'center' }}>
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} style={{
                    width: 5, borderRadius: 3, background: '#C62368',
                    height: `${[14,28,40,34,44,26,18][i]}px`,
                    animation: 'bounce 0.6s ease-in-out infinite alternate',
                    animationDelay: `${i * 0.09}s`,
                  }} />
                ))}
              </div>
              {/* Timer */}
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: '#3d1a2e', margin: '0 0 18px', letterSpacing: '-0.02em' }}>
                <span ref={timerDisplayRef}>00:00</span>
              </p>
              <button onClick={() => stopRecording(current)} style={{
                padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#3d1a2e', color: '#fff',
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                boxShadow: '0 4px 12px rgba(61,26,46,0.25)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Stoppa och transkribera
              </button>
            </div>
          )}

          {/* ── Transcribing ── */}
          {a.status === 'transcribing' && (
            <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C62368', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </div>
              <p style={{ fontSize: 14, color: '#a0607a', fontFamily: 'var(--font-sans)', margin: 0 }}>
                Omvandlar till text…
              </p>
            </div>
          )}

          {/* ── Text input ── */}
          {a.mode === 'text' && a.status !== 'recording' && a.status !== 'transcribing' && (
            <AutoGrowTextarea
              value={a.text}
              onChange={val => updateAnswer(current, { text: val, mode: 'text', status: val.trim() ? 'done' : 'idle' })}
              placeholder="Skriv ditt svar här…"
            />
          )}

          {/* ── Voice transcript: auto-growing ── */}
          {a.mode === 'voice' && a.status === 'done' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, color: '#a0607a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10 }}>
                Transkriberat svar — redigera om du vill
              </div>
              <AutoGrowTextarea
                value={a.text}
                onChange={val => updateAnswer(current, { text: val })}
                placeholder="Inget tal fångades — skriv ditt svar här…"
              />
              <button
                onClick={() => { setVoiceError(''); updateAnswer(current, { mode: null, status: 'idle', text: '' }) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#c4909f', textDecoration: 'underline', fontFamily: 'var(--font-sans)', padding: '6px 0 0', display: 'block' }}>
                Spela in igen
              </button>
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {current > 0 && (
              <button onClick={() => { setVoiceError(''); setCurrent(c => c - 1) }} style={{
                padding: '13px 18px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid #f0cdd8', background: '#fff',
                fontFamily: 'var(--font-sans)', fontSize: 14, color: '#6b3348',
              }}>←</button>
            )}
            <button
              onClick={() => { setVoiceError(''); if (isLast) setStep('review'); else setCurrent(c => c + 1) }}
              disabled={a.status === 'recording' || a.status === 'transcribing'}
              style={{ ...primaryBtn, flex: 1, opacity: (a.status === 'recording' || a.status === 'transcribing') ? 0.4 : 1, boxShadow: 'none' }}>
              {a.text?.trim() === '' && a.status !== 'done'
                ? isLast ? 'Hoppa över och granska →' : 'Hoppa över →'
                : isLast ? 'Granska svar →' : 'Nästa fråga →'}
            </button>
          </div>
        </Modal>
      </div>
    )
  }

  // ── Review ────────────────────────────────────────────────────────────────
  if (step === 'review') return (
    <div style={{ minHeight: '100vh', padding: '40px 16px' }}>
      <Background index={0} />
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '0.5px solid rgba(198,35,104,0.15)',
          boxShadow: '0 8px 32px rgba(198,35,104,0.12)', marginBottom: 4,
        }}>
          <div style={{ background: '#C62368', padding: '1.2rem 1.6rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <DoingsLogo />
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Brief</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>Granska dina svar</span>
            </div>
          </div>
        </div>

        {questions.map((q, i) => (
          <div key={q.id} style={{
            background: '#fff', borderRadius: 12, padding: '16px 18px',
            border: '0.5px solid rgba(198,35,104,0.12)',
            boxShadow: '0 2px 12px rgba(198,35,104,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#c4909f', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                Fråga {i + 1}
              </span>
              <button onClick={() => { setCurrent(i); setStep('questions') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#C62368', fontFamily: 'var(--font-sans)', padding: 0, textDecoration: 'underline' }}>
                Ändra
              </button>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#3d1a2e', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>{q.text}</p>
            <p style={{ fontSize: 14, color: '#a0607a', margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap' }}>
              {answers[i]?.text?.trim() || <em style={{ opacity: 0.5 }}>Inget svar</em>}
            </p>
          </div>
        ))}

        <button onClick={submit} style={{ ...primaryBtn, marginTop: 8, padding: '14px 20px', fontSize: 15 }}>
          Skicka in svar →
        </button>
      </div>
    </div>
  )

  // ── Sending ───────────────────────────────────────────────────────────────
  if (step === 'sending') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf5f7' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C62368', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  )

  return null
}

// ── Auto-growing textarea component ───────────────────────────────────────
function AutoGrowTextarea({ value, onChange, placeholder }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow on initial render and whenever value changes
  useEffect(() => { autoGrow(ref.current) }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => { onChange(e.target.value); autoGrow(e.target) }}
      placeholder={placeholder}
      rows={3}
      style={{
        ...inputStyle,
        minHeight: 80,
        overflow: 'hidden',
        marginBottom: 8,
      }}
      onFocus={e => (e.target.style.borderColor = '#C62368')}
      onBlur={e => (e.target.style.borderColor = '#f0cdd8')}
    />
  )
}
