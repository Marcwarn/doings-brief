import { NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { hasBriefAccess } from '@/lib/brief-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [allowed, profileResult] = await Promise.all([
      hasBriefAccess(admin, user.id),
      admin.from('profiles').select('*').eq('id', user.id).single(),
    ])

    if (!allowed) {
      return NextResponse.json({ allowed: false }, { status: 403 })
    }

    return NextResponse.json({
      allowed: true,
      profile: profileResult.data || null,
    })
  } catch (error) {
    console.error('brief access error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
