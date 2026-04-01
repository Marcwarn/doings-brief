'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hasLoginScopeCookie } from '@/lib/auth-persistence'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        if (!hasLoginScopeCookie()) {
          await sb.auth.signOut()
          router.replace('/login')
          return
        }
        router.replace('/dashboard/evaluations/new')
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-doings-bg">
      <div className="flex gap-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-doings-purple animate-bounce"
               style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
