import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = getSupabaseAdminClient()
    const token = typeof params.token === 'string' ? params.token.trim() : ''

    if (!token) {
      return NextResponse.json({ error: 'Länken är ogiltig.' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await admin
      .from('discovery_sessions')
      .select('id, template_id, client_name, client_email, client_organisation, status, submitted_at')
      .eq('token', token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sidan hittades inte.' }, { status: 404 })
    }

    const { data: template, error: templateError } = await admin
      .from('discovery_templates')
      .select('id, name, intro_title, intro_text, audience_mode, status')
      .eq('id', session.template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Upplägget hittades inte.' }, { status: 404 })
    }

    const { data: sections, error: sectionsError } = await admin
      .from('discovery_sections')
      .select('id, label, description, order_index')
      .eq('template_id', template.id)
      .order('order_index')

    if (sectionsError) {
      console.error('discovery public sections error:', sectionsError)
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
      console.error('discovery public questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)
    const { data: options, error: optionsError } = questionIds.length > 0
      ? await admin
          .from('discovery_question_options')
          .select('id, question_id, label, order_index')
          .in('question_id', questionIds)
          .order('order_index')
      : { data: [], error: null }

    if (optionsError) {
      console.error('discovery public options error:', optionsError)
      return NextResponse.json({ error: 'Kunde inte läsa alternativen för frågorna.' }, { status: 500 })
    }

    const optionsByQuestionId = new Map<string, Array<{
      id: string
      label: string
      orderIndex: number
    }>>()

    for (const option of options || []) {
      const bucket = optionsByQuestionId.get(option.question_id) || []
      bucket.push({
        id: option.id,
        label: option.label,
        orderIndex: option.order_index,
      })
      optionsByQuestionId.set(option.question_id, bucket)
    }

    const questionsBySectionId = new Map<string, Array<{
      id: string
      type: 'open' | 'choice' | 'scale'
      text: string
      orderIndex: number
      maxChoices: number | null
      scaleMin: number | null
      scaleMax: number | null
      scaleMinLabel: string | null
      scaleMaxLabel: string | null
      options: Array<{
        id: string
        label: string
        orderIndex: number
      }>
    }>>()

    for (const question of questions || []) {
      const bucket = questionsBySectionId.get(question.section_id) || []
      bucket.push({
        id: question.id,
        type: question.type,
        text: question.text,
        orderIndex: question.order_index,
        maxChoices: question.max_choices,
        scaleMin: question.scale_min,
        scaleMax: question.scale_max,
        scaleMinLabel: question.scale_min_label,
        scaleMaxLabel: question.scale_max_label,
        options: optionsByQuestionId.get(question.id) || [],
      })
      questionsBySectionId.set(question.section_id, bucket)
    }

    return NextResponse.json({
      session: {
        clientName: session.client_name,
        clientEmail: session.client_email,
        clientOrganisation: session.client_organisation,
        status: session.status,
        submittedAt: session.submitted_at,
      },
      template: {
        id: template.id,
        name: template.name,
        introTitle: template.intro_title,
        introText: template.intro_text,
        audienceMode: template.audience_mode,
        status: template.status,
        sections: (sections || []).map(section => ({
          id: section.id,
          label: section.label,
          description: section.description,
          orderIndex: section.order_index,
          questions: questionsBySectionId.get(section.id) || [],
        })),
      },
    })
  } catch (error) {
    console.error('discovery public fetch fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
