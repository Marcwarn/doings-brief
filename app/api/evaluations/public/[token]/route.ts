import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getEvaluationKey,
  getEvaluationQuestionMetaKey,
  getEvaluationTokenKey,
  parseEvaluationQuestionMetaList,
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

    if (evaluation.status !== 'active' || !evaluation.questionSetId) {
      return NextResponse.json({ error: 'Utvärderingen är inte publicerad ännu.' }, { status: 404 })
    }

    const [{ data: questions, error: questionError }, { data: questionMetaRow }] = await Promise.all([
      admin
        .from('questions')
        .select('id, text, order_index')
        .eq('question_set_id', evaluation.questionSetId)
        .order('order_index'),
      admin
        .from('settings')
        .select('value')
        .eq('key', getEvaluationQuestionMetaKey(evaluation.questionSetId))
        .single(),
    ])

    if (questionError) {
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    const questionMeta = parseEvaluationQuestionMetaList(questionMetaRow?.value)
    const typeByQuestionId = new Map(questionMeta.map(item => [item.questionId, item.type]))

    return NextResponse.json({
      evaluation: {
        label: evaluation.label,
        customer: evaluation.customer,
        collectEmail: evaluation.collectEmail,
      },
      questions: (questions || []).map(question => ({
        ...question,
        type: typeByQuestionId.get(question.id) || 'text',
      })),
    })
  } catch (error) {
    console.error('evaluation public fetch error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
