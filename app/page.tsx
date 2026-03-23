'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PinPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()

      if (data.ok) {
        sessionStorage.setItem('brief_auth', data.token)
        router.push('/brief')
      } else {
        setError('Fel PIN-kod. Försök igen.')
        setPin('')
      }
    } catch {
      setError('Något gick fel. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-doings-bg px-4">
      {/* Logo / wordmark */}
      <div className="mb-10 flex flex-col items-center gap-2">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
          style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
        >
          D
        </div>
        <span className="text-xl font-semibold text-doings-purple-dark tracking-tight">
          Doings
        </span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg shadow-doings-purple-light/40 p-8">
        <h1 className="text-2xl font-bold text-doings-purple-dark mb-1 text-center">
          Välkommen!
        </h1>
        <p className="text-doings-muted text-sm text-center mb-8">
          Ange koden du fått av Doings för att starta din brief.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            autoFocus
            className="pin-input w-full border-2 border-doings-purple-light rounded-xl px-4 py-3
                       focus:outline-none focus:border-doings-purple transition-colors"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 3}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
          >
            {loading ? 'Verifierar…' : 'Öppna briefen →'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-doings-muted text-center">
        Frågor? Kontakta{' '}
        <a href="mailto:marcus.warn@doings.se" className="underline hover:text-doings-purple">
          marcus.warn@doings.se
        </a>
      </p>
    </div>
  )
}
