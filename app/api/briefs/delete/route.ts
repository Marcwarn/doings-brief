import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getBatchLookupKey,
  getBatchSettingKey,
  getBriefSummaryKey,
  getDispatchLookupKey,
  getDispatchSettingKey,
  parseDispatchMetadata,
} from '@/lib/brief-batches'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { sessionIds } = await req.json()

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'Inga sessioner valdes' }, { status: 400 })
    }

    const uniqueSessionIds = Array.from(new Set(
      sessionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ))

    if (uniqueSessionIds.length === 0) {
      return NextResponse.json({ error: 'Inga giltiga sessioner valdes' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Kunde inte verifiera användaren' }, { status: 500 })
    }

    let sessionsQuery = admin
      .from('brief_sessions')
      .select('id, consultant_id')
      .in('id', uniqueSessionIds)

    if (profile?.role !== 'admin') {
      sessionsQuery = sessionsQuery.eq('consultant_id', user.id)
    }

    const { data: ownedSessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      return NextResponse.json({ error: 'Kunde inte verifiera briefs' }, { status: 500 })
    }

    if (!ownedSessions || ownedSessions.length !== uniqueSessionIds.length) {
      return NextResponse.json({ error: 'Alla valda briefs kunde inte verifieras' }, { status: 403 })
    }

    const targetSessionIds = ownedSessions.map(session => session.id)
    const targetSessionIdSet = new Set(targetSessionIds)
    const lookupKeys = [
      ...targetSessionIds.map(getDispatchLookupKey),
      ...targetSessionIds.map(getBatchLookupKey),
    ]

    const { data: lookupRows, error: lookupError } = await admin
      .from('settings')
      .select('key, value')
      .in('key', lookupKeys)

    if (lookupError) {
      return NextResponse.json({ error: 'Kunde inte läsa batch-uppslag' }, { status: 500 })
    }

    const dispatchIds = Array.from(new Set(
      (lookupRows || [])
        .map(row => typeof row.value === 'string' ? row.value.trim() : '')
        .filter(Boolean)
    ))

    const metadataKeys = dispatchIds.flatMap(dispatchId => [
      getDispatchSettingKey(dispatchId),
      getBatchSettingKey(dispatchId),
    ])

    const { data: metadataRows, error: metadataError } = metadataKeys.length === 0
      ? { data: [], error: null }
      : await admin
          .from('settings')
          .select('key, value')
          .in('key', metadataKeys)

    if (metadataError) {
      return NextResponse.json({ error: 'Kunde inte läsa utskicksmetadata' }, { status: 500 })
    }

    const metadataByDispatchId = new Map(
      (metadataRows || [])
        .map(row => parseDispatchMetadata(row.value))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .map(metadata => [metadata.dispatchId, metadata])
    )

    const now = new Date().toISOString()
    const keysToDelete = new Set<string>([
      ...targetSessionIds.map(getDispatchLookupKey),
      ...targetSessionIds.map(getBatchLookupKey),
      ...targetSessionIds.map(getBriefSummaryKey),
    ])
    const metadataRowsToUpsert: Array<{ key: string; value: string; updated_at: string }> = []

    for (const dispatchId of dispatchIds) {
      const metadata = metadataByDispatchId.get(dispatchId)
      if (!metadata) continue

      const remainingSessionIds = metadata.sessionIds.filter(sessionId => !targetSessionIdSet.has(sessionId))
      if (remainingSessionIds.length === 0) {
        keysToDelete.add(getDispatchSettingKey(dispatchId))
        keysToDelete.add(getBatchSettingKey(dispatchId))
        for (const sessionId of metadata.sessionIds) {
          keysToDelete.add(getDispatchLookupKey(sessionId))
          keysToDelete.add(getBatchLookupKey(sessionId))
          keysToDelete.add(getBriefSummaryKey(sessionId))
        }
        continue
      }

      const nextMetadata = {
        ...metadata,
        sessionIds: remainingSessionIds,
        contacts: metadata.contacts.filter(contact => !targetSessionIdSet.has(contact.sessionId)),
      }

      metadataRowsToUpsert.push(
        {
          key: getDispatchSettingKey(dispatchId),
          value: JSON.stringify(nextMetadata),
          updated_at: now,
        },
        {
          key: getBatchSettingKey(dispatchId),
          value: JSON.stringify(nextMetadata),
          updated_at: now,
        }
      )
    }

    const { error: responsesError } = await admin
      .from('brief_responses')
      .delete()
      .in('session_id', targetSessionIds)

    if (responsesError) {
      return NextResponse.json({ error: 'Kunde inte radera briefsvar' }, { status: 500 })
    }

    const { error: answersError } = await admin
      .from('brief_answers')
      .delete()
      .in('session_id', targetSessionIds)

    if (answersError) {
      return NextResponse.json({ error: 'Kunde inte radera sparade svar' }, { status: 500 })
    }

    const { error: deleteSessionsError, count } = await admin
      .from('brief_sessions')
      .delete({ count: 'exact' })
      .in('id', targetSessionIds)

    if (deleteSessionsError) {
      return NextResponse.json({ error: 'Kunde inte radera briefs' }, { status: 500 })
    }

    if ((count || 0) !== targetSessionIds.length) {
      return NextResponse.json({ error: 'Alla valda briefs kunde inte raderas' }, { status: 403 })
    }

    if (metadataRowsToUpsert.length > 0) {
      const { error: upsertError } = await admin
        .from('settings')
        .upsert(metadataRowsToUpsert)

      if (upsertError) {
        return NextResponse.json({ error: 'Kunde inte uppdatera utskicksmetadata' }, { status: 500 })
      }
    }

    if (keysToDelete.size > 0) {
      const { error: deleteSettingsError } = await admin
        .from('settings')
        .delete()
        .in('key', Array.from(keysToDelete))

      if (deleteSettingsError) {
        return NextResponse.json({ error: 'Kunde inte städa upp metadata' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCount: targetSessionIds.length,
      deletedSessionIds: targetSessionIds,
    })
  } catch (error) {
    console.error('brief delete error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
