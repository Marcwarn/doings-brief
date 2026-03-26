import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  BRIEF_BATCH_KEY_PREFIX,
  BriefBatchLookupMap,
  getBatchLookupKey,
  parseBatchMetadata,
} from '@/lib/brief-batches'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { sessionIds } = await req.json()

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ batchLookup: {} satisfies BriefBatchLookupMap })
    }

    const uniqueSessionIds = Array.from(new Set(sessionIds.filter((value): value is string => typeof value === 'string' && value.length > 0)))
    if (uniqueSessionIds.length === 0) {
      return NextResponse.json({ batchLookup: {} satisfies BriefBatchLookupMap })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let sessionsQuery = admin
      .from('brief_sessions')
      .select('id')
      .in('id', uniqueSessionIds)

    if (profile?.role !== 'admin') {
      sessionsQuery = sessionsQuery.eq('consultant_id', user.id)
    }

    const { data: visibleSessions, error: sessionError } = await sessionsQuery
    if (sessionError) {
      return NextResponse.json({ error: 'Kunde inte läsa briefs' }, { status: 500 })
    }

    const allowedIds = (visibleSessions || []).map(session => session.id)
    if (allowedIds.length === 0) {
      return NextResponse.json({ batchLookup: {} satisfies BriefBatchLookupMap })
    }

    const lookupKeys = allowedIds.map(getBatchLookupKey)
    const { data: lookupRows, error: lookupError } = await admin
      .from('settings')
      .select('key, value')
      .in('key', lookupKeys)

    if (lookupError) {
      return NextResponse.json({ error: 'Kunde inte läsa batch-uppslag' }, { status: 500 })
    }

    const batchIds = Array.from(new Set((lookupRows || []).map(row => row.value).filter((value): value is string => Boolean(value))))
    if (batchIds.length === 0) {
      return NextResponse.json({ batchLookup: {} satisfies BriefBatchLookupMap })
    }

    const batchKeys = batchIds.map(batchId => `${BRIEF_BATCH_KEY_PREFIX}${batchId}`)
    const { data: batchRows, error: batchError } = await admin
      .from('settings')
      .select('key, value')
      .in('key', batchKeys)

    if (batchError) {
      return NextResponse.json({ error: 'Kunde inte läsa batchmetadata' }, { status: 500 })
    }

    const batchById = Object.fromEntries(
      (batchRows || [])
        .map(row => parseBatchMetadata(row.value))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .map(batch => [batch.batchId, batch])
    )

    const batchLookup: BriefBatchLookupMap = {}
    for (const row of lookupRows || []) {
      const sessionId = row.key.replace(/^brief_batch_lookup:/, '')
      const batch = row.value ? batchById[row.value] : null
      if (sessionId && batch) {
        batchLookup[sessionId] = batch
      }
    }

    return NextResponse.json({ batchLookup })
  } catch (error) {
    console.error('brief batches fetch error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
