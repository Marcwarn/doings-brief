import { NextRequest, NextResponse } from 'next/server'

const BERGET_BASE = 'https://api.berget.ai/v1'

export async function POST(req: NextRequest) {
  const key = process.env.BERGET_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'BERGET_API_KEY not configured' }, { status: 500 })
  }

  const { topic, count = 6 } = await req.json()
  if (!topic?.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BERGET_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        messages: [
          {
            role: 'system',
            content: `Du är en erfaren konsult specialiserad på ledarskap och organisationsutveckling.
Generera ${count} öppna, insiktsfulla intervjufrågor baserat på det ämne eller syfte som beskrivs.
Frågorna ska vara formulerade för att riktas direkt till en klient — kortfattade, tydliga och enkla att förstå.
Returnera ENBART frågorna, numrerade (1. 2. 3. osv), en per rad. Ingen inledning, ingen avslutning, ingen extra text.`,
          },
          {
            role: 'user',
            content: topic.trim(),
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Berget AI error:', res.status, errText)
      return NextResponse.json({ error: 'AI generation failed', details: errText }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // Parse numbered list — strip leading "1. " / "1) " etc.
    const questions: string[] = raw
      .split('\n')
      .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter((l: string) => l.length > 8)

    return NextResponse.json({ questions })
  } catch (err) {
    console.error('generate-questions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const maxDuration = 30
