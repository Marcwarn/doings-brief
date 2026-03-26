'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13.5, color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s',
}

export default function EditQuestionSetPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const sb = createClient()

  const [name, setName]           = useState('')
  const [desc, setDesc]           = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([
      sb.from('question_sets').select('*').eq('id', id).single(),
      sb.from('questions').select('*').eq('question_set_id', id).order('order_index'),
    ]).then(([{ data: set }, { data: qlist }]) => {
      if (!set) { router.replace('/dashboard/question-sets'); return }
      setName(set.name); setDesc(set.description || '')
      setQuestions((qlist || []).map((q: Question) => q.text))
      if ((qlist || []).length === 0) setQuestions([''])
      setLoading(false)
    })
  }, [id])

  function addQuestion()             { setQuestions(q => [...q, '']) }
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
    await sb.from('question_sets').update({ name: name.trim(), description: desc.trim() || null, updated_at: new Date().toISOString() }).eq('id', id)
    await sb.from('questions').delete().eq('question_set_id', id)
    await sb.from('questions').insert(filtered.map((text, i) => ({ question_set_id: id, text, order_index: i })))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 700, animation: 'fadeUp 0.35s ease both' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/question-sets" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Frågebatterier</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>Redigera</span>
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 32px' }}>
        Redigera frågebatteri
      </h1>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Section>
          <Field label="Namn *">
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                   style={F}
                   onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                   onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
          </Field>
          <Field label="Beskrivning">
            <input value={desc} onChange={e => setDesc(e.target.value)}
                   placeholder="Valfri beskrivning" style={F}
                   onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                   onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
          </Field>
        </Section>

        <Section>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 4 }}>
            Frågor ({questions.filter(q => q.trim()).length})
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
                  style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Lägg till fråga
          </button>
        </Section>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 7, border: '1px solid #fecaca' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Link href={`/dashboard/send?set=${id}`} style={{
            flex: 1, padding: '11px 0', borderRadius: 7, textAlign: 'center',
            border: '1px solid var(--border)', background: 'var(--surface)',
            fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'none',
          }}>
            Skicka brief →
          </Link>
          <button type="submit" disabled={saving} style={{
            flex: 2, padding: '11px 0', borderRadius: 7, border: '1px solid var(--border)',
            background: saved ? '#f0fdf4' : saving ? 'var(--bg)' : 'var(--surface)',
            fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700,
            letterSpacing: '0.01em', color: saved ? '#166534' : saving ? 'var(--text-3)' : 'var(--text)',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, border-color 0.15s',
          }}>
            {saving ? 'Sparar…' : saved ? 'Sparat!' : 'Spara ändringar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
