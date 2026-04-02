'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type LoopPageData = {
  loopTitle: string
  subject: string
  bodyHtml: string
  orderIndex: number
  totalMessages: number
  senderName: string
}

export default function LoopReadOnlinePage() {
  const { token, step } = useParams<{ token: string; step: string }>()
  const [data, setData] = useState<LoopPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/loop/${token}/${step}`)
      .then(r => r.json())
      .catch(() => null)
      .then(payload => {
        if (!payload || payload.error) {
          setError(payload?.error || 'Sidan kunde inte laddas')
        } else {
          setData(payload)
        }
        setLoading(false)
      })
  }, [token, step])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4efea' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b2d82', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4efea', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 16, color: '#6b5a7e' }}>{error || 'Sidan hittades inte'}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#1a0a2e 0%,#2d1b4e 50%,#1a0a2e 100%)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: '#fffdfb', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.2)' }}>
          {/* Header */}
          <div style={{ padding: '32px 36px 28px', background: 'linear-gradient(135deg,#1a0a2e 0%,#3d1f6e 100%)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Del {data.orderIndex + 1} av {data.totalMessages}
            </p>
            <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {data.loopTitle}
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{data.subject}</p>
          </div>

          {/* Body */}
          <div
            style={{ padding: '32px 36px', fontSize: 15, lineHeight: 1.7, color: '#2d2926' }}
            dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
          />

          {/* Footer */}
          <div style={{ padding: '20px 36px', background: '#f6f1ec', borderTop: '1px solid rgba(107,45,130,0.1)' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#9e8fa0' }}>
              Skickat av {data.senderName} via Doings
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
