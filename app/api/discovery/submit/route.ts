import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'

type DiscoverySubmitPayload = {
  token?: unknown
  responses?: unknown
}

type SubmittedResponse = {
  questionId: string
  responseType: 'open' | 'choice' | 'scale'
  textValue: string | null
  scaleValue: number | null
  selectedOptions: string[]
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asIntegerOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function normalizeSubmittedResponses(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { responses: [] as SubmittedResponse[], error: 'Inga svar skickades.' }
  }

  const responses: SubmittedResponse[] = []

  for (let index = 0; index < value.length; index += 1) {
    const rawItem = value[index]
    if (!rawItem || typeof rawItem !== 'object') {
      return { responses: [] as SubmittedResponse[], error: `Svar ${index + 1} är ogiltigt.` }
    }

    const item = rawItem as Record<string, unknown>
    const questionId = asTrimmedString(item.questionId)
    const responseType = item.responseType === 'choice' || item.responseType === 'scale' ? item.responseType : 'open'
    const textValue = responseType === 'open' ? asTrimmedString(item.textValue) : ''
    const scaleValue = responseType === 'scale' ? asIntegerOrNull(item.scaleValue) : null
    const selectedOptions = responseType === 'choice' && Array.isArray(item.selectedOptions)
      ? item.selectedOptions.map(option => asTrimmedString(option)).filter(Boolean)
      : []

    if (!questionId) {
      return { responses: [] as SubmittedResponse[], error: `Svar ${index + 1} saknar fråga.` }
    }

    if (responseType === 'open' && !textValue) {
      return { responses: [] as SubmittedResponse[], error: 'Alla öppna frågor måste ha ett svar.' }
    }

    if (responseType === 'scale' && scaleValue === null) {
      return { responses: [] as SubmittedResponse[], error: 'Alla skalfrågor måste ha ett värde.' }
    }

    if (responseType === 'choice' && selectedOptions.length === 0) {
      return { responses: [] as SubmittedResponse[], error: 'Alla valfrågor måste ha minst ett valt alternativ.' }
    }

    responses.push({
      questionId,
      responseType,
      textValue: responseType === 'open' ? textValue : null,
      scaleValue,
      selectedOptions,
    })
  }

  return { responses, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const admin = getSupabaseAdminClient()
    const payload = await req.json() as DiscoverySubmitPayload
    const token = asTrimmedString(payload.token)

    if (!token) {
      return NextResponse.json({ error: 'Länken är ogiltig.' }, { status: 400 })
    }

    const { responses, error: responseError } = normalizeSubmittedResponses(payload.responses)
    if (responseError) {
      return NextResponse.json({ error: responseError }, { status: 400 })
    }

    const { data: session, error: sessionError } = await admin
      .from('discovery_sessions')
      .select('id, template_id, status')
      .eq('token', token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sidan hittades inte.' }, { status: 404 })
    }

    if (session.status === 'submitted') {
      return NextResponse.json({ error: 'Det här formuläret har redan skickats in.' }, { status: 409 })
    }

    const { data: sections, error: sectionsError } = await admin
      .from('discovery_sections')
      .select('id')
      .eq('template_id', session.template_id)

    if (sectionsError) {
      console.error('discovery submit sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera upplägget.' }, { status: 500 })
    }

    const sectionIds = (sections || []).map(section => section.id)
    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, type, max_choices, scale_min, scale_max')
          .in('section_id', sectionIds)
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery submit questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)
    if (responses.length !== questionIds.length) {
      return NextResponse.json({ error: 'Alla frågor måste besvaras innan du skickar.' }, { status: 400 })
    }

    const { data: options, error: optionsError } = questionIds.length > 0
      ? await admin
          .from('discovery_question_options')
          .select('question_id, label')
          .in('question_id', questionIds)
      : { data: [], error: null }

    if (optionsError) {
      console.error('discovery submit options error:', optionsError)
      return NextResponse.json({ error: 'Kunde inte verifiera alternativen för frågorna.' }, { status: 500 })
    }

    const questionById = new Map((questions || []).map(question => [question.id, question]))
    const optionLabelsByQuestionId = new Map<string, Set<string>>()

    for (const option of options || []) {
      const bucket = optionLabelsByQuestionId.get(option.question_id) || new Set<string>()
      bucket.add(option.label)
      optionLabelsByQuestionId.set(option.question_id, bucket)
    }

    for (const response of responses) {
      const question = questionById.get(response.questionId)
      if (!question) {
        return NextResponse.json({ error: 'Ett eller flera svar matchar inte upplägget.' }, { status: 400 })
      }

      if (question.type !== response.responseType) {
        return NextResponse.json({ error: 'Svarstypen matchar inte frågan.' }, { status: 400 })
      }

      if (response.responseType === 'choice') {
        const allowedOptions = optionLabelsByQuestionId.get(response.questionId) || new Set<string>()
        if (response.selectedOptions.some(option => !allowedOptions.has(option))) {
          return NextResponse.json({ error: 'Ett eller flera val är ogiltiga.' }, { status: 400 })
        }

        if (question.max_choices !== null && response.selectedOptions.length > question.max_choices) {
          return NextResponse.json({ error: 'Du har valt för många alternativ i en fråga.' }, { status: 400 })
        }
      }

      if (response.responseType === 'scale') {
        if (
          response.scaleValue === null
          || question.scale_min === null
          || question.scale_max === null
          || response.scaleValue < question.scale_min
          || response.scaleValue > question.scale_max
        ) {
          return NextResponse.json({ error: 'Ett skalvärde är ogiltigt.' }, { status: 400 })
        }
      }
    }

    const { data: insertedResponses, error: insertResponsesError } = await admin
      .from('discovery_responses')
      .insert(responses.map(response => ({
        session_id: session.id,
        question_id: response.questionId,
        response_type: response.responseType,
        text_value: response.textValue,
        scale_value: response.scaleValue,
      })))
      .select('id, question_id')

    if (insertResponsesError || !insertedResponses) {
      console.error('discovery submit insert responses error:', insertResponsesError)
      return NextResponse.json({ error: 'Kunde inte spara svaren.' }, { status: 500 })
    }

    const responseIdByQuestionId = new Map(insertedResponses.map(item => [item.question_id, item.id]))
    const optionRows = responses.flatMap(response => {
      if (response.responseType !== 'choice') return []
      const responseId = responseIdByQuestionId.get(response.questionId)
      if (!responseId) return []

      return response.selectedOptions.map(option => ({
        response_id: responseId,
        option_label: option,
      }))
    })

    if (optionRows.length > 0) {
      const { error: insertOptionsError } = await admin
        .from('discovery_response_options')
        .insert(optionRows)

      if (insertOptionsError) {
        console.error('discovery submit insert options error:', insertOptionsError)
        return NextResponse.json({ error: 'Kunde inte spara alla valda alternativ.' }, { status: 500 })
      }
    }

    const { error: sessionUpdateError } = await admin
      .from('discovery_sessions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (sessionUpdateError) {
      console.error('discovery submit session update error:', sessionUpdateError)
      return NextResponse.json({ error: 'Kunde inte avsluta formuläret.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('discovery submit fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
