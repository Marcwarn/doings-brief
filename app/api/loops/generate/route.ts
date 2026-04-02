import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'

const BERGET_BASE = 'https://api.berget.ai/v1'

type GeneratedMessage = {
  order: number
  subject: string
  bodyHtml: string
  bodyText: string
}

export async function POST(req: NextRequest) {
  const key = process.env.BERGET_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'BERGET_API_KEY not configured' }, { status: 500 })
  }

  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const { topic, context, count = 5, summaryContext } = await req.json()

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'topic krävs' }, { status: 400 })
    }

    const countClamped = Math.min(Math.max(Number(count) || 5, 3), 8)

    const systemPrompt = [
      'Du ar en erfaren konsult och kommunikationsspecialist.',
      `Generera exakt ${countClamped} uppfoljningsmail for en utbildning eller workshop.`,
      'Varje mail ska ha: ett engagerande amnesrad (subject), och ett mailinnehall (body) pa 200-350 ord.',
      'Mailen ska vara anpassade for sin position i sekvensen:',
      'Mail 1 (dag 1): Sammanfattning av dagen + 3 viktigaste insikter.',
      'Mail 2 (vecka 1): Reflektionsfragor - hur har det satt sig?',
      'Mail 3 (vecka 2): Fordjupning pa ett centralt tema.',
      'Mail 4 (manad 1): Praktisk uppfoljning - hur tillämpas det?',
      'Mail 5+ : Ytterligare reflektioner, tips eller naesta steg.',
      'Skriv pa svenska. Varje mail ska vara personligt, konkret och knytet till amnet.',
      'Inkludera en reflektionsfråga eller uppmaning i varje mail.',
      'Returnera ENDAST JSON: { "messages": [{ "order": 1, "subject": "...", "bodyHtml": "...", "bodyText": "..." }] }',
      'bodyHtml ska vara enkel HTML med <p>-taggar. bodyText ska vara ren text.',
    ].join(' ')

    const userContent = [
      `Amne: ${topic.trim()}`,
      context?.trim() ? `\nNyckelinsikter och innehall:\n${context.trim()}` : '',
      summaryContext?.trim() ? `\nAI-sammanfattning fran brief:\n${summaryContext.trim()}` : '',
    ].filter(Boolean).join('\n')

    const res = await fetch(`${BERGET_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Berget loops/generate error:', res.status, errText)
      return NextResponse.json({ error: 'Kunde inte generera mail' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    let parsed: { messages: GeneratedMessage[] } | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    if (!parsed?.messages || !Array.isArray(parsed.messages)) {
      console.error('Invalid loops generate payload:', raw)
      return NextResponse.json({ error: 'Ogiltigt svar från AI' }, { status: 500 })
    }

    const messages = parsed.messages
      .filter(m => m.subject && (m.bodyHtml || m.bodyText))
      .slice(0, countClamped)
      .map((m, i) => ({
        order: i,
        subject: String(m.subject).trim(),
        bodyHtml: String(m.bodyHtml || '').trim(),
        bodyText: String(m.bodyText || m.bodyHtml || '').replace(/<[^>]+>/g, '').trim(),
      }))

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('loops/generate error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export const maxDuration = 30
