import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getBatchSettingKey,
  getDispatchSettingKey,
  parseDispatchMetadata,
} from '@/lib/brief-batches'

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const dispatchId = context.params.id
    if (!dispatchId) {
      return NextResponse.json({ error: 'dispatchId is required' }, { status: 400 })
    }

    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const metadataKeys = [
      getDispatchSettingKey(dispatchId),
      getBatchSettingKey(dispatchId),
    ]

    const { data: metadataRows, error: metadataError } = await admin
      .from('settings')
      .select('key, value')
      .in('key', metadataKeys)

    if (metadataError) {
      return NextResponse.json({ error: 'Kunde inte läsa utskicket' }, { status: 500 })
    }

    const dispatch = (metadataRows || [])
      .map(row => parseDispatchMetadata(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .find(value => value.dispatchId === dispatchId)

    if (!dispatch) {
      return NextResponse.json({ error: 'Utskicket hittades inte' }, { status: 404 })
    }

    let sessionsQuery = admin
      .from('brief_sessions')
      .select('*')
      .in('id', dispatch.sessionIds)
      .order('created_at', { ascending: false })

    if (profile?.role !== 'admin') {
      sessionsQuery = sessionsQuery.eq('consultant_id', user.id)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery
    if (sessionsError) {
      return NextResponse.json({ error: 'Kunde inte läsa utskickets mottagare' }, { status: 500 })
    }

    if (profile?.role !== 'admin' && dispatch.consultantId && dispatch.consultantId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      dispatch,
      sessions: sessions || [],
    })
  } catch (error) {
    console.error('brief dispatch fetch error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
