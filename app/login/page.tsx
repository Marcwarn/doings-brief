'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError('Kunde inte skicka länk. Kontrollera e-postadressen.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-doings-bg px-4">
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
             style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}>
          D
        </div>
        <span className="text-xl font-semibold text-doings-purple-dark tracking-tight">Doings Brief</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg shadow-doings-purple-light/40 p-8">
        {!sent ? (
          <>
            <h1 className="text-2xl font-bold text-doings-purple-dark mb-1 text-center">Logga in</h1>
            <p className="text-doings-muted text-sm text-center mb-8">
              Ange din Doings-e-post så skickar vi en inloggningslänk.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="din@doings.se"
                autoFocus
                required
                className="w-full border-2 border-doings-purple-light rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:border-doings-purple transition-colors"
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3d1a47, #6b2d82)' }}
              >
                {loading ? 'Skickar…' : 'Skicka inloggningslänk →'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-xl font-bold text-doings-purple-dark mb-2">Kolla din e-post!</h2>
            <p className="text-doings-muted text-sm">
              Vi skickade en inloggningslänk till <strong>{email}</strong>.
              Klicka på länken för att komma in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
