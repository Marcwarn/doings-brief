import { NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  EVALUATION_KEY_PREFIX,
  EVALUATION_RESPONSE_PREFIX,
  parseEvaluationMetadata,
  parseEvaluationResponse,
} from '@/lib/evaluations'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    const { data: evaluationRows, error: evaluationError } = await admin
      .from('settings')
      .select('key, value')
      .like('key', `${EVALUATION_KEY_PREFIX}%`)

    if (evaluationError) {
      return NextResponse.json({ error: 'Kunde inte läsa utvärderingar.' }, { status: 500 })
    }

    const evaluations = (evaluationRows || [])
      .map(row => parseEvaluationMetadata(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .filter(item => profile?.role === 'admin' || item.createdBy === user.id)

    const { data: responseRows, error: responseError } = await admin
      .from('settings')
      .select('key, value')
      .like('key', `${EVALUATION_RESPONSE_PREFIX}%`)

    if (responseError) {
      return NextResponse.json({ error: 'Kunde inte läsa utvärderingssvar.' }, { status: 500 })
    }

    const responseCounts = new Map<string, number>()
    for (const row of responseRows || []) {
      const response = parseEvaluationResponse(row.value)
      if (!response) continue
      responseCounts.set(response.evaluationId, (responseCounts.get(response.evaluationId) || 0) + 1)
    }

    return NextResponse.json({
      evaluations: evaluations
        .map(evaluation => ({
          ...evaluation,
          responseCount: responseCounts.get(evaluation.id) || 0,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    })
  } catch (error) {
    console.error('evaluation list error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
