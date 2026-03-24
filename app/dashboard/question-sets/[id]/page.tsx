'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

export default function EditQuestionSetPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sb = createClient()

  const [qs, setQs]               = useState<QuestionSet | null>(null)
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
      setQs(set)
      setName(set.name)
      setDesc(set.description || '')
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
    await sb.from('question_sets').update({
      name: name.trim(),
      description: desc.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await sb.from('questions').delete().eq('question_set_id', id)
    await sb.from('questions').insert(
      filtered.map((text, i) => ({ question_set_id: id, text, order_index: i }))
    )

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/question-sets" className="text-sm transition-colors" style={{ color: '#a0607a' }}>
          ← Tillbaka
        </Link>
        <span style={{ color: '#f0cdd8' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>Redigera frågebatteri</h1>
      </div>

      <form onSubmit={save} className="flex flex-col gap-6">
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#a0607a' }}>Namn *</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                   style={inputStyle}
                   onFocus={e => (e.target.style.borderColor = '#C62368')}
                   onBlur={e => (e.target.style.borderColor = '#f0cdd8')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#a0607a' }}>Beskrivning</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
                   placeholder="Valfri beskrivning"
                   style={inputStyle}
                   onFocus={e => (e.target.style.borderColor = '#C62368')}
                   onBlur={e => (e.target.style.borderColor = '#f0cdd8')} />
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #f0cdd8' }}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#a0607a' }}>
            Frågor ({questions.filter(q => q.trim()).length} st)
          </label>
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-bold w-5 shrink-0 text-right" style={{ color: '#c4909f' }}>{i + 1}</span>
                <input value={q} onChange={e => updateQuestion(i, e.target.value)}
                       placeholder={`Fråga ${i + 1}…`}
                       style={{ ...inputStyle, width: undefined, flex: 1 } as React.CSSProperties}
                       onFocus={e => (e.target.style.borderColor = '#C62368')}
                       onBlur={e => (e.target.style.borderColor = '#f0cdd8')} />
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)}
                          className="mt-2 p-1 transition-colors" style={{ color: '#dc2626' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addQuestion}
                  className="mt-4 text-xs font-medium transition-colors flex items-center gap-1"
                  style={{ color: '#C62368' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Lägg till fråga
          </button>
        </div>

        {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}

        <div className="flex gap-3">
          <Link href={`/dashboard/send?set=${id}`}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-colors"
                style={{ color: '#C62368', background: '#fdf5f7' }}>
            Skicka brief med detta →
          </Link>
          <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: saved ? '#16a34a' : '#C62368' }}>
            {saving ? 'Sparar…' : saved ? '✓ Sparat!' : 'Spara ändringar'}
          </button>
        </div>
      </form>
    </div>
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
