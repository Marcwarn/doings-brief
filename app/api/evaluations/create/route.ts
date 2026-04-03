import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  EvaluationMetadata,
  getEvaluationKey,
  getEvaluationQuestionMetaKey,
  getEvaluationTokenKey,
} from '@/lib/evaluations'
import { ensureSenderGroup } from '@/lib/sender'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { customer, questionSetId, label, collectEmail, customQuestionSetName, customQuestions } = await req.json()

    const normalizedCustomer = typeof customer === 'string' ? customer.trim() : ''
    const normalizedQuestionSetId = typeof questionSetId === 'string' ? questionSetId.trim() : ''
    const normalizedLabel = typeof label === 'string' ? label.trim() : ''
    const normalizedCustomQuestionSetName = typeof customQuestionSetName === 'string' ? customQuestionSetName.trim() : ''
    const normalizedCustomQuestions = Array.isArray(customQuestions)
      ? customQuestions
        .map((item, index) => {
          if (typeof item === 'string') {
            const text = item.trim()
            return text ? { text, type: 'text' as const, orderIndex: index } : null
          }

          if (!item || typeof item !== 'object') return null
          const candidate = item as Record<string, unknown>
          const text = typeof candidate.text === 'string' ? candidate.text.trim() : ''
          if (!text) return null

          return {
            text,
            type: candidate.type === 'scale_1_5' ? 'scale_1_5' as const : 'text' as const,
            orderIndex: index,
          }
        })
        .filter((value): value is { text: string; type: 'text' | 'scale_1_5'; orderIndex: number } => Boolean(value))
      : []

    if (!normalizedCustomer || !normalizedLabel) {
      return NextResponse.json({ error: 'Kund och tillfälle krävs.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const resolvedCollectEmail = profile?.role === 'admin'
      ? collectEmail !== false
      : true

    let resolvedQuestionSetId = normalizedQuestionSetId
    let resolvedQuestionSetName: string | null = null

    if (normalizedCustomQuestions.length > 0) {
      if (!normalizedCustomQuestionSetName) {
        return NextResponse.json({ error: 'Ge frågorna ett namn innan du skapar utvärderingen.' }, { status: 400 })
      }

      const { data: createdQuestionSet, error: questionSetCreateError } = await admin
        .from('question_sets')
        .insert({
          user_id: user.id,
          name: normalizedCustomQuestionSetName,
          description: normalizedQuestionSetId
            ? 'Skapad i utvärderingsflödet från tidigare frågor'
            : 'Skapad direkt i utvärderingsflödet',
        })
        .select('id, name')
        .single()

      if (questionSetCreateError || !createdQuestionSet) {
        return NextResponse.json({ error: 'Kunde inte skapa frågorna för utvärderingen.' }, { status: 500 })
      }

      const { data: questionInsertRows, error: questionInsertError } = await admin
        .from('questions')
        .insert(normalizedCustomQuestions.map((item, index) => ({
          question_set_id: createdQuestionSet.id,
          text: item.text,
          order_index: index,
        })))
        .select('id, order_index')

      if (questionInsertError || !questionInsertRows) {
        return NextResponse.json({ error: 'Kunde inte spara frågorna för utvärderingen.' }, { status: 500 })
      }

      const questionMetaRows = questionInsertRows.map((row, index) => ({
        questionId: row.id,
        orderIndex: typeof row.order_index === 'number' ? row.order_index : index,
        type: normalizedCustomQuestions[index]?.type || 'text',
      }))

      const { error: questionMetaError } = await admin
        .from('settings')
        .upsert({
          key: getEvaluationQuestionMetaKey(createdQuestionSet.id),
          value: JSON.stringify(questionMetaRows),
          updated_at: new Date().toISOString(),
        })

      if (questionMetaError) {
        return NextResponse.json({ error: 'Kunde inte spara frågetypen för utvärderingen.' }, { status: 500 })
      }

      resolvedQuestionSetId = createdQuestionSet.id
      resolvedQuestionSetName = createdQuestionSet.name
    } else {
      if (!normalizedQuestionSetId) {
        return NextResponse.json({ error: 'Välj tidigare frågor eller skapa egna frågor.' }, { status: 400 })
      }

      const { data: questionSet, error: questionSetError } = await admin
        .from('question_sets')
        .select('id, name')
        .eq('id', normalizedQuestionSetId)
        .single()

      if (questionSetError || !questionSet) {
        return NextResponse.json({ error: 'Frågorna kunde inte verifieras.' }, { status: 404 })
      }

      resolvedQuestionSetId = questionSet.id
      resolvedQuestionSetName = questionSet.name
    }

    const evaluationId = randomUUID()
    const token = randomUUID()
    const createdAt = new Date().toISOString()

    // Reuse or create a customer-specific sender.net group so all training responses
    // for the same customer flow into the same automation bucket.
    let senderGroupId: string | null = null
    if (process.env.SENDER_API_KEY) {
      const group = await ensureSenderGroup(normalizedCustomer)
      if (group?.id) senderGroupId = group.id
    }

    const metadata: EvaluationMetadata = {
      id: evaluationId,
      token,
      label: normalizedLabel,
      customer: normalizedCustomer,
      questionSetId: resolvedQuestionSetId,
      questionSetName: resolvedQuestionSetName,
      collectEmail: resolvedCollectEmail,
      createdBy: user.id,
      createdAt,
      senderGroupId,
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
