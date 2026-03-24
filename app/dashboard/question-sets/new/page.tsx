'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13.5, color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s',
}

export default function NewQuestionSetPage() {
  const router = useRouter()
  const sb = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions]     = useState<string[]>(['', ''])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // AI generation
  const [aiTopic, setAiTopic]     = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState('')

  // Voice input
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')

  function addQuestion() { setQuestions(q => [...q, '']) }
  function removeQuestion(i: number) { setQuestions(q => q.filter((_, idx) => idx !== i)) }
  function updateQuestion(i: number, val: string) {
    setQuestions(q => q.map((x, idx) => idx === i ? val : x))
  }

  // ── AI generate ──────────────────────────────────────────────────────────────
  async function generateQuestions() {
    if (!aiTopic.trim()) return
    setAiLoading(true); setAiError('')
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, count: 6 }),
      })
      const { questions: generated, error: apiErr } = await res.json()
      if (apiErr || !generated?.length) {
        setAiError('Kunde inte generera frågor — försök igen.')
        return
      }
      // Append to any existing non-empty questions
      const existing = questions.filter(q => q.trim())
      setQuestions([...existing, ...generated])
      setAiTopic('')
    } catch {
      setAiError('Nätverksfel — försök igen.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── File import ──────────────────────────────────────────────────────────────
  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text
        .split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•;"]\s*/, '').trim())
        .filter(l => l.length > 3)
      if (!lines.length) return
      const existing = questions.filter(q => q.trim())
      setQuestions([...existing, ...lines])
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Voice input ──────────────────────────────────────────────────────────────
  async function startVoice() {
    setVoiceStatus('recording')
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => stream.getTracks().forEach(t => t.stop())
      mr.start()
    } catch {
      setVoiceStatus('idle')
    }
  }

  async function stopVoice() {
    setVoiceStatus('transcribing')
    mediaRef.current?.stop()
    await new Promise(r => setTimeout(r, 300))
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')
    form.append('model', 'KBLab/kb-whisper-large')
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      const { text } = await res.json()
      if (text?.trim()) {
        // Clean up trailing punctuation added by Whisper, then add as question
        const clean = text.trim().replace(/[.。]$/, '').trim()
        const existing = questions.filter(q => q.trim())
        setQuestions([...existing, clean])
      }
    } catch { /* silently ignore */ }
    setVoiceStatus('idle')
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function save(e: React.FormEvent) {
    e.preventDefault()
    const filtered = questions.filter(q => q.trim())
    if (!name.trim()) { setError('Ge batteriet ett namn.'); return }
    if (filtered.length < 1) { setError('Lägg till minst en fråga.'); return }

    setSaving(true); setError('')
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data: qs, error: qsErr } = await sb
      .from('question_sets')
      .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null })
      .select().single()

    if (qsErr || !qs) {
      setError(`Kunde inte spara: ${qsErr?.message || 'okänt fel'}`)
      setSaving(false); return
    }

    await sb.from('questions').insert(
      filtered.map((text, i) => ({ question_set_id: qs.id, text, order_index: i }))
    )
    router.replace(`/dashboard/question-sets/${qs.id}`)
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 700, animation: 'fadeUp 0.35s ease both' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/question-sets" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Frågebatterier</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>Nytt batteri</span>
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 32px' }}>
        Nytt frågebatteri
      </h1>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Name + description */}
        <Section>
          <Field label="Namn *">
            <input value={name} onChange={e => setName(e.target.value)}
                   placeholder="T.ex. Inledande kundintervju" required autoFocus
                   style={F}
                   onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                   onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
          </Field>
          <Field label="Beskrivning (valfri)">
            <input value={description} onChange={e => setDescription(e.target.value)}
                   placeholder="Kort beskrivning av när det används"
                   style={F}
                   onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                   onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
          </Field>
        </Section>

        {/* AI generation */}
        <Section>
          <SectionLabel>Generera frågor med AI</SectionLabel>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0, lineHeight: 1.55 }}>
            Beskriv vad du vill ta reda på — AI:n föreslår frågor som du kan redigera.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <textarea
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generateQuestions() } }}
              placeholder="T.ex. ledarskapsförmåga och delegering, förändringsvilja inför en ny strategi, teamdynamik i ett litet bolag…"
              rows={3}
              style={{ ...F, resize: 'vertical', flex: 1 }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }}
            />
          </div>
          <button
            type="button"
            onClick={generateQuestions}
            disabled={aiLoading || !aiTopic.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '9px 18px', borderRadius: 7, border: 'none',
              background: aiLoading || !aiTopic.trim() ? 'rgba(198,35,104,0.35)' : 'var(--accent)',
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.01em', color: '#fff', cursor: aiLoading || !aiTopic.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {aiLoading ? (
              <>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'bounce 0.8s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />)}
                </span>
                Genererar…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
                </svg>
                Generera frågor
              </>
            )}
          </button>
          {aiError && (
            <p style={{ fontSize: 12.5, color: '#dc2626', margin: 0 }}>{aiError}</p>
          )}
        </Section>

        {/* Questions */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <SectionLabel>Frågor ({questions.filter(q => q.trim()).length})</SectionLabel>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* File import */}
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={importFile}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Importera fil
              </button>
              {/* Voice input */}
              {voiceStatus === 'idle' && (
                <button
                  type="button"
                  onClick={startVoice}
                  style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h-4v-2.08A7 7 0 0 1 5 10z"/>
                  </svg>
                  Prata in fråga
                </button>
              )}
              {voiceStatus === 'recording' && (
                <button
                  type="button"
                  onClick={stopVoice}
                  style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid #dc2626', background: '#fef2f2',
                    fontSize: 12, color: '#dc2626', fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    animation: 'pulse 1.2s ease-in-out infinite',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#dc2626"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  Stoppa inspelning
                </button>
              )}
              {voiceStatus === 'transcribing' && (
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'bounce 0.8s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />)}
                  Transkriberar…
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <input value={q} onChange={e => updateQuestion(i, e.target.value)}
                       placeholder={`Fråga ${i + 1}…`}
                       style={{ ...F, flex: 1, width: 'auto' }}
                       onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                       onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addQuestion}
                  style={{
                    marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: 'var(--accent)', fontWeight: 600, padding: 0,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-sans)',
                  }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Lägg till fråga
          </button>

          {/* File format hint */}
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
            Importera .txt eller .csv — en fråga per rad. Numrering rensas automatiskt.
          </p>
        </Section>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 7, border: '1px solid #fecaca' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Link href="/dashboard/question-sets" style={{
            flex: 1, padding: '11px 0', borderRadius: 7, textAlign: 'center',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'none',
          }}>
            Avbryt
          </Link>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 7, border: 'none',
            background: saving ? 'rgba(198,35,104,0.5)' : 'var(--accent)',
            fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700,
            letterSpacing: '0.01em', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(198,35,104,0.22)',
          }}>
            {saving ? 'Sparar…' : 'Spara frågebatteri'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
      border: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
