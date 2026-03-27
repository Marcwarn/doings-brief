import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { hasBriefAccess, listBriefAccessRecords, listInferredBriefUserIds } from '@/lib/brief-access'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = getSupabaseRequestClient()
  const admin = getSupabaseAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = await hasBriefAccess(admin, user.id)

  if (error || profile?.role !== 'admin' || !allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { admin }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const [accessRecords, inferredUserIds] = await Promise.all([
      listBriefAccessRecords(auth.admin),
      listInferredBriefUserIds(auth.admin),
    ])
    const allowedUserIds = Array.from(new Set([
      ...accessRecords.filter(record => record.enabled !== false).map(record => record.userId),
      ...Array.from(inferredUserIds),
    ]))

    const { data, error } = await auth.admin
      .from('profiles')
      .select('*')
      .in('id', allowedUserIds.length > 0 ? allowedUserIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profiles: data || [] })
  } catch (error) {
    console.error('admin users list error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { id, fields } = await req.json()
    const normalizedId = typeof id === 'string' ? id.trim() : ''

    if (!normalizedId || !fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'Ogiltig uppdatering' }, { status: 400 })
    }

    const allowedFields = ['full_name', 'sender_email', 'role'] as const
    const updateFields = Object.fromEntries(
      Object.entries(fields).filter(([key]) => allowedFields.includes(key as (typeof allowedFields)[number]))
    )

    const { data, error } = await auth.admin
      .from('profiles')
      .update(updateFields)
      .eq('id', normalizedId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, profile: data })
  } catch (error) {
    console.error('admin users patch error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
