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
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single()
      setProfile(p)
    })
  }, [])

  async function signOut() {
    await sb.auth.signOut()
    router.replace('/login')
  }

  const navItems = [
    { href: '/dashboard',               label: 'Översikt',       icon: HomeIcon },
    { href: '/dashboard/question-sets', label: 'Frågebatterier', icon: ListIcon },
    { href: '/dashboard/send',          label: 'Skicka brief',   icon: SendIcon },
    { href: '/dashboard/briefs',        label: 'Svar',           icon: InboxIcon },
    ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f7f5fb] flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-purple-100 px-5 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src="/doings-logo-white.svg" alt="Doings" width={48}
               className="opacity-90"
               style={{ filter: 'brightness(0)' }} />
          <span className="font-bold text-[#1e0e2e] text-sm tracking-tight">Doings Brief</span>
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-xs text-purple-400 hidden sm:block">
              {profile.full_name || profile.email}
            </span>
          )}
          <button onClick={signOut}
                  className="text-xs text-purple-400 hover:text-purple-700 transition-colors">
            Logga ut
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0 bg-white border-r border-purple-100 pt-6 pb-10 flex flex-col gap-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${active
                        ? 'bg-purple-50 text-[#6b2d82]'
                        : 'text-[#1e0e2e] hover:bg-purple-50 hover:text-[#6b2d82]'
                      }`}>
                <Icon />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)
const InboxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
)
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
