import { NextRequest, NextResponse } from 'next/server'

// Berget AI – OpenAI-compatible Whisper endpoint
const BERGET_API_URL = 'https://api.berget.ai/v1/audio/transcriptions'
const BERGET_API_KEY = process.env.BERGET_API_KEY

export async function POST(req: NextRequest) {
  if (!BERGET_API_KEY) {
    return NextResponse.json({ error: 'BERGET_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Forward the multipart form data directly to Berget AI
    const formData = await req.formData()

    // Ensure model is set to KB-Whisper-Large
    if (!formData.has('model')) {
      formData.set('model', 'KBLab/kb-whisper-large')
    }

    const bergetRes = await fetch(BERGET_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BERGET_API_KEY}`,
        // Do NOT set Content-Type — fetch sets it automatically with boundary for FormData
      },
      body: formData,
    })

    if (!bergetRes.ok) {
      const errText = await bergetRes.text()
      console.error('Berget AI error:', bergetRes.status, errText)
      return NextResponse.json(
        { error: `Berget AI returned ${bergetRes.status}`, details: errText },
        { status: bergetRes.status }
      )
    }

    const data = await bergetRes.json()
    return NextResponse.json({ text: data.text || '' })
  } catch (err) {
    console.error('Transcribe route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Max request body size for audio uploads
export const maxDuration = 60 // seconds
