import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

type SessionSectionResponse = {
  sectionId: string
  answeredCount: number
  excerpts: string[]
}

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
      .select('id, user_id, name, intro_title')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Upplägget hittades inte.' }, { status: 404 })
    }

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 403 })
    }

    const [{ data: sections, error: sectionsError }, { data: sessions, error: sessionsError }] = await Promise.all([
      admin
        .from('discovery_sections')
        .select('id, label, description, order_index')
        .eq('template_id', templateId)
        .order('order_index'),
      admin
        .from('discovery_sessions')
        .select('id, response_mode, client_name, client_email, client_organisation, status, created_at, submitted_at')
        .eq('consultant_id', user.id)
        .eq('template_id', templateId)
        .order('created_at', { ascending: false }),
    ])

    if (sectionsError) {
      console.error('discovery data sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte läsa temana.' }, { status: 500 })
    }

    if (sessionsError) {
      console.error('discovery data sessions error:', sessionsError)
      return NextResponse.json({ error: 'Kunde inte läsa svarsläget.' }, { status: 500 })
    }

    const sectionIds = (sections || []).map(section => section.id)
    const sessionIds = (sessions || []).map(session => session.id)

    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, section_id')
          .in('section_id', sectionIds)
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery data questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)
    const { data: submissionEntries, error: submissionEntriesError } = sessionIds.length > 0
      ? await admin
          .from('discovery_submission_entries')
          .select('id, session_id, respondent_label, demographic_role, demographic_team, submitted_at')
          .in('session_id', sessionIds)
          .order('submitted_at', { ascending: false })
      : { data: [], error: null }

    if (submissionEntriesError) {
      console.error('discovery data submission entries error:', submissionEntriesError)
      return NextResponse.json({ error: 'Kunde inte läsa svarsläget.' }, { status: 500 })
    }

    const { data: responses, error: responsesError } = sessionIds.length > 0 && questionIds.length > 0
      ? await admin
          .from('discovery_responses')
          .select('session_id, submission_entry_id, question_id, response_type, text_value, scale_value')
          .in('session_id', sessionIds)
          .in('question_id', questionIds)
      : { data: [], error: null }

    if (responsesError) {
      console.error('discovery data responses error:', responsesError)
      return NextResponse.json({ error: 'Kunde inte läsa svaren.' }, { status: 500 })
    }

    const questionSectionById = new Map((questions || []).map(question => [question.id, question.section_id]))
    const questionCountBySection = new Map<string, number>()
    for (const question of questions || []) {
      questionCountBySection.set(question.section_id, (questionCountBySection.get(question.section_id) || 0) + 1)
    }

    const sectionResponsesBySession = new Map<string, Map<string, SessionSectionResponse>>()
    const entryById = new Map((submissionEntries || []).map(entry => [entry.id, entry]))
    const submissionCountBySession = new Map<string, number>()

    for (const entry of submissionEntries || []) {
      submissionCountBySession.set(entry.session_id, (submissionCountBySession.get(entry.session_id) || 0) + 1)
    }

    for (const response of responses || []) {
      const sectionId = questionSectionById.get(response.question_id)
      if (!sectionId) continue

      const sessionBucket = sectionResponsesBySession.get(response.session_id) || new Map<string, SessionSectionResponse>()
      const sectionBucket: SessionSectionResponse = sessionBucket.get(sectionId) || {
        sectionId,
        answeredCount: 0,
        excerpts: [],
      }

      const hasText = typeof response.text_value === 'string' && response.text_value.trim().length > 0
      const hasScale = typeof response.scale_value === 'number'
      const isAnswered = hasText || hasScale || response.response_type === 'choice'

      if (isAnswered) {
        sectionBucket.answeredCount += 1
      }

      if (hasText && sectionBucket.excerpts.length < 2) {
        const entry = response.submission_entry_id ? entryById.get(response.submission_entry_id) : null
        const prefix = entry?.respondent_label ? `${entry.respondent_label}: ` : ''
        sectionBucket.excerpts.push(`${prefix}${response.text_value!.trim()}`)
      }

      sessionBucket.set(sectionId, sectionBucket)
      sectionResponsesBySession.set(response.session_id, sessionBucket)
    }

    const latestSubmittedAt = (submissionEntries || [])
      .map(entry => entry.submitted_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null
    const submittedCount = (submissionEntries || []).length

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        introTitle: template.intro_title,
      },
      overview: {
        invitedCount: (sessions || []).length,
        submittedCount,
        pendingCount: (sessions || []).filter(session => session.status !== 'submitted').length,
        responseRate: (sessions || []).length > 0
          ? Math.min(100, Math.round((submittedCount / (sessions || []).length) * 100))
          : 0,
        latestSubmittedAt,
      },
      sections: (sections || []).map(section => ({
        id: section.id,
        label: section.label,
        description: section.description,
        orderIndex: section.order_index,
        questionCount: questionCountBySection.get(section.id) || 0,
      })),
      sessions: (sessions || []).map(session => ({
        id: session.id,
        clientName: session.client_name,
        clientEmail: session.client_email,
        clientOrganisation: session.client_organisation,
        responseMode: session.response_mode,
        respondentCount: submissionCountBySession.get(session.id) || 0,
        status: session.status,
        createdAt: session.created_at,
        submittedAt: session.submitted_at,
        sectionResponses: Array.from(sectionResponsesBySession.get(session.id)?.values() || []).map(item => ({
          sectionId: item.sectionId,
          answeredCount: item.answeredCount,
          excerpts: item.excerpts,
        })),
      })),
    })
  } catch (error) {
    console.error('discovery data fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
