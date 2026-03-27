import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  BriefDispatchMetadata,
  getBatchLookupKey,
  getBatchSettingKey,
  getDispatchLookupKey,
  getDispatchSettingKey,
} from '@/lib/brief-batches'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { dispatchId, batchId, label, organisation, questionSetId, sessionIds, contacts } = await req.json()
    const resolvedDispatchId = typeof dispatchId === 'string' && dispatchId
      ? dispatchId
      : (typeof batchId === 'string' ? batchId : '')

    if (!resolvedDispatchId || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'Ogiltig payload' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const uniqueSessionIds = Array.from(new Set(sessionIds.filter((value): value is string => typeof value === 'string' && value.length > 0)))
    if (uniqueSessionIds.length === 0) {
      return NextResponse.json({ error: 'Inga giltiga sessioner' }, { status: 400 })
    }

    const { data: sessions, error: sessionError } = await admin
      .from('brief_sessions')
      .select('id, consultant_id')
      .in('id', uniqueSessionIds)
      .eq('consultant_id', user.id)

    if (sessionError) {
      return NextResponse.json({ error: 'Kunde inte verifiera sessionerna' }, { status: 500 })
    }

    if (!sessions || sessions.length !== uniqueSessionIds.length) {
      return NextResponse.json({ error: 'Alla sessioner kunde inte verifieras' }, { status: 403 })
    }

    const normalizedContacts = Array.isArray(contacts)
      ? contacts
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const candidate = item as Record<string, unknown>
            const sessionId = typeof candidate.sessionId === 'string' ? candidate.sessionId.trim() : ''
            const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
            const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : ''
            const role = typeof candidate.role === 'string' && candidate.role.trim() ? candidate.role.trim() : null

            if (!sessionId || !email) return null

            return {
              sessionId,
              name: name || email,
              email,
              role,
            }
          })
          .filter((value): value is NonNullable<typeof value> => Boolean(value))
      : []

    const metadata: BriefDispatchMetadata = {
      dispatchId: resolvedDispatchId,
      label: typeof label === 'string' && label.trim() ? label.trim() : 'Utskick',
      organisation: typeof organisation === 'string' && organisation.trim() ? organisation.trim() : null,
      consultantId: user.id,
      questionSetId: typeof questionSetId === 'string' && questionSetId ? questionSetId : null,
      sessionIds: uniqueSessionIds,
      contacts: normalizedContacts,
      createdAt: new Date().toISOString(),
    }

    const rows = [
      {
        key: getDispatchSettingKey(resolvedDispatchId),
        value: JSON.stringify(metadata),
        updated_at: metadata.createdAt,
      },
      {
        key: getBatchSettingKey(resolvedDispatchId),
        value: JSON.stringify(metadata),
        updated_at: metadata.createdAt,
      },
      ...uniqueSessionIds.map(sessionId => ({
        key: getDispatchLookupKey(sessionId),
        value: resolvedDispatchId,
        updated_at: metadata.createdAt,
      })),
      ...uniqueSessionIds.map(sessionId => ({
        key: getBatchLookupKey(sessionId),
        value: resolvedDispatchId,
        updated_at: metadata.createdAt,
      })),
    ]

    const { error: upsertError } = await admin
      .from('settings')
      .upsert(rows)

    if (upsertError) {
      console.error('brief batch upsert error:', upsertError)
      return NextResponse.json({ error: 'Kunde inte spara batchmetadata' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('brief batch create error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
