import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getEvaluationKey,
  getEvaluationQuestionMetaKey,
  getEvaluationResponsePrefix,
  parseEvaluationQuestionMetaList,
  parseEvaluationMetadata,
  parseEvaluationResponse,
} from '@/lib/evaluations'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
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

    const { data: evaluationRow, error: evaluationError } = await admin
      .from('settings')
      .select('value')
      .eq('key', getEvaluationKey(params.id))
      .single()

    if (evaluationError || !evaluationRow) {
      return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    }

    const evaluation = parseEvaluationMetadata(evaluationRow.value)
    if (!evaluation) {
      return NextResponse.json({ error: 'Ogiltig utvärderingsdata.' }, { status: 500 })
    }

    if (profile?.role !== 'admin' && evaluation.createdBy !== user.id) {
      return NextResponse.json({ error: 'Du har inte åtkomst till utvärderingen.' }, { status: 403 })
    }

    const [{ data: questionSet }, { data: questions }, { data: responseRows, error: responseError }, { data: questionMetaRow }] = await Promise.all([
      admin
        .from('question_sets')
        .select('id, name, description')
        .eq('id', evaluation.questionSetId)
        .single(),
      admin
        .from('questions')
        .select('id, text, order_index')
        .eq('question_set_id', evaluation.questionSetId)
        .order('order_index'),
      admin
        .from('settings')
        .select('value')
        .like('key', `${getEvaluationResponsePrefix(evaluation.id)}%`),
      admin
        .from('settings')
        .select('value')
        .eq('key', getEvaluationQuestionMetaKey(evaluation.questionSetId))
        .single(),
    ])

    if (responseError) {
      return NextResponse.json({ error: 'Kunde inte läsa utvärderingssvaren.' }, { status: 500 })
    }

    const questionMeta = parseEvaluationQuestionMetaList(questionMetaRow?.value)
    const typeByQuestionId = new Map(questionMeta.map(item => [item.questionId, item.type]))

    const responses = (responseRows || [])
      .map(row => parseEvaluationResponse(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    return NextResponse.json({
      evaluation,
      questionSet: questionSet || null,
      questions: (questions || []).map(question => ({
        ...question,
        type: typeByQuestionId.get(question.id) || 'text',
      })),
      responses,
    })
  } catch (error) {
    console.error('evaluation detail error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
