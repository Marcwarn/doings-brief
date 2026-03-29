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

    const templateId = typeof params.id === 'string' ? params.id.trim() : ''
    if (!templateId) {
      return NextResponse.json({ error: 'Id saknas.' }, { status: 400 })
    }

    const { data: template, error: templateError } = await admin
      .from('discovery_templates')
      .select('id, user_id, name, intro_title, intro_text, status, created_at, updated_at')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Upplägget hittades inte.' }, { status: 404 })
    }

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 403 })
    }

    const { data: sections, error: sectionsError } = await admin
      .from('discovery_sections')
      .select('id, template_id, label, description, order_index, created_at')
      .eq('template_id', templateId)
      .order('order_index')

    if (sectionsError) {
      console.error('discovery template sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte läsa temana.' }, { status: 500 })
    }

    const sectionIds = (sections || []).map(section => section.id)

    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, section_id, type, text, order_index, max_choices, scale_min, scale_max, scale_min_label, scale_max_label, created_at')
          .in('section_id', sectionIds)
          .order('order_index')
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery template questions error:', questionsError)
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
      console.error('discovery template options error:', optionsError)
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
      template: {
        id: template.id,
        name: template.name,
        introTitle: template.intro_title,
        introText: template.intro_text,
        status: template.status,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        sections: (sections || []).map(section => ({
          id: section.id,
          label: section.label,
          description: section.description,
          orderIndex: section.order_index,
          createdAt: section.created_at,
          questions: questionsBySectionId.get(section.id) || [],
        })),
      },
    })
  } catch (error) {
    console.error('discovery template detail fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
