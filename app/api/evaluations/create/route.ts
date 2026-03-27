import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  EvaluationMetadata,
  getEvaluationKey,
  getEvaluationTokenKey,
} from '@/lib/evaluations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { customer, questionSetId, label } = await req.json()

    const normalizedCustomer = typeof customer === 'string' ? customer.trim() : ''
    const normalizedQuestionSetId = typeof questionSetId === 'string' ? questionSetId.trim() : ''
    const normalizedLabel = typeof label === 'string' ? label.trim() : ''

    if (!normalizedCustomer || !normalizedQuestionSetId || !normalizedLabel) {
      return NextResponse.json({ error: 'Kund, frågebatteri och tillfälle krävs.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: questionSet, error: questionSetError } = await admin
      .from('question_sets')
      .select('id, name')
      .eq('id', normalizedQuestionSetId)
      .single()

    if (questionSetError || !questionSet) {
      return NextResponse.json({ error: 'Frågebatteriet kunde inte verifieras.' }, { status: 404 })
    }

    const evaluationId = randomUUID()
    const token = randomUUID()
    const createdAt = new Date().toISOString()

    const metadata: EvaluationMetadata = {
      id: evaluationId,
      token,
      label: normalizedLabel,
      customer: normalizedCustomer,
      questionSetId: questionSet.id,
      questionSetName: questionSet.name,
      createdBy: user.id,
      createdAt,
    }

    const rows = [
      {
        key: getEvaluationKey(evaluationId),
        value: JSON.stringify(metadata),
        updated_at: createdAt,
      },
      {
        key: getEvaluationTokenKey(token),
        value: evaluationId,
        updated_at: createdAt,
      },
    ]

    const { error: upsertError } = await admin.from('settings').upsert(rows)
    if (upsertError) {
      console.error('evaluation create upsert error:', upsertError)
      return NextResponse.json({ error: 'Kunde inte skapa utvärderingen.' }, { status: 500 })
    }

    return NextResponse.json({
      evaluation: metadata,
      publicUrl: `${req.nextUrl.origin}/evaluation/${token}`,
    })
  } catch (error) {
    console.error('evaluation create error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
