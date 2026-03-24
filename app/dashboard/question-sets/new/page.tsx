'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid #e5e7eb', background: '#fff',
  fontSize: 13.5, color: '#111', outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'border-color 0.15s',
}

export default function NewQuestionSetPage() {
  const router = useRouter()
  const sb = createClient()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions]     = useState<string[]>(['', ''])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  function addQuestion() { setQuestions(q => [...q, '']) }
  function removeQuestion(i: number) { setQuestions(q => q.filter((_, idx) => idx !== i)) }
  function updateQuestion(i: number, val: string) {
    setQuestions(q => q.map((x, idx) => idx === i ? val : x))
  }

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
    <div style={{ padding: '36px 40px', maxWidth: 680, fontFamily: 'DM Sans, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
        <Link href="/dashboard/question-sets" style={{ color: '#9ca3af', textDecoration: 'none' }}>Frågebatterier</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ color: '#111', fontWeight: 500 }}>Nytt batteri</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: '0 0 28px' }}>Nytt frågebatteri</h1>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name + description */}
        <Section>
          <Field label="Namn *">
            <input value={name} onChange={e => setName(e.target.value)}
                   placeholder="T.ex. Inledande kundintervju" required autoFocus
                   style={F}
                   onFocus={e => (e.target.style.borderColor = '#C62368')}
                   onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          </Field>
          <Field label="Beskrivning (valfri)">
            <input value={description} onChange={e => setDescription(e.target.value)}
                   placeholder="Kort beskrivning av när det används"
                   style={F}
                   onFocus={e => (e.target.style.borderColor = '#C62368')}
                   onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          </Field>
        </Section>

        {/* Questions */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Frågor ({questions.filter(q => q.trim()).length})
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#d1d5db', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <input value={q} onChange={e => updateQuestion(i, e.target.value)}
                       placeholder={`Fråga ${i + 1}…`}
                       style={{ ...F, flex: 1, width: 'auto' }}
                       onFocus={e => (e.target.style.borderColor = '#C62368')}
                       onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d1d5db' }}>
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
                    fontSize: 13, color: '#C62368', fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Lägg till fråga
          </button>
        </Section>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Link href="/dashboard/question-sets" style={{
            flex: 1, padding: '11px 0', borderRadius: 8, textAlign: 'center',
            border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 13.5, fontWeight: 500, color: '#374151', textDecoration: 'none',
          }}>
            Avbryt
          </Link>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 8,
            background: saving ? '#e08aaa' : '#C62368', border: 'none',
            fontSize: 13.5, fontWeight: 500, color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 2px 8px rgba(198,35,104,0.22)',
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
      background: '#fff', borderRadius: 12, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
