import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getBriefCompareKey,
  parseBriefComparisonPayload,
  parseStoredBriefComparison,
  type BriefComparisonPayload,
} from '@/lib/brief-batches'

const BERGET_BASE = 'https://api.berget.ai/v1'

export async function POST(req: NextRequest) {
  const key = process.env.BERGET_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'BERGET_API_KEY not configured' }, { status: 500 })
  }

  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const {
      dispatchId,
      sessionIds,
      contacts = [],
      regenerate = false,
      cachedOnly = false,
    } = await req.json()

    if (!dispatchId || typeof dispatchId !== 'string') {
      return NextResponse.json({ error: 'dispatchId krävs' }, { status: 400 })
    }
    if (!Array.isArray(sessionIds) || sessionIds.length < 2) {
      return NextResponse.json({ error: 'Minst 2 sessionIds krävs för jämförelse' }, { status: 400 })
    }

    // Build contacts lookup from client-supplied contacts (avoids extra DB round-trip)
    const contactsBySessionId: Record<string, { role: string | null }> = {}
    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        if (c?.sessionId) contactsBySessionId[c.sessionId] = { role: c.role || null }
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const compareKey = getBriefCompareKey(dispatchId)
    const { data: cachedRow, error: cachedError } = await admin
      .from('settings')
      .select('value')
      .eq('key', compareKey)
      .maybeSingle()

    if (cachedError) {
      console.error('brief compare cache read error:', cachedError)
    }

    const cached = parseStoredBriefComparison(cachedRow?.value)

    if (cachedOnly) {
      return NextResponse.json({ comparison: cached?.comparison || null, updatedAt: cached?.updatedAt || null })
    }

    if (cached && !regenerate) {
      return NextResponse.json({ comparison: cached.comparison, updatedAt: cached.updatedAt })
    }

    // Fetch sessions to get names/roles
    const { data: sessions } = await admin
      .from('brief_sessions')
      .select('id, client_name, client_organisation')
      .in('id', sessionIds)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Sessioner hittades inte' }, { status: 404 })
    }

    // Fetch all responses for submitted sessions, ordered by session + question
    const { data: responses, error: responsesError } = await admin
      .from('brief_responses')
      .select('session_id, question_text, order_index, text_content')
      .in('session_id', sessionIds)
      .order('order_index')

    if (responsesError || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Inga svar att jämföra' }, { status: 400 })
    }

    // Group responses by order_index → question_text
    type QuestionGroup = { questionText: string; answers: Array<{ name: string; role: string | null; text: string }> }
    const questionMap = new Map<number, QuestionGroup>()

    for (const r of responses) {
      const existing = questionMap.get(r.order_index)
      const session = sessions.find(s => s.id === r.session_id)
      const role = contactsBySessionId[r.session_id]?.role || null
      const answer = { name: session?.client_name || r.session_id, role, text: r.text_content?.trim() || 'Inget svar' }

      if (existing) {
        existing.answers.push(answer)
      } else {
        questionMap.set(r.order_index, { questionText: r.question_text, answers: [answer] })
      }
    }

    const questions = Array.from(questionMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, q]) => q)

    // Build prompt body
    const organisation = sessions[0]?.client_organisation || 'Okänd organisation'
    const respondentList = sessions.map(s => {
      const role = contactsBySessionId[s.id]?.role
      return role ? `${s.client_name} (${role})` : s.client_name
    }).join(', ')

    const questionsBlock = questions.map((q, i) => {
      const answersBlock = q.answers
        .map(a => `- ${a.name}${a.role ? ` (${a.role})` : ''}: "${a.text}"`)
        .join('\n')
      return `Fraga ${i + 1}: ${q.questionText}\n${answersBlock}`
    }).join('\n\n')

    const userContent = [
      `Organisation: ${organisation}`,
      `Respondenter: ${respondentList}`,
      '',
      questionsBlock,
    ].join('\n')

    const res = await fetch(`${BERGET_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Du ar en erfaren konsult och organisationsanalytiker.',
              'Du analyserar briefsvar fran flera respondenter i samma organisation och identifierar var de ar overens, var de divergerar, och vad det betyder for det kommande uppdraget.',
              'Returnera ENDAST JSON med exakt dessa nycklar: overview, questionComparisons, commonThemes, keyDifferences',
              'overview: 2-4 meningar om overgrippande monster och vad de innebar for uppdraget.',
              'questionComparisons: array av { questionText, consensus, divergence } - en post per fraga. consensus: vad de ar overens om. divergence: var de skiljer sig at.',
              'commonThemes: 3-5 gemensamma teman som framtrader.',
              'keyDifferences: 3-5 viktiga skillnader i perspektiv eller prioritet.',
              'Allt pa svenska. Var konkret och knyt till vad respondenterna faktiskt skrivit. Om bara en person svarat pa en fraga, ange det i divergence.',
            ].join(' '),
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Berget compare error:', res.status, errorText)
      return NextResponse.json({ error: 'Kunde inte generera jämförelse' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    let parsed: BriefComparisonPayload | null = null
    try {
      parsed = parseBriefComparisonPayload(JSON.parse(raw))
    } catch {
      parsed = null
    }

    if (!parsed) {
      console.error('Invalid comparison payload:', raw)
      return NextResponse.json({ error: 'Ogiltigt svar från AI' }, { status: 500 })
    }

    const updatedAt = new Date().toISOString()
    const { error: cacheWriteError } = await admin
      .from('settings')
      .upsert({
        key: compareKey,
        value: JSON.stringify({ comparison: parsed, updatedAt }),
        updated_at: updatedAt,
      })

    if (cacheWriteError) {
      console.error('brief compare cache write error:', cacheWriteError)
    }

    return NextResponse.json({ comparison: parsed, updatedAt })
  } catch (err) {
    console.error('brief compare error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export const maxDuration = 30
