import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

const BERGET_BASE = 'https://api.berget.ai/v1'

type DiscoveryAnalysisLens =
  | 'Gemensamma behov'
  | 'Skillnader i perspektiv'
  | 'Beredskap för nästa steg'
  | 'Vad bör utforskas vidare'

type DiscoveryAnalysisPayload = {
  lens: DiscoveryAnalysisLens
  scope: {
    template_id: string
    theme_id: string | null
    respondent_count: number
    audience_mode: 'shared' | 'leaders' | 'mixed'
  }
  summary: string
  observations: Array<{
    title: string
    detail: string
    confidence: 'high' | 'medium' | 'low'
  }>
  differences: Array<{
    title: string
    detail: string
    confidence: 'high' | 'medium' | 'low'
  }>
  uncertainties: Array<{
    title: string
    detail: string
  }>
  next_questions: string[]
  evidence: Array<{
    theme_id: string
    respondent_label: string
    excerpt: string
  }>
}

type StoredDiscoveryAnalysis = {
  analysis: DiscoveryAnalysisPayload
  updatedAt: string
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'low'
}

function normalizeList<T>(value: unknown, mapItem: (item: unknown) => T | null, limit = 6) {
  if (!Array.isArray(value)) return []
  return value
    .map(mapItem)
    .filter((item): item is T => Boolean(item))
    .slice(0, limit)
}

function parseDiscoveryAnalysisPayload(value: unknown): DiscoveryAnalysisPayload | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  const lens = normalizeString(candidate.lens) as DiscoveryAnalysisLens
  const summary = normalizeString(candidate.summary)
  const scope = candidate.scope && typeof candidate.scope === 'object'
    ? candidate.scope as Record<string, unknown>
    : null

  if (!summary || !scope || !lens) return null

  const templateId = normalizeString(scope.template_id)
  const themeId = normalizeString(scope.theme_id) || null
  const respondentCountRaw = scope.respondent_count
  const respondentCount = typeof respondentCountRaw === 'number' && respondentCountRaw >= 0
    ? respondentCountRaw
    : 0
  const audienceModeRaw = normalizeString(scope.audience_mode)
  const audienceMode = audienceModeRaw === 'leaders' || audienceModeRaw === 'mixed' ? audienceModeRaw : 'shared'

  if (!templateId) return null

  return {
    lens,
    scope: {
      template_id: templateId,
      theme_id: themeId,
      respondent_count: respondentCount,
      audience_mode: audienceMode,
    },
    summary,
    observations: normalizeList(candidate.observations, item => {
      if (!item || typeof item !== 'object') return null
      const next = item as Record<string, unknown>
      const title = normalizeString(next.title)
      const detail = normalizeString(next.detail)
      if (!title || !detail) return null
      return {
        title,
        detail,
        confidence: normalizeConfidence(next.confidence),
      }
    }),
    differences: normalizeList(candidate.differences, item => {
      if (!item || typeof item !== 'object') return null
      const next = item as Record<string, unknown>
      const title = normalizeString(next.title)
      const detail = normalizeString(next.detail)
      if (!title || !detail) return null
      return {
        title,
        detail,
        confidence: normalizeConfidence(next.confidence),
      }
    }),
    uncertainties: normalizeList(candidate.uncertainties, item => {
      if (!item || typeof item !== 'object') return null
      const next = item as Record<string, unknown>
      const title = normalizeString(next.title)
      const detail = normalizeString(next.detail)
      if (!title || !detail) return null
      return { title, detail }
    }),
    next_questions: normalizeList(candidate.next_questions, item => {
      const next = normalizeString(item)
      return next || null
    }),
    evidence: normalizeList(candidate.evidence, item => {
      if (!item || typeof item !== 'object') return null
      const next = item as Record<string, unknown>
      const themeId = normalizeString(next.theme_id)
      const excerpt = normalizeString(next.excerpt)
      if (!themeId || !excerpt) return null
      return {
        theme_id: themeId,
        respondent_label: normalizeString(next.respondent_label) || 'Respondent',
        excerpt,
      }
    }, 8),
  }
}

function parseStoredDiscoveryAnalysis(raw: string | null | undefined) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredDiscoveryAnalysis
    const analysis = parseDiscoveryAnalysisPayload(parsed.analysis)
    if (!analysis) return null
    return {
      analysis,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function buildScopeHash(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)
}

function buildAnalysisKey(templateId: string, themeId: string | null, lens: DiscoveryAnalysisLens, scopeHash: string) {
  if (themeId) return `discovery_analysis:theme:${templateId}:${themeId}:${scopeHash}:${lens}`
  return `discovery_analysis:overall:${templateId}:${scopeHash}:${lens}`
}

function lensPrompt(lens: DiscoveryAnalysisLens) {
  switch (lens) {
    case 'Skillnader i perspektiv':
      return 'Lyft främst fram var svaren skiljer sig åt, var bilden verkar ojämn och vilka spänningar eller perspektivskillnader som är viktigast att förstå bättre.'
    case 'Beredskap för nästa steg':
      return 'Bedöm främst hur redo gruppen verkar vara för nästa steg. Lyft tydlighet, tvekan, energi, motstånd och vad som talar för att mer förtydligande behövs.'
    case 'Vad bör utforskas vidare':
      return 'Fokusera främst på vad som fortfarande är oklart, vilka frågor som bör tas vidare och vad som skulle ge bäst värde i nästa dialog eller workshop.'
    default:
      return 'Fokusera främst på det som återkommer tydligast i materialet och vilka behov eller signaler som flera respondenter verkar peka mot.'
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.BERGET_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'BERGET_API_KEY not configured' }, { status: 500 })
  }

  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const body = await req.json()
    const templateId = typeof body?.templateId === 'string' ? body.templateId.trim() : ''
    const themeId = typeof body?.themeId === 'string' && body.themeId.trim() ? body.themeId.trim() : null
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    const regenerate = body?.regenerate === true
    const lens = normalizeString(body?.lens) as DiscoveryAnalysisLens

    if (!templateId) {
      return NextResponse.json({ error: 'templateId krävs.' }, { status: 400 })
    }

    if (!lens) {
      return NextResponse.json({ error: 'Analyslins krävs.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const { data: template, error: templateError } = await admin
      .from('discovery_templates')
      .select('id, user_id, name, audience_mode')
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
      .select('id, label, description, order_index')
      .eq('template_id', templateId)
      .order('order_index')

    if (sectionsError) {
      console.error('discovery analyze sections error:', sectionsError)
      return NextResponse.json({ error: 'Kunde inte läsa temana.' }, { status: 500 })
    }

    if (themeId && !(sections || []).some(section => section.id === themeId)) {
      return NextResponse.json({ error: 'Temat hittades inte.' }, { status: 404 })
    }

    const queryLower = query.toLowerCase()
    let sessionsQuery = admin
      .from('discovery_sessions')
      .select('id, response_mode, client_name, client_email, client_organisation, status, submitted_at')
      .eq('consultant_id', user.id)
      .eq('template_id', templateId)
      .eq('status', 'submitted')

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      console.error('discovery analyze sessions error:', sessionsError)
      return NextResponse.json({ error: 'Kunde inte läsa svaren.' }, { status: 500 })
    }

    const filteredSessions = (sessions || []).filter(session => {
      if (!queryLower) return true
      return [session.client_name, session.client_email, session.client_organisation || '']
        .join(' ')
        .toLowerCase()
        .includes(queryLower)
    })

    if (filteredSessions.length === 0) {
      return NextResponse.json({ error: 'Det finns inga besvarade Discovery-svar i det valda urvalet.' }, { status: 400 })
    }

    const relevantSections = themeId
      ? (sections || []).filter(section => section.id === themeId)
      : (sections || [])

    const sectionIds = relevantSections.map(section => section.id)
    const { data: questions, error: questionsError } = sectionIds.length > 0
      ? await admin
          .from('discovery_questions')
          .select('id, section_id, type, text, order_index')
          .in('section_id', sectionIds)
          .order('order_index')
      : { data: [], error: null }

    if (questionsError) {
      console.error('discovery analyze questions error:', questionsError)
      return NextResponse.json({ error: 'Kunde inte läsa frågorna.' }, { status: 500 })
    }

    const questionIds = (questions || []).map(question => question.id)
    const sessionIds = filteredSessions.map(session => session.id)

    const { data: submissionEntries, error: submissionEntriesError } = sessionIds.length > 0
      ? await admin
          .from('discovery_submission_entries')
          .select('id, session_id, respondent_label, demographic_role, demographic_team')
          .in('session_id', sessionIds)
      : { data: [], error: null }

    if (submissionEntriesError) {
      console.error('discovery analyze submission entries error:', submissionEntriesError)
      return NextResponse.json({ error: 'Kunde inte läsa svaren.' }, { status: 500 })
    }

    const [{ data: responses, error: responsesError }, { data: responseOptions, error: responseOptionsError }] = await Promise.all([
      questionIds.length > 0
        ? admin
            .from('discovery_responses')
            .select('id, session_id, submission_entry_id, question_id, response_type, text_value, scale_value')
            .in('session_id', sessionIds)
            .in('question_id', questionIds)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length > 0
        ? admin
            .from('discovery_response_options')
            .select('response_id, option_label')
        : Promise.resolve({ data: [], error: null }),
    ])

    if (responsesError) {
      console.error('discovery analyze responses error:', responsesError)
      return NextResponse.json({ error: 'Kunde inte läsa svaren.' }, { status: 500 })
    }

    if (responseOptionsError) {
      console.error('discovery analyze response options error:', responseOptionsError)
      return NextResponse.json({ error: 'Kunde inte läsa valda alternativ.' }, { status: 500 })
    }

    const optionMap = new Map<string, string[]>()
    for (const option of responseOptions || []) {
      const bucket = optionMap.get(option.response_id) || []
      bucket.push(option.option_label)
      optionMap.set(option.response_id, bucket)
    }

    const questionById = new Map((questions || []).map(question => [question.id, question]))
    const sectionById = new Map((relevantSections || []).map(section => [section.id, section]))
    const sessionById = new Map(filteredSessions.map(session => [session.id, session]))
    const submissionEntryById = new Map((submissionEntries || []).map(entry => [entry.id, entry]))

    const grouped = new Map<string, Array<{
      respondentLabel: string
      questionLabel: string
      questionText: string
      answer: string
    }>>()

    for (const response of responses || []) {
      const question = questionById.get(response.question_id)
      const session = sessionById.get(response.session_id)
      if (!question || !session) continue

      const section = sectionById.get(question.section_id)
      if (!section) continue

      let answer = ''
      if (response.response_type === 'choice') {
        answer = (optionMap.get(response.id) || []).join(', ')
      } else if (response.response_type === 'scale') {
        answer = typeof response.scale_value === 'number' ? `${response.scale_value}` : ''
      } else {
        answer = normalizeString(response.text_value)
      }

      if (!answer) continue

      const bucket = grouped.get(section.id) || []
      const submissionEntry = response.submission_entry_id ? submissionEntryById.get(response.submission_entry_id) : null
      bucket.push({
        respondentLabel:
          submissionEntry?.respondent_label
          || [submissionEntry?.demographic_role, submissionEntry?.demographic_team].filter(Boolean).join(' · ')
          || (session.response_mode === 'anonymous' ? 'Anonymt svar' : (session.client_name || session.client_email)),
        questionLabel: `Fråga ${question.order_index + 1}`,
        questionText: question.text,
        answer,
      })
      grouped.set(section.id, bucket)
    }

    const groupedResponses = relevantSections.map(section => ({
      sectionId: section.id,
      sectionLabel: section.label,
      sectionDescription: section.description,
      responses: grouped.get(section.id) || [],
    })).filter(section => section.responses.length > 0)

    if (groupedResponses.length === 0) {
      return NextResponse.json({ error: 'Det finns inte tillräckligt med svar i urvalet för analys ännu.' }, { status: 400 })
    }

    const respondentCount = Math.max((submissionEntries || []).length, filteredSessions.length)

    const scopeHash = buildScopeHash({
      templateId,
      themeId,
      lens,
      query,
      entryIds: (submissionEntries || []).map(entry => entry.id).sort(),
    })
    const cacheKey = buildAnalysisKey(templateId, themeId, lens, scopeHash)

    if (!regenerate) {
      const { data: cachedRow, error: cacheReadError } = await admin
        .from('settings')
        .select('value')
        .eq('key', cacheKey)
        .maybeSingle()

      if (cacheReadError) {
        console.error('discovery analysis cache read error:', cacheReadError)
      }

      const cached = parseStoredDiscoveryAnalysis(cachedRow?.value)
      if (cached) {
        return NextResponse.json({ analysis: cached.analysis, updatedAt: cached.updatedAt, cached: true })
      }
    }

    const scopeText = [
      `Upplägg: ${template.name}`,
      `Målgrupp: ${template.audience_mode}`,
      `Respondenter: ${respondentCount}`,
      `Tema: ${themeId ? sectionById.get(themeId)?.label || 'Okänt tema' : 'Alla teman'}`,
      query ? `Urval: filtrerat på "${query}"` : 'Urval: alla besvarade svar i scope',
    ].join('\n')

    const responseBody = groupedResponses.map(section => {
      const responseLines = section.responses.map((item, index) => [
        `Svar ${index + 1}`,
        `Respondent: ${item.respondentLabel}`,
        `${item.questionLabel}: ${item.questionText}`,
        `Svar: ${item.answer}`,
      ].join('\n')).join('\n\n')

      return [
        `Tema: ${section.sectionLabel}`,
        `Beskrivning: ${section.sectionDescription}`,
        responseLines,
      ].join('\n')
    }).join('\n\n')

    const systemPrompt = [
      'Du ar en senior konsult som analyserar Discovery-svar.',
      'Du far bara anvanda information som finns i det givna materialet.',
      'Du maste vara specifik, nykter och aterhallsam.',
      'Du maste skilja pa observationer, skillnader, osakerheter och fragor att ta vidare.',
      'Du far inte hitta pa citat eller overdriva samstammighet.',
      'Om underlaget ar tunt ska du uttryckligen skriva det.',
      'Skriv pa svenska.',
      'Returnera ENDAST JSON med exakt dessa nycklar:',
      'lens, scope, summary, observations, differences, uncertainties, next_questions, evidence.',
      'scope maste innehalla template_id, theme_id, respondent_count och audience_mode.',
      'observations och differences ska innehalla title, detail och confidence.',
      'uncertainties ska innehalla title och detail.',
      'next_questions ska vara korta svenska punkter.',
      'evidence ska innehalla theme_id, respondent_label och excerpt.',
      lensPrompt(lens),
    ].join(' ')

    const res = await fetch(`${BERGET_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              scopeText,
              '',
              'Material att analysera:',
              responseBody,
              '',
              `Lins: ${lens}`,
              `Template ID: ${templateId}`,
              `Theme ID: ${themeId || ''}`,
              `Audience mode: ${template.audience_mode}`,
              `Respondent count: ${respondentCount}`,
            ].join('\n'),
          },
        ],
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Berget discovery analyze error:', res.status, errorText)
      return NextResponse.json({ error: 'AI-analysen misslyckades.' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    let parsed: DiscoveryAnalysisPayload | null = null
    try {
      parsed = parseDiscoveryAnalysisPayload(JSON.parse(raw))
    } catch {
      parsed = null
    }

    if (!parsed) {
      console.error('Invalid discovery analysis payload:', raw)
      return NextResponse.json({ error: 'Ogiltigt svar från AI.' }, { status: 500 })
    }

    const updatedAt = new Date().toISOString()
    const { error: cacheWriteError } = await admin
      .from('settings')
      .upsert({
        key: cacheKey,
        value: JSON.stringify({ analysis: parsed, updatedAt }),
        updated_at: updatedAt,
      })

    if (cacheWriteError) {
      console.error('discovery analysis cache write error:', cacheWriteError)
    }

    return NextResponse.json({ analysis: parsed, updatedAt, cached: false })
  } catch (error) {
    console.error('discovery analyze fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export const maxDuration = 30
