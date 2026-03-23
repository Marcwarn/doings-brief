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
          router.replace('/dashboard')
        }
      })
  }, []) // eslint-disable-line

  if (hasError) {
    return (
      <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#dc2626', fontSize: 14 }}>
        Inloggning misslyckades — omdirigerar…
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#6b2d82',
            animation: `bounce 0.6s ${i * 0.15}s ease-in-out infinite alternate`,
          }}
        />
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
        background: '#F7CACA',
      }}
    >
      <Suspense fallback={null}>
        <CallbackInner />
      </Suspense>
    </div>
  )
}
