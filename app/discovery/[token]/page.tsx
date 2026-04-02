'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type PublicDiscoveryPayload = {
  session: {
    responseMode: 'named' | 'anonymous'
    clientName: string
    clientEmail: string
    clientOrganisation: string | null
    status: 'pending' | 'submitted'
    submittedAt: string | null
  }
  template: {
    id: string
    name: string
    introTitle: string
    introText: string
    audienceMode: 'shared' | 'leaders' | 'mixed'
    status: 'draft' | 'active'
    sections: Array<{
      id: string
      label: string
      description: string
      orderIndex: number
      questions: Array<{
        id: string
        type: 'open' | 'choice' | 'scale' | 'likert'
        text: string
        orderIndex: number
        maxChoices: number | null
        scaleMin: number | null
        scaleMax: number | null
        scaleMinLabel: string | null
        scaleMaxLabel: string | null
        options: Array<{
          id: string
          label: string
          orderIndex: number
        }>
      }>
    }>
  }
}

type AnswerState = Record<string, string | string[]>

function answeredCount(
  section: PublicDiscoveryPayload['template']['sections'][number],
  answers: AnswerState
) {
  return section.questions.reduce((count, question) => {
    const value = answers[question.id]
    if (question.type === 'scale' && typeof value === 'string' && value) return count + 1
    if (question.type === 'open' && typeof value === 'string' && value.trim().length > 0) return count + 1
    if (question.type === 'choice' && Array.isArray(value) && value.length > 0) return count + 1
    if (question.type === 'likert') {
      const agreement = answers[question.id + '_agreement']
      const importance = answers[question.id + '_importance']
      if (typeof agreement === 'string' && agreement && typeof importance === 'string' && importance) return count + 1
    }
    return count
  }, 0)
}

export default function DiscoveryPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [payload, setPayload] = useState<PublicDiscoveryPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'intro' | 'ready' | 'done' | 'notfound'>('loading')
  const [activeSectionId, setActiveSectionId] = useState<string>('')
  const [answers, setAnswers] = useState<AnswerState>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [demographicRole, setDemographicRole] = useState('')
  const [demographicTeam, setDemographicTeam] = useState('')

  useEffect(() => {
    fetch(`/api/discovery/public/${token}`, { cache: 'no-store' })
      .then(async response => {
        const nextPayload = await response.json().catch(() => null)
        if (!response.ok || !nextPayload?.template?.sections) {
          setStatus('notfound')
          return
        }

        setPayload(nextPayload as PublicDiscoveryPayload)
        setActiveSectionId(nextPayload.template.sections[0]?.id || '')
        setAnswers({})
        setDemographicRole('')
        setDemographicTeam('')
        setStatus(nextPayload.session.responseMode === 'anonymous'
          ? 'intro'
          : (nextPayload.session.status === 'submitted' ? 'done' : 'intro'))
      })
      .catch(() => setStatus('notfound'))
  }, [token])

  const activeSection = useMemo(() => (
    payload?.template.sections.find(section => section.id === activeSectionId) || payload?.template.sections[0] || null
  ), [payload, activeSectionId])

  const totalQuestions = payload?.template.sections.reduce((count, section) => count + section.questions.length, 0) || 0
  const totalAnswered = payload?.template.sections.reduce((count, section) => count + answeredCount(section, answers), 0) || 0
  const totalProgress = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  function setOpen(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  function setScale(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  function setLikert(questionId: string, axis: 'agreement' | 'importance', value: string) {
    setAnswers(prev => ({ ...prev, [questionId + '_' + axis]: value }))
  }

  function toggleChoice(questionId: string, option: string, max: number) {
    setAnswers(prev => {
      const current = Array.isArray(prev[questionId]) ? [...(prev[questionId] as string[])] : []
      const exists = current.includes(option)
      const next = exists
        ? current.filter(item => item !== option)
        : (current.length >= max ? [...current.slice(1), option] : [...current, option])

      return {
        ...prev,
        [questionId]: next,
      }
    })
  }

  async function submit() {
    if (!payload) return

    const missingAnswer = payload.template.sections
      .flatMap(section => section.questions)
      .find(question => {
        const value = answers[question.id]
        if (question.type === 'open') return !(typeof value === 'string' && value.trim())
        if (question.type === 'scale') return !(typeof value === 'string' && value)
        if (question.type === 'likert') {
          const agreement = answers[question.id + '_agreement']
          const importance = answers[question.id + '_importance']
          return !(typeof agreement === 'string' && agreement && typeof importance === 'string' && importance)
        }
        return !(Array.isArray(value) && value.length > 0)
      })

    if (missingAnswer) {
      setError('Svara på alla frågor innan du skickar.')
      return
    }

    setSubmitting(true)
    setError('')

    const response = await fetch('/api/discovery/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        demographicRole: payload.session.responseMode === 'anonymous' ? demographicRole : null,
        demographicTeam: payload.session.responseMode === 'anonymous' ? demographicTeam : null,
        responses: payload.template.sections.flatMap(section => section.questions.map(question => {
          const value = answers[question.id]

          if (question.type === 'choice') {
            return {
              questionId: question.id,
              responseType: 'choice',
              selectedOptions: Array.isArray(value) ? value : [],
            }
          }

          if (question.type === 'scale') {
            return {
              questionId: question.id,
              responseType: 'scale',
              scaleValue: typeof value === 'string' ? Number(value) : null,
            }
          }

          if (question.type === 'likert') {
            const agreement = answers[question.id + '_agreement']
            const importance = answers[question.id + '_importance']
            return {
              questionId: question.id,
              responseType: 'likert',
              likertAgreement: typeof agreement === 'string' ? Number(agreement) : null,
              likertImportance: typeof importance === 'string' ? Number(importance) : null,
            }
          }

          return {
            questionId: question.id,
            responseType: 'open',
            textValue: typeof value === 'string' ? value : '',
          }
        })),
      }),
    })

    const nextPayload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(nextPayload?.error || 'Kunde inte skicka era svar just nu.')
      setSubmitting(false)
      return
    }

    setStatus('done')
    setSubmitting(false)
  }

  if (status === 'loading') {
    return <FullscreenLoader />
  }

  if (status === 'notfound' || !payload) {
    return (
      <Shell>
        <SimpleCard
          title="Sidan hittades inte"
          description="Länken kan vara gammal, felaktig eller ännu inte aktiverad."
        />
      </Shell>
    )
  }

  if (status === 'done') {
    return (
      <Shell>
        <SimpleCard
          title="Tack för era svar"
          description="Vi har tagit emot era perspektiv och återkommer med nästa steg."
        />
      </Shell>
    )
  }

  if (status === 'intro') {
    return (
      <Shell>
        <SimpleCard
          title={payload.template.introTitle}
          description={payload.session.responseMode === 'anonymous'
            ? `${payload.session.clientOrganisation || 'Tack för dialogen hittills'}. Här vill vi samla in några fördjupande perspektiv anonymt för att förstå nuläge, behov och riktning bättre. Era svar hjälper oss att skapa en första utgångspunkt tillsammans.`
            : `${payload.session.clientOrganisation || payload.session.clientName}, tack för dialogen hittills. Här vill vi samla in några fördjupande perspektiv från er för att förstå nuläge, behov och riktning bättre. Era svar hjälper oss att skapa en första utgångspunkt tillsammans.`}
        >
          <button
            type="button"
            onClick={() => setStatus('ready')}
            style={primaryButtonStyle}
          >
            Börja svara
          </button>
        </SimpleCard>
      </Shell>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--text)', color: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 28, height: 28 }} />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>Discovery</div>
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
              {payload.session.responseMode === 'anonymous' ? 'Anonymt underlag inför nästa steg' : 'Underlag inför nästa steg'}
            </div>
          </div>

          <div style={{ padding: '42px 24px 76px', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              inset: 'auto auto -18px 0',
              width: '100%',
              height: 38,
              background: 'var(--bg)',
              borderTopLeftRadius: '50% 100%',
              borderTopRightRadius: '50% 100%',
            }} />
            <h1 style={{
              margin: '0 0 12px',
              maxWidth: 640,
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              position: 'relative',
              zIndex: 1,
            }}>
              {payload.template.introTitle}
            </h1>
            <p style={{
              margin: 0,
              maxWidth: 610,
              fontSize: 15.5,
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.74)',
              position: 'relative',
              zIndex: 1,
            }}>
              {payload.template.introText}
            </p>
            {payload.session.responseMode === 'anonymous' && (
              <div style={{
                marginTop: 18,
                maxWidth: 560,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gap: 12,
              }}>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' }}>
                  Svaren skickas in anonymt. Om du vill kan du lägga till lite bakgrund innan du svarar.
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <input
                    value={demographicRole}
                    onChange={event => setDemographicRole(event.target.value)}
                    placeholder="Roll, till exempel Ledare"
                    style={anonymousInputStyle}
                  />
                  <input
                    value={demographicTeam}
                    onChange={event => setDemographicTeam(event.target.value)}
                    placeholder="Team eller enhet"
                    style={anonymousInputStyle}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 24px 72px' }}>
        <div style={{ marginBottom: 22, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', paddingBottom: 2 }}>
            {payload.template.sections.map(section => {
              const active = section.id === activeSection?.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    padding: '8px 16px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeSection && (
          <>
            <section style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                {activeSection.label}
              </h2>
              <p style={{ margin: 0, maxWidth: 620, fontSize: 14.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
                {activeSection.description}
              </p>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeSection.questions.map((question, questionIndex) => {
                const value = answers[question.id]
                const scaleMin = question.scaleMin ?? 1
                const scaleMax = question.scaleMax ?? 5
                const scaleValues = Array.from({ length: (scaleMax - scaleMin) + 1 }, (_, index) => scaleMin + index)

                return (
                  <article
                    key={question.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      padding: '22px 24px 20px',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Fråga {questionIndex + 1}
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.58, color: 'var(--text)', marginBottom: 18, maxWidth: 720 }}>
                      {question.text}
                    </div>

                    {question.type === 'scale' && (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          {scaleValues.map(option => {
                            const selected = value === `${option}`
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setScale(question.id, `${option}`)}
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 12,
                                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                  background: selected ? 'var(--accent)' : 'transparent',
                                  color: selected ? '#fff' : 'var(--text-2)',
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {option}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: 'var(--text-3)', maxWidth: 250 }}>
                          <span>{question.scaleMinLabel || 'Lågt'}</span>
                          <span>{question.scaleMaxLabel || 'Högt'}</span>
                        </div>
                      </>
                    )}

                    {question.type === 'open' && (
                      <textarea
                        value={typeof value === 'string' ? value : ''}
                        onChange={event => setOpen(question.id, event.target.value)}
                        placeholder="Skriv ditt svar här…"
                        rows={3}
                        style={{
                          width: '100%',
                          minHeight: 104,
                          resize: 'vertical',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          padding: '14px 16px',
                          fontSize: 14,
                          lineHeight: 1.6,
                          fontFamily: 'var(--font-sans)',
                          outline: 'none',
                        }}
                      />
                    )}

                    {question.type === 'choice' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                        {question.options.map(option => {
                          const checked = Array.isArray(value) && value.includes(option.label)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleChoice(question.id, option.label, question.maxChoices || 1)}
                              style={{
                                borderRadius: 999,
                                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                                background: checked ? 'var(--accent-dim)' : 'var(--bg)',
                                color: checked ? 'var(--accent)' : 'var(--text-2)',
                                padding: '9px 15px',
                                fontSize: 13,
                                lineHeight: 1.4,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    )}

                  {question.type === 'likert' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {[
                        { axis: 'agreement' as const, label: question.text + ' – Nuläge (1–5)', minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' },
                        { axis: 'importance' as const, label: question.text + ' – Vikt (1–5)', minLabel: 'Not important', maxLabel: 'Very important' },
                      ].map(({ axis, label, minLabel, maxLabel }) => {
                        const axisValue = answers[question.id + '_' + axis]
                        return (
                          <div key={axis}>
                            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>{label}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              {[1, 2, 3, 4, 5].map(n => {
                                const sel = axisValue === String(n)
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setLikert(question.id, axis, String(n))}
                                    style={{
                                      width: 54, height: 54, borderRadius: 12,
                                      border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                                      background: sel ? 'var(--accent)' : 'transparent',
                                      color: sel ? '#fff' : 'var(--text-2)',
                                      fontSize: 16, fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    {n}
                                  </button>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', maxWidth: 310 }}>
                              <span>{minLabel}</span>
                              <span>{maxLabel}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  </article>
                )
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: `${totalProgress}%`, height: '100%', borderRadius: 999, background: 'var(--accent)', transition: 'width 0.25s ease' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
                {totalAnswered} av {totalQuestions} besvarade
              </div>
            </div>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              style={{
                border: 'none',
                borderRadius: 10,
                background: 'var(--accent)',
                color: '#fff',
                padding: '11px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Skickar…' : 'Skicka era svar'}
            </button>
          </div>
          {error && (
            <div style={{
              marginTop: 14,
              borderRadius: 12,
              border: '1px solid #f2c5d2',
              background: '#fff3f7',
              color: '#8e244c',
              padding: '12px 14px',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {children}
    </div>
  )
}

function SimpleCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ width: '100%', maxWidth: 620, background: 'var(--surface)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.06)' }}>
      <div style={{ background: 'var(--text)', padding: '28px 28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 28, height: 28 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Discovery
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 10, lineHeight: 1.65 }}>{description}</div>
      </div>
      {children && (
        <div style={{ padding: '22px 28px 28px', background: 'var(--bg)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function FullscreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 20px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
}

const anonymousInputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  padding: '12px 14px',
  fontSize: 13.5,
  lineHeight: 1.5,
  outline: 'none',
}
