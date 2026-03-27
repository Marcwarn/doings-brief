'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type EvaluationQuestion = {
  id: string
  text: string
  order_index: number
}

type PublicPayload = {
  evaluation: {
    label: string
    customer: string
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
          title="Utvärderingen hittades inte"
          description="Länken kan vara gammal eller felaktig."
        />
      </Shell>
    )
  }

  if (step === 'done') {
    return (
      <Shell>
        <Card
          title="Tack för dina svar"
          description="Ditt svar är nu registrerat för den här utvärderingen."
        />
      </Shell>
    )
  }

  if (step === 'intro') {
    return (
      <Shell>
        <Card
          title={payload.evaluation.label}
          description={`Det här är en utvärdering för ${payload.evaluation.customer}. Svara först på frågorna och lämna sedan din e-post i slutet.`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={noticeStyle}>
              Din e-post samlas in i slutet tillsammans med svaret, men visas inte öppet för gruppen.
            </div>
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
        title={question?.text || ''}
        description={`Fråga ${current + 1} av ${payload.questions.length}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <textarea
            rows={7}
            value={answers[current] || ''}
            onChange={e => setAnswers(prev => prev.map((value, index) => index === current ? e.target.value : value))}
            placeholder="Skriv ditt svar här…"
            style={{ ...inputStyle, minHeight: 180, resize: 'vertical' }}
          />
          {isLast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={noticeStyle}>
                Ange din e-post innan du skickar. Den sparas tillsammans med svaret men visas inte öppet för gruppen.
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
                  if (!email.trim()) {
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
    <div style={{ minHeight: '100vh', background: '#fdf5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {children}
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(198,35,104,0.15)', boxShadow: '0 24px 64px rgba(198,35,104,0.12), 0 4px 20px rgba(0,0,0,0.08)' }}>
      <div style={{ background: '#C62368', padding: '28px 28px 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', marginTop: 10, lineHeight: 1.55 }}>{description}</div>
      </div>
      <div style={{ padding: '24px 28px 28px', background: '#fdf5f7' }}>
        {children}
      </div>
    </div>
  )
}

function FullscreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf5f7' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C62368', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#fff',
  border: '1.5px solid #f0cdd8',
  borderRadius: 10,
  padding: '12px 14px',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: '#1a1a1a',
  outline: 'none',
  lineHeight: 1.6,
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 20px',
  background: '#C62368',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: '#fff',
  color: '#C62368',
  border: '1px solid #f0cdd8',
}

const noticeStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #f0cdd8',
  background: '#fff',
  color: '#6b7280',
  fontSize: 12.5,
  lineHeight: 1.5,
}

const errorStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: 12.5,
}
