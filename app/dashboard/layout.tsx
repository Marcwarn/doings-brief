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

      const response = await fetch('/api/brief-access', { cache: 'no-store' })
      if (!response.ok) {
        await sb.auth.signOut()
        router.replace('/login')
        return
      }

      const payload = await response.json().catch(() => null)
      setProfile(payload?.profile || null)
    })
  }, [])

  async function signOut() {
    await sb.auth.signOut()
    router.replace('/login')
  }

  const nav = [
    { href: '/dashboard/send',          label: 'Debrief',       Icon: HomeIcon },
    { href: '/dashboard/discovery',     label: 'Discovery',      Icon: CompassIcon },
    { href: '/dashboard/evaluations',   label: 'Utvärdering',    Icon: ChartIcon },
    ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin', Icon: ShieldIcon }] : []),
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>

        {/* Wordmark */}
        <div style={{ padding: '28px 24px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src="/doings-logo-white.svg" alt="Doings"
                 style={{ width: 26, filter: 'brightness(0)', opacity: 0.85 }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--text)',
            }}>
              Debrief
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--border-sub)', marginTop: 20 }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
            color: 'var(--text-3)',
            padding: '0 10px', marginBottom: 8,
          }}>
            Verktyg
          </div>
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent)' : 'var(--text-2)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.1s, color 0.1s',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginLeft: -2,
              }}>
                <Icon size={15} color={active ? 'var(--accent)' : 'var(--text-3)'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User / signout */}
        <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border-sub)' }}>
          {profile && (
            <div style={{
              fontSize: 12, color: 'var(--text-2)', marginBottom: 2,
              fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {profile.full_name || profile.email}
            </div>
          )}
          {profile && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
              {profile.role === 'admin' ? 'Admin' : 'Konsult'}
            </div>
          )}
          <button onClick={signOut} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12.5, color: 'var(--text-3)',
            fontFamily: 'var(--font-sans)',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
            <LogoutIcon />
            Logga ut
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────
type IconProps = { size?: number; color?: string }

const HomeIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const ShieldIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const ChartIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 3v18h18"/>
    <path d="M7 14l4-4 3 3 5-7"/>
  </svg>
)
const CompassIcon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.8 8.2l-2.4 7.2-7.2 2.4 2.4-7.2 7.2-2.4z" />
  </svg>
)
const LogoutIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
