'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, type Profile } from '@/lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const sb = createClient()

  const [profiles, setProfiles]   = useState<Profile[]>([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState<string | null>(null)

  // New user form
  const [newEmail, setNewEmail]           = useState('')
  const [newName, setNewName]             = useState('')
  const [newSenderEmail, setNewSenderEmail] = useState('')
  const [inviting, setInviting]           = useState(false)
  const [inviteResult, setInviteResult]   = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      // Check admin role
      const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.replace('/dashboard'); return }
      loadProfiles()
    })
  }, [])

  async function loadProfiles() {
    const { data } = await sb.from('profiles').select('*').order('created_at')
    setProfiles(data || [])
    setLoading(false)
  }

  async function updateProfile(id: string, fields: Partial<Profile>) {
    setSaving(id)
    await sb.from('profiles').update(fields).eq('id', id)
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p))
    setSaving(null)
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true); setInviteResult('')
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, fullName: newName, senderEmail: newSenderEmail }),
    })
    const { ok, error } = await res.json()
    if (ok) {
      setInviteResult(`Inbjudan skickad till ${newEmail}`)
      setNewEmail(''); setNewName(''); setNewSenderEmail('')
      setAdding(false)
      setTimeout(loadProfiles, 1000)
    } else {
      setInviteResult(`Fel: ${error || 'Okänt fel'}`)
    }
    setInviting(false)
  }

  if (loading) return <LoadingDots />

  return (
    <div className="min-h-screen bg-[#f7f5fb]">
      <header className="bg-white border-b border-purple-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-700 text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-purple-200">/</span>
          <span className="font-bold text-[#1e0e2e] text-sm">Admin</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1e0e2e]">Användare</h1>
            <p className="text-purple-400 text-sm mt-0.5">Hantera kollegor och deras inställningar</p>
          </div>
          <button onClick={() => setAdding(!adding)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
            + Bjud in kollega
          </button>
        </div>

        {/* Invite form */}
        {adding && (
          <form onSubmit={inviteUser}
                className="bg-white rounded-2xl border border-purple-100 p-6 mb-6 flex flex-col gap-4">
            <h2 className="font-semibold text-[#1e0e2e] text-sm">Bjud in ny kollega</h2>
            <div className="grid grid-cols-2 gap-3">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                     type="email" placeholder="anna@doings.se" required
                     className="border border-purple-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
              <input value={newName} onChange={e => setNewName(e.target.value)}
                     placeholder="Anna Andersson" required
                     className="border border-purple-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <input value={newSenderEmail} onChange={e => setNewSenderEmail(e.target.value)}
                   placeholder="anna@doingsclients.se (avsändaradress)"
                   className="border border-purple-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
            <p className="text-xs text-purple-400">
              Avsändaradressen används när kollegans briefs skickas till kunder.
              Den måste vara verifierad i Resend.
            </p>
            {inviteResult && (
              <p className={`text-sm ${inviteResult.startsWith('Fel') ? 'text-red-500' : 'text-green-600'}`}>
                {inviteResult}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setAdding(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                Avbryt
              </button>
              <button type="submit" disabled={inviting}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#6b2d82,#C62368)' }}>
                {inviting ? 'Skickar…' : 'Skicka inbjudan'}
              </button>
            </div>
          </form>
        )}

        {/* User list */}
        <div className="flex flex-col gap-3">
          {profiles.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-purple-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[#1e0e2e] text-sm">{p.full_name || p.email}</p>
                  <p className="text-xs text-purple-400">{p.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.role === 'admin' ? 'Admin' : 'Konsult'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Namn</label>
                  <input
                    defaultValue={p.full_name || ''}
                    onBlur={e => { if (e.target.value !== (p.full_name || '')) updateProfile(p.id, { full_name: e.target.value }) }}
                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Avsändaradress</label>
                  <input
                    defaultValue={p.sender_email || ''}
                    placeholder="namn@doingsclients.se"
                    onBlur={e => { if (e.target.value !== (p.sender_email || '')) updateProfile(p.id, { sender_email: e.target.value }) }}
                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-purple-400">Roll:</label>
                <select
                  value={p.role}
                  onChange={e => updateProfile(p.id, { role: e.target.value as 'admin' | 'consultant' })}
                  className="text-xs border border-purple-200 rounded-lg px-2 py-1 focus:outline-none focus:border-purple-400">
                  <option value="consultant">Konsult</option>
                  <option value="admin">Admin</option>
                </select>
                {saving === p.id && <span className="text-xs text-purple-400">Sparar…</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
