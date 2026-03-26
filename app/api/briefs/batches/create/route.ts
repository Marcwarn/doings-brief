import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { BriefBatchMetadata, getBatchLookupKey, getBatchSettingKey } from '@/lib/brief-batches'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { batchId, label, organisation, questionSetId, sessionIds } = await req.json()

    if (!batchId || !Array.isArray(sessionIds) || sessionIds.length === 0) {
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

    const metadata: BriefBatchMetadata = {
      batchId,
      label: typeof label === 'string' && label.trim() ? label.trim() : 'Utskick',
      organisation: typeof organisation === 'string' && organisation.trim() ? organisation.trim() : null,
      consultantId: user.id,
      questionSetId: typeof questionSetId === 'string' && questionSetId ? questionSetId : null,
      sessionIds: uniqueSessionIds,
      createdAt: new Date().toISOString(),
    }

    const rows = [
      {
        key: getBatchSettingKey(batchId),
        value: JSON.stringify(metadata),
        updated_at: metadata.createdAt,
      },
      ...uniqueSessionIds.map(sessionId => ({
        key: getBatchLookupKey(sessionId),
        value: batchId,
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
