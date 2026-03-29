import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

type RawChoiceOption = {
  label?: unknown
}

type RawQuestion = {
  id?: unknown
  type?: unknown
  text?: unknown
  orderIndex?: unknown
  maxChoices?: unknown
  scaleMin?: unknown
  scaleMax?: unknown
  scaleMinLabel?: unknown
  scaleMaxLabel?: unknown
  options?: unknown
}

type RawSection = {
  id?: unknown
  label?: unknown
  description?: unknown
  orderIndex?: unknown
  questions?: unknown
}

type DiscoveryTemplatePayload = {
  id?: unknown
  name?: unknown
  introTitle?: unknown
  introText?: unknown
  audienceMode?: unknown
  status?: unknown
  sections?: unknown
}

function normalizeAudienceMode(value: unknown): 'shared' | 'leaders' | 'mixed' {
  if (value === 'leaders' || value === 'mixed') return value
  return 'shared'
}

type NormalizedChoiceOption = {
  label: string
  orderIndex: number
}

type NormalizedQuestion = {
  type: 'open' | 'choice' | 'scale'
  text: string
  orderIndex: number
  maxChoices: number | null
  scaleMin: number | null
  scaleMax: number | null
  scaleMinLabel: string | null
  scaleMaxLabel: string | null
  options: NormalizedChoiceOption[]
}

type NormalizedSection = {
  label: string
  description: string
  orderIndex: number
  questions: NormalizedQuestion[]
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asOptionalTrimmedString(value: unknown) {
  const normalized = asTrimmedString(value)
  return normalized ? normalized : null
}

function asIntegerOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function normalizeChoiceOptions(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      const candidate = item as RawChoiceOption | string
      const label = typeof candidate === 'string'
        ? candidate.trim()
        : asTrimmedString(candidate?.label)

      if (!label) return null

      return {
        label,
        orderIndex: index,
      }
    })
    .filter((item): item is NormalizedChoiceOption => Boolean(item))
}

function normalizeQuestions(value: unknown) {
  if (!Array.isArray(value)) {
    return { questions: [] as NormalizedQuestion[], error: 'Varje tema måste innehålla en lista med frågor.' }
  }

  const questions: NormalizedQuestion[] = []

  for (let index = 0; index < value.length; index += 1) {
    const rawItem = value[index]
    if (!rawItem || typeof rawItem !== 'object') {
      return { questions: [] as NormalizedQuestion[], error: `Fråga ${index + 1} är ogiltig.` }
    }

    const item = rawItem as RawQuestion
    const type = item.type === 'choice' || item.type === 'scale' ? item.type : 'open'
    const text = asTrimmedString(item.text)

    if (!text) {
      return { questions: [] as NormalizedQuestion[], error: `Fråga ${index + 1} måste ha en frågetext.` }
    }

    const options = type === 'choice' ? normalizeChoiceOptions(item.options) : []
    const maxChoices = type === 'choice' ? asIntegerOrNull(item.maxChoices) : null
    const scaleMin = type === 'scale' ? asIntegerOrNull(item.scaleMin) : null
    const scaleMax = type === 'scale' ? asIntegerOrNull(item.scaleMax) : null
    const scaleMinLabel = type === 'scale' ? asOptionalTrimmedString(item.scaleMinLabel) : null
    const scaleMaxLabel = type === 'scale' ? asOptionalTrimmedString(item.scaleMaxLabel) : null

    if (type === 'choice') {
      if (options.length === 0) {
        return { questions: [] as NormalizedQuestion[], error: `Valfråga ${index + 1} måste ha minst ett alternativ.` }
      }

      if (maxChoices !== null && (maxChoices < 1 || maxChoices > options.length)) {
        return { questions: [] as NormalizedQuestion[], error: `Valfråga ${index + 1} har ogiltigt maxantal val.` }
      }
    }

    if (type === 'scale') {
      if (scaleMin === null || scaleMax === null || scaleMax < scaleMin) {
        return { questions: [] as NormalizedQuestion[], error: `Skalfråga ${index + 1} måste ha giltiga gränser.` }
      }
    }

    questions.push({
      type,
      text,
      orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : index,
      maxChoices,
      scaleMin,
      scaleMax,
      scaleMinLabel,
      scaleMaxLabel,
      options,
    })
  }

  return { questions, error: null }
}

function normalizeSections(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { sections: [] as NormalizedSection[], error: 'Lägg till minst ett tema innan du sparar.' }
  }

  const sections: NormalizedSection[] = []

  for (let index = 0; index < value.length; index += 1) {
    const rawItem = value[index]
    if (!rawItem || typeof rawItem !== 'object') {
      return { sections: [] as NormalizedSection[], error: `Tema ${index + 1} är ogiltigt.` }
    }

    const item = rawItem as RawSection
    const label = asTrimmedString(item.label)
    const description = asTrimmedString(item.description)

    if (!label) {
      return { sections: [] as NormalizedSection[], error: `Tema ${index + 1} måste ha ett namn.` }
    }

    if (!description) {
      return { sections: [] as NormalizedSection[], error: `Tema ${index + 1} måste ha en introduktion.` }
    }

    const { questions, error } = normalizeQuestions(item.questions)
    if (error) return { sections: [] as NormalizedSection[], error: `${label}: ${error}` }

    if (questions.length === 0) {
      return { sections: [] as NormalizedSection[], error: `${label}: lägg till minst en fråga.` }
    }

    sections.push({
      label,
      description,
      orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : index,
      questions,
    })
  }

  return { sections, error: null }
}

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { data, error } = await admin
      .from('discovery_templates')
      .select('id, name, audience_mode, status, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('discovery templates list error:', error)
      return NextResponse.json({ error: 'Kunde inte hämta uppläggen.' }, { status: 500 })
    }

    return NextResponse.json({
      templates: (data || []).map(item => ({
        id: item.id,
        name: item.name,
        audienceMode: item.audience_mode,
        status: item.status,
        updatedAt: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('discovery templates list fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const payload = await req.json() as DiscoveryTemplatePayload

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const id = asTrimmedString(payload.id)
    const name = asTrimmedString(payload.name)
    const introTitle = asTrimmedString(payload.introTitle)
    const introText = asTrimmedString(payload.introText)
    const audienceMode = normalizeAudienceMode(payload.audienceMode)
    const status = payload.status === 'active' ? 'active' : 'draft'

    if (!name) {
      return NextResponse.json({ error: 'Upplägget måste ha ett namn.' }, { status: 400 })
    }

    if (!introTitle) {
      return NextResponse.json({ error: 'Lägg till en rubrik för sidan.' }, { status: 400 })
    }

    if (!introText) {
      return NextResponse.json({ error: 'Lägg till en inledning för sidan.' }, { status: 400 })
    }

    const { sections, error: sectionsError } = normalizeSections(payload.sections)
    if (sectionsError) {
      return NextResponse.json({ error: sectionsError }, { status: 400 })
    }

    let templateId = id

    if (templateId) {
      const { data: existingTemplate, error: existingTemplateError } = await admin
        .from('discovery_templates')
        .select('id, user_id')
        .eq('id', templateId)
        .single()

      if (existingTemplateError || !existingTemplate) {
        return NextResponse.json({ error: 'Upplägget kunde inte hittas.' }, { status: 404 })
      }

      if (existingTemplate.user_id !== user.id) {
        return NextResponse.json({ error: 'Obehörig' }, { status: 403 })
      }

      const { error: templateUpdateError } = await admin
        .from('discovery_templates')
        .update({
          name,
          intro_title: introTitle,
          intro_text: introText,
          audience_mode: audienceMode,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)

      if (templateUpdateError) {
        console.error('discovery template update error:', templateUpdateError)
        return NextResponse.json({ error: 'Kunde inte uppdatera upplägget.' }, { status: 500 })
      }

      const { error: deleteSectionsError } = await admin
        .from('discovery_sections')
        .delete()
        .eq('template_id', templateId)

      if (deleteSectionsError) {
        console.error('discovery section reset error:', deleteSectionsError)
        return NextResponse.json({ error: 'Kunde inte uppdatera upplägget.' }, { status: 500 })
      }
    } else {
      const { data: createdTemplate, error: templateInsertError } = await admin
        .from('discovery_templates')
        .insert({
          user_id: user.id,
          name,
          intro_title: introTitle,
          intro_text: introText,
          audience_mode: audienceMode,
          status,
        })
        .select('id')
        .single()

      if (templateInsertError || !createdTemplate) {
        console.error('discovery template insert error:', templateInsertError)
        return NextResponse.json({ error: 'Kunde inte skapa upplägget.' }, { status: 500 })
      }

      templateId = createdTemplate.id
    }

    const { data: insertedSections, error: sectionsInsertError } = await admin
      .from('discovery_sections')
      .insert(sections.map(section => ({
        template_id: templateId,
        label: section.label,
        description: section.description,
        order_index: section.orderIndex,
      })))
      .select('id, order_index')

    if (sectionsInsertError || !insertedSections) {
      console.error('discovery section insert error:', sectionsInsertError)
      return NextResponse.json({ error: 'Kunde inte spara temana.' }, { status: 500 })
    }

    const sectionIdByOrder = new Map(insertedSections.map(item => [item.order_index, item.id]))
    const questionRows = sections.flatMap(section => {
      const sectionId = sectionIdByOrder.get(section.orderIndex)
      if (!sectionId) return []

      return section.questions.map(question => ({
        section_id: sectionId,
        type: question.type,
        text: question.text,
        order_index: question.orderIndex,
        max_choices: question.maxChoices,
        scale_min: question.scaleMin,
        scale_max: question.scaleMax,
        scale_min_label: question.scaleMinLabel,
        scale_max_label: question.scaleMaxLabel,
      }))
    })

    const { data: insertedQuestions, error: questionsInsertError } = await admin
      .from('discovery_questions')
      .insert(questionRows)
      .select('id, section_id, order_index')

    if (questionsInsertError || !insertedQuestions) {
      console.error('discovery question insert error:', questionsInsertError)
      return NextResponse.json({ error: 'Kunde inte spara frågorna.' }, { status: 500 })
    }

    const questionIdByKey = new Map(
      insertedQuestions.map(item => [`${item.section_id}:${item.order_index}`, item.id])
    )

    const optionRows = sections.flatMap(section => {
      const sectionId = sectionIdByOrder.get(section.orderIndex)
      if (!sectionId) return []

      return section.questions.flatMap(question => {
        const questionId = questionIdByKey.get(`${sectionId}:${question.orderIndex}`)
        if (!questionId || question.options.length === 0) return []

        return question.options.map(option => ({
          question_id: questionId,
          label: option.label,
          order_index: option.orderIndex,
        }))
      })
    })

    if (optionRows.length > 0) {
      const { error: optionsInsertError } = await admin
        .from('discovery_question_options')
        .insert(optionRows)

      if (optionsInsertError) {
        console.error('discovery question option insert error:', optionsInsertError)
        return NextResponse.json({ error: 'Kunde inte spara alternativen för frågorna.' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      templateId,
    })
  } catch (error) {
    console.error('discovery template save fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
