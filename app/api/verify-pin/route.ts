import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    const correctPin = process.env.BRIEF_PIN_CODE

    if (!correctPin) {
      console.error('BRIEF_PIN_CODE is not set')
      return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
    }

    if (pin === correctPin) {
      // Create a simple time-limited token (valid 24h)
      const token = crypto
        .createHmac('sha256', correctPin + process.env.NEXTAUTH_SECRET || 'doings-secret')
        .update(String(Math.floor(Date.now() / 86_400_000)))
        .digest('hex')

      return NextResponse.json({ ok: true, token })
    }

    return NextResponse.json({ ok: false }, { status: 401 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
