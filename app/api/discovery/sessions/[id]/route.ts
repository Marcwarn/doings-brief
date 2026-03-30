import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const sessionId = typeof params.id === 'string' ? params.id.trim() : ''
    if (!sessionId) {
      return NextResponse.json({ error: 'Id saknas.' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await admin
      .from('discovery_sessions')
      .select('id, consultant_id, template_id, response_mode, client_name, client_email, client_organisation, status, created_at, submitted_at')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Svaret hittades inte.' }, { status: 404 })
    }

    if (session.consultant_id !== user.id) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 403 })
    }

    if (session.response_mode === 'anonymous') {
      return NextResponse.json({ error: 'Anonyma Discovery-svar öppnas i Data-fliken under kundens discovery.' }, { status: 409 })
    }

    const [{ data: template, error: templateError }, { data: sections, error: sectionsError }] = await Promise.all([
      admin
        .from('discovery_templates')
        .select('id, name, intro_title, intro_text')
        .eq('id', session.template_id)
        .single(),
      admin
        .from('discovery_sections')
        .select('id, label, description, order_index')
        .eq('template_id', session.template_id)
        .order('order_index'),
    ])

    if (templateError || !template) {
      return NextResponse.json({ error: 'Upplägget hittades inte.' }, { status: 404 })
    }

    if (sectionsError) {
      console.error('discovery session sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte läsa temana.' }, { status: 500 })
    }

    const sectionIds = (sections || []).map(section => section.id)
    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, section_id, type, text, order_index, max_choices, scale_min, scale_max, scale_min_label, scale_max_label')
          .in('section_id', sectionIds)
          .order('order_index')
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery session questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)

    const [{ data: responses, error: responsesError }, { data: responseOptions, error: responseOptionsError }] = await Promise.all([
      questionIds.length > 0
        ? admin
            .from('discovery_responses')
            .select('id, question_id, response_type, text_value, scale_value, created_at')
            .eq('session_id', session.id)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length > 0
        ? admin
            .from('discovery_response_options')
            .select('id, response_id, option_label')
        : Promise.resolve({ data: [], error: null }),
    ])

    if (responsesError) {
      console.error('discovery session responses error:', responsesError)
      return NextResponse.json({ error: 'Kunde inte läsa svaren.' }, { status: 500 })
    }

    if (responseOptionsError) {
      console.error('discovery session response options error:', responseOptionsError)
      return NextResponse.json({ error: 'Kunde inte läsa valda alternativ.' }, { status: 500 })
    }

    const responseIds = new Set((responses || []).map(response => response.id))
    const optionsByResponseId = new Map<string, string[]>()

    for (const option of responseOptions || []) {
      if (!responseIds.has(option.response_id)) continue
      const bucket = optionsByResponseId.get(option.response_id) || []
      bucket.push(option.option_label)
      optionsByResponseId.set(option.response_id, bucket)
    }

    const responseByQuestionId = new Map((responses || []).map(response => [
      response.question_id,
      {
        id: response.id,
        responseType: response.response_type,
        textValue: response.text_value,
        scaleValue: response.scale_value,
        selectedOptions: optionsByResponseId.get(response.id) || [],
        createdAt: response.created_at,
      },
    ]))

    const questionsBySectionId = new Map<string, Array<{
      id: string
      type: 'open' | 'choice' | 'scale'
      text: string
      orderIndex: number
      response: {
        id: string
        responseType: 'open' | 'choice' | 'scale'
        textValue: string | null
        scaleValue: number | null
        selectedOptions: string[]
        createdAt: string
      } | null
    }>>()

    for (const question of questions || []) {
      const bucket = questionsBySectionId.get(question.section_id) || []
      bucket.push({
        id: question.id,
        type: question.type,
        text: question.text,
        orderIndex: question.order_index,
        response: responseByQuestionId.get(question.id) || null,
      })
      questionsBySectionId.set(question.section_id, bucket)
    }

    return NextResponse.json({
      session: {
        id: session.id,
        templateId: session.template_id,
        templateName: template.name,
        introTitle: template.intro_title,
        introText: template.intro_text,
        clientName: session.client_name,
        clientEmail: session.client_email,
        clientOrganisation: session.client_organisation,
        status: session.status,
        createdAt: session.created_at,
        submittedAt: session.submitted_at,
      },
      sections: (sections || []).map(section => ({
        id: section.id,
        label: section.label,
        description: section.description,
        orderIndex: section.order_index,
        questions: questionsBySectionId.get(section.id) || [],
      })),
    })
  } catch (error) {
    console.error('discovery session detail fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
