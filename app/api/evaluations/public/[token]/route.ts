import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getEvaluationKey,
  getEvaluationTokenKey,
  parseEvaluationMetadata,
} from '@/lib/evaluations'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = getSupabaseAdminClient()

    const { data: tokenRow, error: tokenError } = await admin
      .from('settings')
      .select('value')
      .eq('key', getEvaluationTokenKey(params.token))
      .single()

    if (tokenError || !tokenRow?.value) {
      return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    }

    const { data: evaluationRow, error: evaluationError } = await admin
      .from('settings')
      .select('value')
      .eq('key', getEvaluationKey(tokenRow.value))
      .single()

    if (evaluationError || !evaluationRow) {
      return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    }

    const evaluation = parseEvaluationMetadata(evaluationRow.value)
    if (!evaluation) {
      return NextResponse.json({ error: 'Ogiltig utvärdering.' }, { status: 500 })
    }

    const { data: questions, error: questionError } = await admin
      .from('questions')
      .select('id, text, order_index')
      .eq('question_set_id', evaluation.questionSetId)
      .order('order_index')

    if (questionError) {
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    return NextResponse.json({
      evaluation: {
        label: evaluation.label,
        customer: evaluation.customer,
      },
      questions: questions || [],
    })
  } catch (error) {
    console.error('evaluation public fetch error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
