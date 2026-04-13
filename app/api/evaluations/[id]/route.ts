import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getEvaluationKey,
  getEvaluationParticipantKey,
  getEvaluationQuestionMetaKey,
  getEvaluationResponsePrefix,
  getEvaluationTokenKey,
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
      evaluation.questionSetId
        ? admin
            .from('question_sets')
            .select('id, name, description')
            .eq('id', evaluation.questionSetId)
            .single()
        : Promise.resolve({ data: null }),
      evaluation.questionSetId
        ? admin
            .from('questions')
            .select('id, text, order_index')
            .eq('question_set_id', evaluation.questionSetId)
            .order('order_index')
        : Promise.resolve({ data: [] }),
      admin
        .from('settings')
        .select('value')
        .like('key', `${getEvaluationResponsePrefix(evaluation.id)}%`),
      evaluation.questionSetId
        ? admin
            .from('settings')
            .select('value')
            .eq('key', getEvaluationQuestionMetaKey(evaluation.questionSetId))
            .single()
        : Promise.resolve({ data: null }),
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

    const fallbackQuestions = (evaluation.draftData?.customQuestions || []).map((question, index) => ({
      id: `draft-${index}`,
      text: question.text,
      order_index: index,
      type: question.type,
    }))

    return NextResponse.json({
      evaluation,
      questionSet: questionSet || null,
      questions: evaluation.questionSetId
        ? (questions || []).map(question => ({
            ...question,
            type: typeByQuestionId.get(question.id) || 'text',
          }))
        : fallbackQuestions,
      responses,
    })
  } catch (error) {
    console.error('evaluation detail error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 })
    }

    const key = `evaluation:${params.id}`
    const { data: row } = await admin.from('settings').select('value').eq('key', key).single()
    const evaluation = parseEvaluationMetadata(row?.value)
    if (!evaluation) return NextResponse.json({ error: 'Utvärderingen hittades inte.' }, { status: 404 })
    if (evaluation.createdBy !== user.id) return NextResponse.json({ error: 'Åtkomst nekad.' }, { status: 403 })

    const normalizedCustomer = typeof body.customer === 'string' ? body.customer.trim() : evaluation.customer
    const normalizedLabel = typeof body.label === 'string' ? body.label.trim() : evaluation.label
    const normalizedCustomQuestionSetName = typeof body.customQuestionSetName === 'string'
      ? body.customQuestionSetName.trim()
      : ''
    const normalizedStatus = body.status === 'draft' ? 'draft' : 'active'
    const normalizedCustomQuestions = Array.isArray(body.customQuestions)
      ? body.customQuestions
        .map((item, index) => {
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
      : null

    const wantsQuestionUpdate = normalizedCustomQuestions !== null

    if (normalizedStatus === 'active' && (!normalizedCustomer || !normalizedLabel)) {
      return NextResponse.json({ error: 'Kund och tillfälle krävs.' }, { status: 400 })
    }

    let resolvedCollectEmail = evaluation.collectEmail
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin' && typeof body.collectEmail === 'boolean') {
      resolvedCollectEmail = body.collectEmail
    }

    let resolvedQuestionSetId = evaluation.questionSetId
    let resolvedQuestionSetName = evaluation.questionSetName

    if (normalizedStatus === 'active' && wantsQuestionUpdate && !resolvedQuestionSetId) {
      if (!normalizedCustomQuestionSetName) {
        return NextResponse.json({ error: 'Ge frågorna ett namn innan du sparar utvärderingen.' }, { status: 400 })
      }

      if (normalizedCustomQuestions.length === 0) {
        return NextResponse.json({ error: 'Lägg till minst en fråga i utvärderingen.' }, { status: 400 })
      }

      const { data: createdQuestionSet, error: questionSetCreateError } = await admin
        .from('question_sets')
        .insert({
          user_id: user.id,
          name: normalizedCustomQuestionSetName,
          description: 'Skapad från utkast i utvärderingsflödet',
        })
        .select('id, name')
        .single()

      if (questionSetCreateError || !createdQuestionSet) {
        return NextResponse.json({ error: 'Kunde inte skapa frågorna för utvärderingen.' }, { status: 500 })
      }

      resolvedQuestionSetId = createdQuestionSet.id
      resolvedQuestionSetName = createdQuestionSet.name
    }

    if (normalizedStatus === 'active' && wantsQuestionUpdate) {
      if (!resolvedQuestionSetId) {
        return NextResponse.json({ error: 'Frågeupplägget kunde inte skapas.' }, { status: 500 })
      }

      if (!normalizedCustomQuestionSetName) {
        return NextResponse.json({ error: 'Ge frågorna ett namn innan du sparar utvärderingen.' }, { status: 400 })
      }

      if (normalizedCustomQuestions.length === 0) {
        return NextResponse.json({ error: 'Lägg till minst en fråga i utvärderingen.' }, { status: 400 })
      }

      const { error: questionSetUpdateError } = await admin
        .from('question_sets')
        .update({ name: normalizedCustomQuestionSetName })
        .eq('id', resolvedQuestionSetId)

      if (questionSetUpdateError) {
        return NextResponse.json({ error: 'Kunde inte uppdatera frågornas namn.' }, { status: 500 })
      }

      const { error: questionDeleteError } = await admin
        .from('questions')
        .delete()
        .eq('question_set_id', resolvedQuestionSetId)

      if (questionDeleteError) {
        return NextResponse.json({ error: 'Kunde inte uppdatera utvärderingens frågor.' }, { status: 500 })
      }

      const { data: questionInsertRows, error: questionInsertError } = await admin
        .from('questions')
        .insert(normalizedCustomQuestions.map((item, index) => ({
          question_set_id: resolvedQuestionSetId,
          text: item.text,
          order_index: index,
        })))
        .select('id, order_index')

      if (questionInsertError || !questionInsertRows) {
        return NextResponse.json({ error: 'Kunde inte spara utvärderingens frågor.' }, { status: 500 })
      }

      const questionMetaRows = questionInsertRows.map((row, index) => ({
        questionId: row.id,
        orderIndex: typeof row.order_index === 'number' ? row.order_index : index,
        type: normalizedCustomQuestions[index]?.type || 'text',
      }))

      const { error: questionMetaError } = await admin
        .from('settings')
        .upsert({
          key: getEvaluationQuestionMetaKey(resolvedQuestionSetId),
          value: JSON.stringify(questionMetaRows),
          updated_at: new Date().toISOString(),
        })

      if (questionMetaError) {
        return NextResponse.json({ error: 'Kunde inte spara frågetyperna.' }, { status: 500 })
      }

      resolvedQuestionSetName = normalizedCustomQuestionSetName
    }

    const updated = {
      ...evaluation,
      customer: normalizedCustomer,
      label: normalizedLabel || 'Utkast',
      collectEmail: resolvedCollectEmail,
      questionSetId: resolvedQuestionSetId,
      questionSetName: resolvedQuestionSetName,
      senderGroupId: 'senderGroupId' in body
        ? (typeof body.senderGroupId === 'string' && body.senderGroupId.trim() ? body.senderGroupId.trim() : null)
        : evaluation.senderGroupId,
      status: normalizedStatus,
      draftData: {
        customQuestionSetName: normalizedCustomQuestionSetName || resolvedQuestionSetName || null,
        customQuestions: normalizedCustomQuestions === null
          ? (evaluation.draftData?.customQuestions || [])
          : normalizedCustomQuestions.map(item => ({ text: item.text, type: item.type })),
        activeTab: typeof body.draftData?.activeTab === 'string' ? body.draftData.activeTab : evaluation.draftData?.activeTab || null,
        followupDeliveryMode: typeof body.draftData?.followupDeliveryMode === 'string'
          ? body.draftData.followupDeliveryMode
          : evaluation.draftData?.followupDeliveryMode || null,
        activeFollowupStepId: typeof body.draftData?.activeFollowupStepId === 'string'
          ? body.draftData.activeFollowupStepId
          : evaluation.draftData?.activeFollowupStepId || null,
        followupSteps: Array.isArray(body.draftData?.followupSteps)
          ? body.draftData.followupSteps
          : evaluation.draftData?.followupSteps || [],
      },
    }

    if (normalizedStatus === 'active') {
      updated.draftData = updated.draftData
    }

    const { error } = await admin.from('settings').upsert({ key, value: JSON.stringify(updated), updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: 'Kunde inte uppdatera utvärderingen.' }, { status: 500 })

    return NextResponse.json({
      ok: true,
      evaluation: updated,
      senderGroupId: updated.senderGroupId,
      publicUrl: `${req.nextUrl.origin}/evaluation/${updated.token}`,
    })
  } catch (error) {
    console.error('evaluation PATCH error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
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

    const [{ data: responseRows, error: responseError }, { data: allEvaluationRows, error: allEvaluationsError }] = await Promise.all([
      admin
        .from('settings')
        .select('key, value')
        .like('key', `${getEvaluationResponsePrefix(evaluation.id)}%`),
      admin
        .from('settings')
        .select('key, value')
        .like('key', 'evaluation:%'),
    ])

    if (responseError || allEvaluationsError) {
      return NextResponse.json({ error: 'Kunde inte läsa all data för radering.' }, { status: 500 })
    }

    const responses = (responseRows || [])
      .map(row => parseEvaluationResponse(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    const questionSetStillUsed = evaluation.questionSetId ? (allEvaluationRows || [])
      .map(row => parseEvaluationMetadata(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .some(item => item.id !== evaluation.id && item.questionSetId === evaluation.questionSetId)
      : false

    const settingsKeys = [
      getEvaluationKey(evaluation.id),
      getEvaluationTokenKey(evaluation.token),
      ...responses.map(response => getEvaluationParticipantKey(evaluation.id, response.email)),
      ...(responseRows || []).map(row => row.key),
    ]
    if (evaluation.questionSetId) {
      settingsKeys.push(getEvaluationQuestionMetaKey(evaluation.questionSetId))
    }

    const uniqueSettingsKeys = Array.from(new Set(
      questionSetStillUsed
        ? settingsKeys.filter(key => key !== getEvaluationQuestionMetaKey(evaluation.questionSetId))
        : settingsKeys
    ))

    if (uniqueSettingsKeys.length > 0) {
      const { error: settingsDeleteError } = await admin
        .from('settings')
        .delete()
        .in('key', uniqueSettingsKeys)

      if (settingsDeleteError) {
        console.error('evaluation delete settings error:', settingsDeleteError)
        return NextResponse.json({ error: 'Kunde inte ta bort utvärderingen.' }, { status: 500 })
      }
    }

    if (evaluation.questionSetId && !questionSetStillUsed) {
      const { error: questionDeleteError } = await admin
        .from('questions')
        .delete()
        .eq('question_set_id', evaluation.questionSetId)

      if (questionDeleteError) {
        console.error('evaluation delete questions error:', questionDeleteError)
        return NextResponse.json({ error: 'Kunde inte ta bort utvärderingsfrågorna.' }, { status: 500 })
      }

      const { error: questionSetDeleteError } = await admin
        .from('question_sets')
        .delete()
        .eq('id', evaluation.questionSetId)

      if (questionSetDeleteError) {
        console.error('evaluation delete question set error:', questionSetDeleteError)
        return NextResponse.json({ error: 'Kunde inte ta bort frågeupplägget.' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      deletedEvaluationId: evaluation.id,
      deletedResponses: responses.length,
      deletedQuestionSet: Boolean(evaluation.questionSetId) && !questionSetStillUsed,
    })
  } catch (error) {
    console.error('evaluation delete error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
