import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'

// GET /api/loop/[token]/[step] — public read-online endpoint, no auth required
export async function GET(
  _: NextRequest,
  context: { params: { token: string; step: string } }
) {
  try {
    const admin = getSupabaseAdminClient()
    const { token, step } = context.params

    const stepIndex = parseInt(step, 10)
    if (isNaN(stepIndex) || stepIndex < 1) {
      return NextResponse.json({ error: 'Ogiltigt steg' }, { status: 400 })
    }

    // Look up loop by token
    const { data: loop } = await admin
      .from('loops')
      .select('id, title, user_id')
      .eq('token', token)
      .single()

    if (!loop) {
      return NextResponse.json({ error: 'Sidan hittades inte' }, { status: 404 })
    }

    // Get approved messages ordered by index
    const { data: messages } = await admin
      .from('loop_messages')
      .select('order_index, subject, body_html')
      .eq('loop_id', loop.id)
      .eq('status', 'approved')
      .order('order_index')

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Inga meddelanden hittades' }, { status: 404 })
    }

    // stepIndex is 1-based
    const message = messages[stepIndex - 1]
    if (!message) {
      return NextResponse.json({ error: 'Steget hittades inte' }, { status: 404 })
    }

    // Get sender name from profile
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', loop.user_id)
      .maybeSingle()

    return NextResponse.json({
      loopTitle: loop.title,
      subject: message.subject,
      bodyHtml: message.body_html,
      orderIndex: message.order_index,
      totalMessages: messages.length,
      senderName: profile?.full_name || 'Doings',
    })
  } catch (err) {
    console.error('GET /api/loop/[token]/[step] error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
