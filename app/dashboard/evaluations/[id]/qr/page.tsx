'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type EvaluationQrPayload = {
  evaluation: {
    id: string
    token: string
    label: string
    customer: string
  }
}

export default function EvaluationQrPage() {
  const { id } = useParams<{ id: string }>()
  const [payload, setPayload] = useState<EvaluationQrPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/evaluations/${id}`)
      .then(async response => {
        const nextPayload = await response.json().catch(() => null)
        if (!response.ok || !nextPayload?.evaluation) {
          throw new Error(nextPayload?.error || 'Kunde inte läsa utvärderingen.')
        }
        setPayload({ evaluation: nextPayload.evaluation })
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Kunde inte läsa utvärderingen.')
      })
  }, [id])

  const publicUrl = useMemo(() => (
    payload ? `${window.location.origin}/evaluation/${payload.evaluation.token}` : ''
  ), [payload])

  const qrUrl = useMemo(() => (
    publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=900x900&data=${encodeURIComponent(publicUrl)}` : ''
  ), [publicUrl])

  if (error) {
    return (
      <main style={pageStyle}>
        <div style={messageStyle}>{error}</div>
      </main>
    )
  }

  if (!payload || !qrUrl) {
    return (
      <main style={pageStyle}>
        <div style={messageStyle}>Laddar QR-kod…</div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div style={frameStyle}>
        <img
          src={qrUrl}
          alt={`QR-kod för ${payload.evaluation.label}`}
          style={qrStyle}
        />
        <div style={labelStyle}>{payload.evaluation.label}</div>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'grid',
  placeItems: 'center',
  background: '#f6f2ee',
  padding: '28px',
}

const frameStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
  justifyItems: 'center',
}

const qrStyle: React.CSSProperties = {
  width: 'min(78vw, 680px)',
  height: 'min(78vw, 680px)',
  objectFit: 'contain',
  background: '#fff',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 24px 60px rgba(22, 19, 17, 0.10)',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(20px, 3vw, 34px)',
  lineHeight: 1.1,
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: '-0.03em',
  color: '#161311',
}

const messageStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 18,
  color: '#161311',
}
