'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { InlineError, PageLoader } from '@/app/dashboard/evaluations/ui'

type DiscoverySessionDetailPayload = {
  session: {
    id: string
    templateId: string
    templateName: string
    introTitle: string
    introText: string
    clientName: string
    clientEmail: string
    clientOrganisation: string | null
    status: 'pending' | 'submitted'
    createdAt: string
    submittedAt: string | null
  }
  sections: Array<{
    id: string
    label: string
    description: string
    orderIndex: number
    questions: Array<{
      id: string
      type: 'open' | 'choice' | 'scale'
      text: string
      orderIndex: number
      response: {
        id: string
        responseType: 'open' | 'choice' | 'scale'
        textValue: string | null
        scaleValue: number | null
        selectedOptions: string[]
        createdAt: string
      } | null
    }>
  }>
}

export default function DiscoveryResponseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [payload, setPayload] = useState<DiscoverySessionDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/discovery/sessions/${id}`)
      .then(async response => {
        const nextPayload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(nextPayload?.error || 'Kunde inte läsa svaret.')
        setPayload(nextPayload)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Nätverksfel.')
        setLoading(false)
      })
  }, [id])

  if (loading) return <PageLoader />

  if (error || !payload) {
    return (
      <div style={{ padding: '40px 44px', maxWidth: 920 }}>
        <Link href="/dashboard/discovery/responses" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 12.5 }}>
          Tillbaka till inkomna svar
        </Link>
        <div style={{ marginTop: 20 }}>
          <InlineError text={error || 'Svaret kunde inte laddas.'} />
        </div>
      </div>
    )
  }

  const { session, sections } = payload

  return (
    <div style={{ padding: '40px 44px', maxWidth: 900, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/discovery/responses" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Inkomna svar</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{session.clientName}</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            {session.clientName}
          </h1>
          <StatusPill status={session.status} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          {session.clientEmail}
          {session.clientOrganisation ? ` · ${session.clientOrganisation}` : ''}
          {session.submittedAt ? ` · Besvarad ${formatDateTime(session.submittedAt)}` : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
        <MetaCard title="Underlag">
          <MetaRow label="Upplägg" value={session.templateName} />
          <MetaRow label="Rubrik" value={session.introTitle} />
          <MetaRow label="Skickad" value={formatDateTime(session.createdAt)} />
        </MetaCard>
        <MetaCard title="Mottagare">
          <MetaRow label="Namn" value={session.clientName} />
          <MetaRow label="E-post" value={session.clientEmail} />
          <MetaRow label="Organisation" value={session.clientOrganisation || 'Ej angiven'} />
        </MetaCard>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sections.map(section => (
          <section key={section.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)' }}>
                {section.label}
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                {section.description}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border-sub)' }}>
              {section.questions.map((question, index) => (
                <div key={question.id} style={{ background: 'var(--surface)', padding: '18px 22px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Fråga {index + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.58, color: 'var(--text)', marginBottom: 12 }}>
                    {question.text}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {formatResponse(question.response)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function formatResponse(
  response: DiscoverySessionDetailPayload['sections'][number]['questions'][number]['response']
) {
  if (!response) return 'Inget svar ännu.'
  if (response.responseType === 'choice') return response.selectedOptions.join(', ') || 'Inget svar'
  if (response.responseType === 'scale') return response.scaleValue !== null ? `${response.scaleValue}` : 'Inget svar'
  return response.textValue || 'Inget svar'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusPill({ status }: { status: 'pending' | 'submitted' }) {
  const ok = status === 'submitted'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 9px',
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 700,
      background: ok ? '#f0fdf4' : '#fff7ed',
      color: ok ? '#166534' : '#9a3412',
      border: ok ? '1px solid #bbf7d0' : '1px solid #fed7aa',
    }}>
      {ok ? 'Besvarad' : 'Väntar'}
    </span>
  )
}

function MetaCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '18px 20px' }}>
      <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)' }}>{title}</h2>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}
