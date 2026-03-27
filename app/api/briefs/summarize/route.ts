import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  getBriefSummaryKey,
  parseBriefSummaryPayload,
  parseStoredBriefSummary,
  type BriefSummaryPayload,
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
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: sessionError } = await admin
      .from('brief_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Brief hittades inte' }, { status: 404 })
    }

    const summaryKey = getBriefSummaryKey(sessionId)
    const { data: cachedRow, error: cachedError } = await admin
      .from('settings')
      .select('value')
      .eq('key', summaryKey)
      .maybeSingle()

    if (cachedError) {
      console.error('brief summary cache read error:', cachedError)
    }

    const cachedSummary = parseStoredBriefSummary(cachedRow?.value)
    if (cachedOnly) {
      return NextResponse.json({ summary: cachedSummary?.summary || null, updatedAt: cachedSummary?.updatedAt || null })
    }

    if (cachedSummary && !regenerate) {
      return NextResponse.json({ summary: cachedSummary.summary, updatedAt: cachedSummary.updatedAt })
    }

    const { data: responses, error: responsesError } = await admin
      .from('brief_responses')
      .select('question_text, order_index, response_type, text_content')
      .eq('session_id', sessionId)
      .order('order_index')

    if (responsesError || !responses || responses.length === 0) {
      return NextResponse.json({ error: 'Inga svar att sammanfatta' }, { status: 400 })
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
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Du ar en senior konsult som analyserar ett enskilt briefsvar.',
              'Du far bara anvanda information som finns i svaren.',
              'Du maste vara konkret och aterhallsam.',
              'Returnera ENDAST JSON med exakt dessa nycklar:',
              'summary, keySignals, risks, followUpQuestions, nextSteps, basedOn',
              'summary ska vara en kort svensk sammanfattning i 2-4 meningar.',
              'Alla listor ska innehalla korta svenska punkter.',
              'basedOn ska referera till vilka fragor slutsatserna huvudsakligen bygger pa, till exempel "Fraga 2 och 4".',
              'Om underlaget ar svagt ska du skriva det under risks eller basedOn i stallet for att hitta pa saker.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Klient: ${session.client_name}`,
              `Organisation: ${session.client_organisation || 'Ej angiven'}`,
              `Status: ${session.status}`,
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
      console.error('Berget summarize error:', res.status, errorText)
      return NextResponse.json({ error: 'AI summary failed' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    let parsed: BriefSummaryPayload | null = null
    try {
      parsed = parseBriefSummaryPayload(JSON.parse(raw))
    } catch {
      parsed = null
    }

    if (!parsed) {
      console.error('Invalid summary payload:', raw)
      return NextResponse.json({ error: 'Ogiltigt svar fran AI' }, { status: 500 })
    }

    const updatedAt = new Date().toISOString()
    const { error: cacheWriteError } = await admin
      .from('settings')
      .upsert({
        key: summaryKey,
        value: JSON.stringify({ summary: parsed, updatedAt }),
        updated_at: updatedAt,
      })

    if (cacheWriteError) {
      console.error('brief summary cache write error:', cacheWriteError)
    }

    return NextResponse.json({ summary: parsed, updatedAt })
  } catch (error) {
    console.error('brief summarize error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export const maxDuration = 30
