'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }
    // Exchange code using the browser client — it has access to the PKCE verifier
    createClient()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setHasError(true)
          setTimeout(() => router.replace('/login'), 2500)
        } else {
          router.replace('/dashboard/evaluations/new')
        }
      })
  }, []) // eslint-disable-line

  if (hasError) {
    return (
      <p style={{ fontFamily: 'var(--font-sans)', color: '#dc2626', fontSize: 14 }}>
        Inloggning misslyckades — omdirigerar…
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <Suspense fallback={null}>
        <CallbackInner />
      </Suspense>
    </div>
  )
}
