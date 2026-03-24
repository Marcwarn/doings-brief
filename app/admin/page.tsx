'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, type Profile } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s',
}

export default function AdminPage() {
  const router = useRouter()
  const sb = createClient()

  const [profiles, setProfiles]   = useState<Profile[]>([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState<string | null>(null)

  const [newEmail, setNewEmail]             = useState('')
  const [newName, setNewName]               = useState('')
  const [newSenderEmail, setNewSenderEmail] = useState('')
  const [newPassword, setNewPassword]       = useState('')
  const [inviting, setInviting]             = useState(false)
  const [inviteResult, setInviteResult]     = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
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
      body: JSON.stringify({ email: newEmail, fullName: newName, senderEmail: newSenderEmail, password: newPassword || undefined }),
    })
    const { ok, error } = await res.json()
    if (ok) {
      const msg = newPassword
        ? `${newName || newEmail} skapad — de kan logga in direkt med lösenordet du angav.`
        : `Inbjudan skickad till ${newEmail}`
      setInviteResult(msg)
      setNewEmail(''); setNewName(''); setNewSenderEmail(''); setNewPassword('')
      setAdding(false)
      setTimeout(loadProfiles, 1000)
    } else {
      setInviteResult(`Fel: ${error || 'Okänt fel'}`)
    }
    setInviting(false)
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Header strip */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
          ← Dashboard
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>/</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Admin</span>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px', animation: 'fadeUp 0.35s ease both' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
              Användare
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>
              Hantera kollegor och deras inställningar
            </p>
          </div>
          <button onClick={() => setAdding(!adding)} style={{
            padding: '10px 18px', borderRadius: 8,
            border: adding ? '1px solid var(--border)' : 'none',
            background: adding ? 'var(--bg)' : 'var(--accent)',
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.01em', color: adding ? 'var(--text-2)' : '#fff',
            cursor: 'pointer',
            boxShadow: adding ? 'none' : '0 4px 16px rgba(198,35,104,0.22)',
          }}>
            {adding ? 'Avbryt' : '+ Lägg till kollega'}
          </button>
        </div>

        {/* Invite form */}
        {adding && (
          <form onSubmit={inviteUser} style={{
            background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
            padding: '22px 24px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Ny kollega
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
                  E-post *
                </label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                       type="email" placeholder="anna@doings.se" required style={F}
                       onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                       onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
                  Namn *
                </label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                       placeholder="Anna Andersson" required style={F}
                       onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                       onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
                  Lösenord
                </label>
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                       type="password" placeholder="Minst 8 tecken" style={F}
                       onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                       onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
                  Avsändaradress
                </label>
                <input value={newSenderEmail} onChange={e => setNewSenderEmail(e.target.value)}
                       placeholder="anna@doingsclients.se" style={F}
                       onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                       onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
              Ange ett lösenord om kollegan ska kunna logga in direkt. Lämna tomt för att skicka en inbjudningslänk via e-post.
            </p>
            {inviteResult && (
              <p style={{ fontSize: 13, margin: 0, color: inviteResult.startsWith('Fel') ? '#dc2626' : '#16a34a' }}>
                {inviteResult}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setAdding(false)} style={{
                flex: 1, padding: '10px 0', borderRadius: 7, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)',
                fontFamily: 'var(--font-sans)',
              }}>
                Avbryt
              </button>
              <button type="submit" disabled={inviting} style={{
                flex: 2, padding: '10px 0', borderRadius: 7, border: 'none',
                background: inviting ? 'rgba(198,35,104,0.4)' : 'var(--accent)',
                fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700,
                letterSpacing: '0.01em', color: '#fff',
                cursor: inviting ? 'not-allowed' : 'pointer',
                boxShadow: inviting ? 'none' : '0 4px 16px rgba(198,35,104,0.22)',
              }}>
                {inviting ? 'Skapar…' : newPassword ? 'Skapa konto' : 'Skicka inbjudan'}
              </button>
            </div>
          </form>
        )}

        {/* User list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {profiles.map(p => (
            <div key={p.id} style={{ background: 'var(--surface)', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.full_name || p.email}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{p.email}</div>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                  letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0,
                  background: p.role === 'admin' ? 'var(--accent-dim)' : 'var(--bg)',
                  color: p.role === 'admin' ? 'var(--accent)' : 'var(--text-3)',
                }}>
                  {p.role === 'admin' ? 'Admin' : 'Konsult'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Namn
                  </label>
                  <input
                    defaultValue={p.full_name || ''}
                    style={F}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = ''; if (e.target.value !== (p.full_name || '')) updateProfile(p.id, { full_name: e.target.value }) }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Avsändaradress
                  </label>
                  <input
                    defaultValue={p.sender_email || ''}
                    placeholder="namn@doingsclients.se"
                    style={F}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = ''; if (e.target.value !== (p.sender_email || '')) updateProfile(p.id, { sender_email: e.target.value }) }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Roll:</label>
                <select
                  value={p.role}
                  onChange={e => updateProfile(p.id, { role: e.target.value as 'admin' | 'consultant' })}
                  style={{
                    fontSize: 12, border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 8px', background: 'var(--bg)', color: 'var(--text)',
                    outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}>
                  <option value="consultant">Konsult</option>
                  <option value="admin">Admin</option>
                </select>
                {saving === p.id && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Sparar…</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
