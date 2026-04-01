import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getBriefAgendaKey,
  parseBriefAgendaPayload,
  parseStoredBriefAgenda,
  type BriefAgendaPayload,
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
    const { sessionId, regenerate = false, cachedOnly = false } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId krävs' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const { data: session, error: sessionError } = await admin
      .from('brief_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Brief hittades inte' }, { status: 404 })
    }

    const agendaKey = getBriefAgendaKey(sessionId)
    const { data: cachedRow, error: cachedError } = await admin
      .from('settings')
      .select('value')
      .eq('key', agendaKey)
      .maybeSingle()

    if (cachedError) {
      console.error('brief agenda cache read error:', cachedError)
    }

    const cachedAgenda = parseStoredBriefAgenda(cachedRow?.value)

    if (cachedOnly) {
      return NextResponse.json({ agenda: cachedAgenda?.agenda || null, updatedAt: cachedAgenda?.updatedAt || null })
    }

    if (cachedAgenda && !regenerate) {
      return NextResponse.json({ agenda: cachedAgenda.agenda, updatedAt: cachedAgenda.updatedAt })
    }

    const { data: responses, error: responsesError } = await admin
      .from('brief_responses')
      .select('question_text, order_index, response_type, text_content')
      .eq('session_id', sessionId)
      .order('order_index')

    if (responsesError || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Inga svar att generera agenda från' }, { status: 400 })
    }

    const responseBody = responses
      .map((response, index) => {
        const answer = response.text_content?.trim() || 'Inget svar'
        const responseType = response.response_type === 'voice' ? 'Rosttranskription' : 'Text'
        return [
          `Fraga ${index + 1}`,
          `Typ: ${responseType}`,
          `Fraga: ${response.question_text}`,
          `Svar: ${answer}`,
        ].join('\n')
      })
      .join('\n\n')

    const res = await fetch(`${BERGET_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Du ar en erfaren konsult och motesledare.',
              'Baserat pa klientens briefsvar ska du forberedda ett kundmote.',
              'Returnera ENDAST JSON med exakt dessa nycklar: objective, agendaItems, questionsToExplore, consultantPrep',
              'objective: 1-2 meningar om syftet med motet.',
              'agendaItems: lista med objekt { item, timeEstimate } — 3-5 konkreta agendapunkter.',
              'questionsToExplore: 3-4 djupare fragor att stalla live i motet.',
              'consultantPrep: 2-3 saker konsulten bor forberedda eller ta med.',
              'Allt pa svenska. Var konkret och knyt till vad klienten faktiskt skrivit.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Klient: ${session.client_name}`,
              `Organisation: ${session.client_organisation || 'Ej angiven'}`,
              '',
              'Svaren:',
              responseBody,
            ].join('\n'),
          },
        ],
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Berget agenda error:', res.status, errorText)
      return NextResponse.json({ error: 'Kunde inte generera agenda' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    let parsed: BriefAgendaPayload | null = null
    try {
      parsed = parseBriefAgendaPayload(JSON.parse(raw))
    } catch {
      parsed = null
    }

    if (!parsed) {
      console.error('Invalid agenda payload:', raw)
      return NextResponse.json({ error: 'Ogiltigt svar från AI' }, { status: 500 })
    }

    const updatedAt = new Date().toISOString()
    const { error: cacheWriteError } = await admin
      .from('settings')
      .upsert({
        key: agendaKey,
        value: JSON.stringify({ agenda: parsed, updatedAt }),
        updated_at: updatedAt,
      })

    if (cacheWriteError) {
      console.error('brief agenda cache write error:', cacheWriteError)
    }

    return NextResponse.json({ agenda: parsed, updatedAt })
  } catch (err) {
    console.error('brief agenda error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export const maxDuration = 30
