'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

export default function EditQuestionSetPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const sb = createClient()

  const [qs, setQs]           = useState<QuestionSet | null>(null)
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([
      sb.from('question_sets').select('*').eq('id', id).single(),
      sb.from('questions').select('*').eq('question_set_id', id).order('order_index'),
    ]).then(([{ data: set }, { data: qs }]) => {
      if (!set) { router.replace('/dashboard/question-sets'); return }
      setQs(set)
      setName(set.name)
      setDesc(set.description || '')
      setQuestions((qs || []).map((q: Question) => q.text))
      if ((qs || []).length === 0) setQuestions([''])
      setLoading(false)
    })
  }, [id])

  function addQuestion()          { setQuestions(q => [...q, '']) }
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
    // Update question set
    await sb.from('question_sets').update({
      name: name.trim(),
      description: desc.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    // Replace all questions
    await sb.from('questions').delete().eq('question_set_id', id)
    await sb.from('questions').insert(
      filtered.map((text, i) => ({ question_set_id: id, text, order_index: i }))
    )

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <LoadingDots />

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/question-sets" className="text-purple-400 hover:text-purple-700 text-sm transition-colors">
          ← Tillbaka
        </Link>
        <span className="text-purple-200">/</span>
        <h1 className="text-xl font-bold text-[#1e0e2e]">Redigera frågebatteri</h1>
      </div>

      <form onSubmit={save} className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-purple-100 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1.5">Namn *</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                   className="w-full border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-[#1e0e2e]
                              focus:outline-none focus:border-purple-400 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1.5">Beskrivning</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
                   placeholder="Valfri beskrivning"
                   className="w-full border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-[#1e0e2e]
                              focus:outline-none focus:border-purple-400 transition-colors" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-100 p-6">
          <label className="block text-xs font-semibold text-purple-500 uppercase tracking-wide mb-4">
            Frågor ({questions.filter(q => q.trim()).length} st)
          </label>
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-bold text-purple-300 w-5 shrink-0 text-right">{i + 1}</span>
                <input value={q} onChange={e => updateQuestion(i, e.target.value)}
                       placeholder={`Fråga ${i + 1}…`}
                       className="flex-1 border border-purple-200 rounded-xl px-4 py-2.5 text-sm text-[#1e0e2e]
                                  focus:outline-none focus:border-purple-400 transition-colors" />
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)}
                          className="mt-2 text-red-300 hover:text-red-500 p-1 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addQuestion}
                  className="mt-4 text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Lägg till fråga
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          <Link href={`/dashboard/send?set=${id}`}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50
                           hover:bg-purple-100 transition-colors text-center">
            Skicka brief med detta →
          </Link>
          <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: saved ? '#16a34a' : 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
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
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
