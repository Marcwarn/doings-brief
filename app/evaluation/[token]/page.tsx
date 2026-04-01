'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type EvaluationQuestion = {
  id: string
  text: string
  order_index: number
  type: 'text' | 'scale_1_5'
}

type PublicPayload = {
  evaluation: {
    label: string
    customer: string
    collectEmail: boolean
  }
  questions: EvaluationQuestion[]
}

export default function EvaluationPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [payload, setPayload] = useState<PublicPayload | null>(null)
  const [step, setStep] = useState<'loading' | 'intro' | 'questions' | 'done' | 'notfound'>('loading')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/evaluations/public/${token}`)
      .then(async response => {
        const nextPayload = await response.json().catch(() => null)
        if (!response.ok || !nextPayload?.questions) {
          setStep('notfound')
          return
        }
        setPayload(nextPayload)
        setAnswers((nextPayload.questions || []).map(() => ''))
        setStep('intro')
      })
      .catch(() => setStep('notfound'))
  }, [token])

  const question = useMemo(() => payload?.questions[current] || null, [payload, current])
  const isLast = payload ? current === payload.questions.length - 1 : false
  const isScaleQuestion = question?.type === 'scale_1_5'

  async function submit() {
    if (!payload) return
    setSubmitting(true)
    setError('')

    const response = await fetch(`/api/evaluations/public/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        answers: payload.questions.map((item, index) => ({
          questionId: item.id,
          questionText: item.text,
          orderIndex: item.order_index,
          answer: answers[index],
        })),
      }),
    })
    const nextPayload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(nextPayload?.error || 'Kunde inte skicka svaret.')
      setSubmitting(false)
      return
    }

    setStep('done')
    setSubmitting(false)
  }

  if (step === 'loading') {
    return <FullscreenLoader />
  }

  if (step === 'notfound' || !payload) {
    return (
      <Shell>
        <Card
          eyebrow="Utvärdering"
          title="Utvärderingen hittades inte"
          description="Länken kan vara gammal, avslutad eller felaktig."
        />
      </Shell>
    )
  }

  if (step === 'done') {
    return (
      <Shell>
        <Card
          eyebrow="Tack"
          title="Tack för dina svar"
          description="Ditt svar är nu registrerat. Tack för att du tog dig tid att ge återkoppling efter dagens workshop."
        />
      </Shell>
    )
  }

  if (step === 'intro') {
    return (
      <Shell>
        <Card
          eyebrow={payload.evaluation.customer}
          title={payload.evaluation.label}
          description="Tack för idag. Här samlar vi in några korta reflektioner från dagen för att förstå vad som landade väl och vad som är viktigt att ta vidare."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              onClick={() => {
                setError('')
                setStep('questions')
              }}
              style={primaryButtonStyle}
            >
              Börja svara
            </button>
            {error && <div style={errorStyle}>{error}</div>}
          </div>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card
        eyebrow={payload.evaluation.customer}
        title={question?.text || ''}
        description={`Fråga ${current + 1} av ${payload.questions.length}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isScaleQuestion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                <span>Lågt</span>
                <span>Högt</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(value => {
                const active = (answers[current] || '') === `${value}`
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnswers(prev => prev.map((item, index) => index === current ? `${value}` : item))}
                    style={{
                      padding: '16px 0',
                      borderRadius: 12,
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(198,35,104,0.08)' : 'var(--surface)',
                      color: active ? 'var(--accent)' : 'var(--text)',
                      fontSize: 20,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {value}
                  </button>
                )
              })}
              </div>
            </div>
          ) : (
            <textarea
              rows={7}
              value={answers[current] || ''}
              onChange={e => setAnswers(prev => prev.map((value, index) => index === current ? e.target.value : value))}
              placeholder="Skriv ditt svar här"
              style={{ ...inputStyle, minHeight: 180, resize: 'vertical' }}
            />
          )}
          {isLast && payload.evaluation.collectEmail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                Skriv din e-post innan du skickar in svaret.
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="namn@bolag.se"
                style={inputStyle}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {current > 0 && (
              <button onClick={() => setCurrent(current - 1)} style={secondaryButtonStyle}>
                Tillbaka
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => {
                  if (!(answers[current] || '').trim()) {
                    setError('Svara på frågan innan du går vidare.')
                    return
                  }
                  setError('')
                  setCurrent(current + 1)
                }}
                style={primaryButtonStyle}
              >
                Nästa fråga
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!(answers[current] || '').trim()) {
                    setError('Svara på frågan innan du skickar.')
                    return
                  }
                  if (payload.evaluation.collectEmail && !email.trim()) {
                    setError('Ange din e-post innan du skickar.')
                    return
                  }
                  void submit()
                }}
                disabled={submitting}
                style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Skickar…' : 'Skicka svar'}
              </button>
            )}
          </div>
          {error && <div style={errorStyle}>{error}</div>}
        </div>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f6f1ed 0%, #f9f7f4 42%, #fbfaf8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        {children}
      </div>
    </div>
  )
}

function Card({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div style={{
      width: '100%',
      background: 'var(--surface)',
      borderRadius: 24,
      overflow: 'hidden',
      border: '1px solid rgba(14,14,12,0.08)',
      boxShadow: '0 20px 48px rgba(16,24,40,0.08)',
    }}>
      <div style={{ background: 'var(--text)', padding: '28px 28px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 26, height: 26 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>Utvärdering</div>
          </div>
          {eyebrow && (
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
              {eyebrow}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.08, letterSpacing: '-0.03em' }}>{title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 12, lineHeight: 1.7, maxWidth: 500 }}>{description}</div>
      </div>
      <div style={{ padding: '24px 28px 28px', background: '#fbfaf8' }}>
        {children}
      </div>
    </div>
  )
}

function FullscreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbfaf8' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 12,
  padding: '13px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--text)',
  outline: 'none',
  lineHeight: 1.6,
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 20px',
  background: 'var(--text)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

const errorStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 12.5,
}
