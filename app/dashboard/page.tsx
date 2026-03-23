'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type BriefSession } from '@/lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [sessions, setSessions] = useState<BriefSession[]>([])
  const [loading, setLoading] = useState(true)

  // New brief form
  const [showForm, setShowForm] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [newSession, setNewSession] = useState<BriefSession | null>(null)
  const [copied, setCopied] = useState(false)

  const sb = createClient()

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      setUser({ email: data.session.user.email! })
      await loadSessions()
      setLoading(false)
    })
  }, [])

  async function loadSessions() {
    const { data } = await sb
      .from('brief_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    setSessions(data || [])
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const { data, error } = await sb
      .from('brief_sessions')
      .insert({ client_name: clientName, client_email: clientEmail, consultant_email: user?.email })
      .select()
      .single()

    if (!error && data) {
      setNewSession(data)
      setSessions(prev => [data, ...prev])
      setClientName('')
      setClientEmail('')
      setShowForm(false)

      // Optionally send email to client
      await fetch('/api/send-brief-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: data.client_name,
          clientEmail: data.client_email,
          token: data.token,
          consultantEmail: user?.email,
        }),
      })
    }
    setCreating(false)
  }

  async function signOut() {
    await sb.auth.signOut()
    router.replace('/login')
  }

  function briefUrl(token: string) {
    return `${window.location.origin}/brief/${token}`
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(briefUrl(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg">
      <div className="flex gap-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-doings-bg">
      {/* Header */}
      <header className="bg-white border-b border-doings-purple-light/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
               style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>D</div>
          <div>
            <span className="font-semibold text-doings-purple-dark text-sm block">Doings Brief</span>
            <span className="text-xs text-doings-muted">{user?.email}</span>
          </div>
        </div>
        <button onClick={signOut}
                className="text-sm text-doings-muted hover:text-doings-purple transition-colors">
          Logga ut
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">

        {/* New brief created confirmation */}
        {newSession && (
          <div className="bg-white border border-green-200 rounded-2xl p-6 mb-6 slide-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700 mb-1">✓ Brief skapad & länk skickad till {newSession.client_email}</p>
                <p className="text-xs text-doings-muted font-mono break-all">{briefUrl(newSession.token)}</p>
              </div>
              <button onClick={() => copyLink(newSession.token)}
                      className="ml-4 shrink-0 text-xs px-3 py-1.5 rounded-lg border border-doings-purple-light text-doings-purple hover:bg-doings-purple-pale transition-colors">
                {copied ? 'Kopierad!' : 'Kopiera'}
              </button>
            </div>
          </div>
        )}

        {/* Create new brief */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-doings-purple-dark">Mina briefs</h1>
          <button onClick={() => { setShowForm(!showForm); setNewSession(null) }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
            + Ny brief
          </button>
        </div>

        {showForm && (
          <form onSubmit={createSession}
                className="bg-white rounded-2xl shadow-sm p-6 mb-6 slide-in border border-doings-purple-light/50">
            <h2 className="font-semibold text-doings-purple-dark mb-4">Skapa brief för klient</h2>
            <div className="flex flex-col gap-3">
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Klientens namn eller organisation"
                required autoFocus
                className="w-full border border-doings-purple-light rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:border-doings-purple transition-colors"
              />
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="klient@foretag.se"
                required
                className="w-full border border-doings-purple-light rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:border-doings-purple transition-colors"
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 border-doings-purple-light text-doings-purple hover:bg-doings-purple-pale transition-colors">
                  Avbryt
                </button>
                <button type="submit" disabled={creating}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                        style={{ background: 'linear-gradient(135deg, #6b2d82, #C62368)' }}>
                  {creating ? 'Skapar…' : 'Skapa & skicka länk →'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-doings-muted text-sm">Inga briefs ännu — klicka på <strong>+ Ny brief</strong> för att börja.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-doings-purple-dark text-sm truncate">{s.client_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.status === 'submitted'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-doings-purple-pale text-doings-purple'
                    }`}>
                      {s.status === 'submitted' ? 'Inlämnad' : 'Inväntar svar'}
                    </span>
                  </div>
                  <p className="text-xs text-doings-muted truncate">{s.client_email}</p>
                  <p className="text-xs text-doings-muted mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => copyLink(s.token)}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-doings-purple-light text-doings-purple hover:bg-doings-purple-pale transition-colors">
                  Kopiera länk
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
