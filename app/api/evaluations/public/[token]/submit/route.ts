import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  EvaluationResponseRecord,
  getEvaluationKey,
  getEvaluationParticipantKey,
  getEvaluationResponseKey,
  getEvaluationTokenKey,
  normalizeEvaluationEmail,
  parseEvaluationMetadata,
} from '@/lib/evaluations'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = getSupabaseAdminClient()
    const { email, answers } = await req.json()

    const normalizedEmail = typeof email === 'string' ? normalizeEvaluationEmail(email) : ''
    if (!normalizedEmail || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'E-post och svar krävs.' }, { status: 400 })
    }

    const { data: tokenRow, error: tokenError } = await admin
      .from('settings')
      .select('value')
      .eq('key', getEvaluationTokenKey(params.token))
      .single()

    if (tokenError || !tokenRow?.value) {
      return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    }

    const evaluationId = tokenRow.value

    const { data: evaluationRow, error: evaluationError } = await admin
      .from('settings')
      .select('value')
      .eq('key', getEvaluationKey(evaluationId))
      .single()

    if (evaluationError || !evaluationRow) {
      return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    }

    const evaluation = parseEvaluationMetadata(evaluationRow.value)
    if (!evaluation) {
      return NextResponse.json({ error: 'Ogiltig utvärdering.' }, { status: 500 })
    }

    const normalizedAnswers = answers
      .map((answer: Record<string, unknown>, index: number) => {
        const questionText = typeof answer?.questionText === 'string' ? answer.questionText.trim() : ''
        const answerText = typeof answer?.answer === 'string' ? answer.answer.trim() : ''
        if (!questionText || !answerText) return null

        return {
          questionId: typeof answer?.questionId === 'string' && answer.questionId ? answer.questionId : null,
          questionText,
          orderIndex: typeof answer?.orderIndex === 'number' ? answer.orderIndex : index,
          answer: answerText,
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    if (normalizedAnswers.length === 0) {
      return NextResponse.json({ error: 'Fyll i minst ett svar.' }, { status: 400 })
    }

    const participantKey = getEvaluationParticipantKey(evaluation.id, normalizedEmail)
    const { data: participantRow } = await admin
      .from('settings')
      .select('value')
      .eq('key', participantKey)
      .single()

    const responseId = typeof participantRow?.value === 'string' && participantRow.value
      ? participantRow.value
      : randomUUID()
    const submittedAt = new Date().toISOString()

    const response: EvaluationResponseRecord = {
      responseId,
      evaluationId: evaluation.id,
      email: normalizedEmail,
      submittedAt,
      answers: normalizedAnswers,
    }

    const { error: upsertError } = await admin.from('settings').upsert([
      {
        key: participantKey,
        value: responseId,
        updated_at: submittedAt,
      },
      {
        key: getEvaluationResponseKey(evaluation.id, responseId),
        value: JSON.stringify(response),
        updated_at: submittedAt,
      },
    ])

    if (upsertError) {
      console.error('evaluation submit upsert error:', upsertError)
      return NextResponse.json({ error: 'Kunde inte spara svaret.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('evaluation submit error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
