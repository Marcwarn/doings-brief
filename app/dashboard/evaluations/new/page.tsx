'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question, type BriefSession, type Profile } from '@/lib/supabase'
import { EvaluationSubnav, InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'
import type { EvaluationQuestionType } from '@/lib/evaluations'

type CreatedPayload = {
  evaluation: {
    id: string
    token: string
    label: string
    customer: string
    questionSetId: string
    questionSetName: string | null
    collectEmail: boolean
    createdAt: string
  }
  publicUrl: string
}

export default function NewEvaluationPage() {
  const sb = createClient()
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [customers, setCustomers] = useState<string[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [customer, setCustomer] = useState('')
  const [questionSetId, setQuestionSetId] = useState('')
  const [questionSetQuery, setQuestionSetQuery] = useState('')
  const [showQuestionSetPicker, setShowQuestionSetPicker] = useState(false)
  const [questionPreview, setQuestionPreview] = useState<Question[]>([])
  const [customQuestionSetName, setCustomQuestionSetName] = useState('')
  const [customQuestions, setCustomQuestions] = useState<{ text: string; type: EvaluationQuestionType }[]>([
    { text: '', type: 'text' },
    { text: '', type: 'text' },
  ])
  const [label, setLabel] = useState('')
  const [collectEmail, setCollectEmail] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedPayload | null>(null)

  const qrUrl = useMemo(() => (
    created ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(created.publicUrl)}` : ''
  ), [created])

  const selectedQuestionSet = questionSets.find(item => item.id === questionSetId) || null
  const filteredQuestionSets = questionSets.filter(item => {
    if (!questionSetQuery.trim()) return true
    const query = questionSetQuery.trim().toLowerCase()
    return `${item.name} ${item.description || ''}`.toLowerCase().includes(query)
  })
  const visibleQuestionSets = filteredQuestionSets.slice(0, questionSetQuery.trim() ? 12 : 8)

  useEffect(() => {
    Promise.all([
      sb.auth.getUser(),
      sb.from('question_sets').select('*').order('updated_at', { ascending: false }),
      sb.from('brief_sessions').select('*').order('created_at', { ascending: false }).limit(200),
    ]).then(async ([{ data: authData }, { data: questionSetRows }, { data: sessionRows }]) => {
      const nextCustomers = Array.from(new Set((sessionRows || [])
        .map((session: BriefSession) => session.client_organisation?.trim() || '')
        .filter(Boolean)))

      const userId = authData.user?.id
      if (userId) {
        const { data: nextProfile } = await sb.from('profiles').select('*').eq('id', userId).single()
        setProfile(nextProfile || null)
      }

      setQuestionSets(questionSetRows || [])
      setCustomers(nextCustomers)
      setLoading(false)
    }).catch(() => {
      setError('Kunde inte läsa grunddata för utvärderingen.')
      setLoading(false)
    })
  }, [sb])

  useEffect(() => {
    if (!questionSetId) {
      setQuestionPreview([])
      return
    }

    sb.from('questions').select('*').eq('question_set_id', questionSetId).order('order_index')
      .then(({ data }) => setQuestionPreview(data || []))
  }, [questionSetId, sb])

  useEffect(() => {
    if (!customQuestionSetName.trim() && label.trim()) {
      setCustomQuestionSetName(`${label.trim()} · Frågor`)
    }
  }, [label, customQuestionSetName])

  function updateCustomQuestion(index: number, value: string) {
    setCustomQuestions(prev => prev.map((question, questionIndex) => (
      questionIndex === index ? { ...question, text: value } : question
    )))
  }

  function updateCustomQuestionType(index: number, type: EvaluationQuestionType) {
    setCustomQuestions(prev => prev.map((question, questionIndex) => (
      questionIndex === index ? { ...question, type } : question
    )))
  }

  function addCustomQuestion() {
    setCustomQuestions(prev => [...prev, { text: '', type: 'text' }])
  }

  function removeCustomQuestion(index: number) {
    setCustomQuestions(prev => prev.length <= 1 ? prev : prev.filter((_, questionIndex) => questionIndex !== index))
  }

  async function selectQuestionSetSource(setId: string) {
    const selected = questionSets.find(item => item.id === setId) || null
    setQuestionSetId(setId)
    setQuestionSetQuery('')
    setShowQuestionSetPicker(false)

    const { data } = await sb.from('questions').select('*').eq('question_set_id', setId).order('order_index')
    const nextQuestions = data || []
    setQuestionPreview(nextQuestions)
    setCustomQuestionSetName(prev => prev.trim() ? prev : `${selected?.name || 'Importerade frågor'} · kopia`)
    setCustomQuestions(nextQuestions.length > 0
      ? nextQuestions.map(question => ({ text: question.text, type: 'text' as const }))
      : [{ text: '', type: 'text' }, { text: '', type: 'text' }])
  }

  function importSelectedQuestionSetAgain() {
    if (!questionSetId || questionPreview.length === 0) {
      setError('Välj ett frågebatteri först om du vill importera det.')
      return
    }

    setError(null)
    setCustomQuestionSetName(prev => prev.trim() ? prev : `${selectedQuestionSet?.name || 'Importerade frågor'} · kopia`)
    setCustomQuestions(questionPreview.map(question => ({ text: question.text, type: 'text' })))
  }

  async function createEvaluation(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const filteredCustomQuestions = customQuestions
      .map(item => ({ text: item.text.trim(), type: item.type }))
      .filter(item => item.text)

    if (!customer.trim() || !label.trim()) {
      setError('Fyll i kund och namn på tillfälle.')
      return
    }

    if (!customQuestionSetName.trim()) {
      setError('Ge frågorna ett namn innan du skapar utvärderingen.')
      return
    }

    if (filteredCustomQuestions.length === 0) {
      setError('Lägg till minst en fråga i utvärderingen.')
      return
    }

    setSaving(true)
    const response = await fetch('/api/evaluations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customer.trim(),
        questionSetId,
        label: label.trim(),
        collectEmail,
        customQuestionSetName: customQuestionSetName.trim(),
        customQuestions: filteredCustomQuestions,
      }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error || 'Kunde inte skapa utvärderingen.')
      setSaving(false)
      return
    }

    setCreated(payload)
    setSaving(false)
  }

  async function downloadQrPng() {
    if (!created || !qrUrl) return

    const response = await fetch(qrUrl)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `${slugify(created.evaluation.label)}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 980, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
          Skapa utvärdering
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6, maxWidth: 700 }}>
          Välj kund, formulera frågorna och skapa sedan en publik länk med QR-kod för deltagarna.
        </p>
      </div>

      <EvaluationSubnav active="new" />

      {error && <InlineError text={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: created ? '1fr 0.9fr' : '1fr', gap: 20 }}>
        <form onSubmit={createEvaluation} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Kund">
            <>
              <input
                list="evaluation-customers"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Till exempel Mojang"
                style={inputStyle}
              />
              <datalist id="evaluation-customers">
                {customers.map(item => <option key={item} value={item} />)}
              </datalist>
            </>
          </Field>

          <Field label="Frågebatteri">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: showQuestionSetPicker ? 10 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Hämta från frågebatteri</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      Välj ett befintligt batteri om du vill använda det som startpunkt.
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowQuestionSetPicker(prev => !prev)} style={ghostButtonStyle}>
                    {selectedQuestionSet ? 'Byt källa' : 'Välj frågebatteri'}
                  </button>
                </div>

                {selectedQuestionSet && !showQuestionSetPicker && (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{selectedQuestionSet.name}</div>
                      {selectedQuestionSet.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{selectedQuestionSet.description}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Aktiv källa
                    </div>
                  </div>
                )}

                {showQuestionSetPicker && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    <input
                      value={questionSetQuery}
                      onChange={e => setQuestionSetQuery(e.target.value)}
                      placeholder="Sök frågebatteri"
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
                      {visibleQuestionSets.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { void selectQuestionSetSource(item.id) }}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 14px',
                            borderRadius: 7,
                            cursor: 'pointer',
                            border: `1.5px solid ${questionSetId === item.id ? 'var(--accent)' : 'var(--border)'}`,
                            background: questionSetId === item.id ? 'var(--accent-dim)' : 'var(--surface)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                            {item.description && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.description}</div>}
                          </div>
                        </button>
                      ))}
                      {visibleQuestionSets.length === 0 && (
                        <div style={{ padding: '12px 14px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-3)' }}>
                          Inga frågebatterier matchar din sökning.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Namn på frågebatteri">
                  <input
                    value={customQuestionSetName}
                    onChange={e => setCustomQuestionSetName(e.target.value)}
                    placeholder="Till exempel Ledarutbildning Malmö · Frågor"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>Egna frågor</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedQuestionSet && (
                      <button type="button" onClick={importSelectedQuestionSetAgain} style={ghostButtonStyle}>
                        Hämta in källan igen
                      </button>
                    )}
                    <button type="button" onClick={addCustomQuestion} style={ghostButtonStyle}>
                      Lägg till fråga
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customQuestions.map((question, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          rows={2}
                          value={question.text}
                          onChange={e => updateCustomQuestion(index, e.target.value)}
                          placeholder={`Fråga ${index + 1}`}
                          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                        />
                        <select
                          value={question.type}
                          onChange={e => updateCustomQuestionType(index, e.target.value === 'scale_1_5' ? 'scale_1_5' : 'text')}
                          style={inputStyle}
                        >
                          <option value="text">Fritext</option>
                          <option value="scale_1_5">Skala 1–5</option>
                        </select>
                      </div>
                      <button type="button" onClick={() => removeCustomQuestion(index)} style={smallDeleteStyle}>
                        Ta bort
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Field>

          <Field label="Namn på tillfälle">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ledarutbildning Malmö 27 mars"
              style={inputStyle}
            />
          </Field>

          {profile?.role === 'admin' && (
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              <input
                type="checkbox"
                checked={collectEmail}
                onChange={e => setCollectEmail(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Samla in deltagarnas e-post sist
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  Stäng av om utvärderingen ska vara helt anonym.
                </div>
              </div>
            </label>
          )}

          <button type="submit" disabled={saving} style={submitButtonStyle(saving)}>
            {saving ? 'Skapar…' : 'Skapa länk och QR-kod'}
          </button>
        </form>

        {created && (
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '22px 24px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              {created.evaluation.label}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16 }}>
              {created.evaluation.customer} · {created.evaluation.questionSetName || 'Frågebatteri'}
              <span style={{ marginLeft: 6 }}>
                · {created.evaluation.collectEmail ? 'E-post samlas in' : 'Helt anonym'}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 14px 12px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Länk till deltagarna
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text)', wordBreak: 'break-all' }}>{created.publicUrl}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <img src={qrUrl} alt="QR-kod för utvärdering" style={{ width: 220, height: 220, objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => navigator.clipboard.writeText(created.publicUrl)} style={ghostButtonStyle}>
                  Kopiera länk
                </button>
                <button type="button" onClick={() => void downloadQrPng()} style={ghostButtonStyle}>
                  Ladda ner QR som PNG
                </button>
                <Link href={`/dashboard/evaluations/${created.evaluation.id}`} style={secondaryLinkStyle}>
                  Öppna utvärdering
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </label>
  )
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'utvardering'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  fontSize: 13.5,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

function submitButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 0',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: disabled ? 'var(--bg)' : 'var(--surface)',
    color: disabled ? 'var(--text-3)' : 'var(--text)',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const ghostButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

const smallDeleteStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-3)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryLinkStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 12.5,
  fontWeight: 700,
}
