'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient, type Profile } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)
  const sb = createClient()

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return }
      const { data: p } = await sb
        .from('profiles').select('*').eq('id', data.session.user.id).single()
      setProfile(p)
    })
  }, [])

  async function signOut() {
    await sb.auth.signOut()
    router.replace('/login')
  }

  const nav = [
    { href: '/dashboard',               label: 'Översikt',       icon: HomeIcon },
    { href: '/dashboard/question-sets', label: 'Frågebatterier', icon: ListIcon },
    { href: '/dashboard/send',          label: 'Skicka brief',   icon: SendIcon },
    { href: '/dashboard/briefs',        label: 'Svar',           icon: InboxIcon },
    ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }] : []),
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f4f6', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside style={{
        width: 228,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #ececec',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #f4f4f4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#C62368',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/doings-logo-white.svg" alt="Doings" style={{ width: 18, opacity: 0.95 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Doings Brief</div>
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1 }}>Konsultverktyg</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                fontSize: 13.5, fontWeight: active ? 500 : 400,
                color: active ? '#C62368' : '#374151',
                background: active ? '#FFF0F4' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#f9f9f9' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent' } }}>
                <Icon active={active} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '14px 14px 18px', borderTop: '1px solid #f4f4f4' }}>
          {profile && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name || profile.email}
            </div>
          )}
          <button onClick={signOut} style={{
            width: '100%', padding: '7px 10px', borderRadius: 7,
            border: '1px solid #ececec', background: '#fff',
            fontSize: 12.5, color: '#6b7280', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9f9f9' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}>
            Logga ut
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────
const ic = (active?: boolean) => ({ width: 16, height: 16, color: active ? '#C62368' : '#9ca3af', flexShrink: 0 })

const HomeIcon = ({ active }: { active?: boolean }) => (
  <svg {...ic(active)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const ListIcon = ({ active }: { active?: boolean }) => (
  <svg {...ic(active)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <circle cx="3" cy="6" r="0.5" fill="currentColor"/><circle cx="3" cy="12" r="0.5" fill="currentColor"/><circle cx="3" cy="18" r="0.5" fill="currentColor"/>
  </svg>
)
const SendIcon = ({ active }: { active?: boolean }) => (
  <svg {...ic(active)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const InboxIcon = ({ active }: { active?: boolean }) => (
  <svg {...ic(active)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
)
const ShieldIcon = ({ active }: { active?: boolean }) => (
  <svg {...ic(active)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
