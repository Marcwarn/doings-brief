import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { buildLoopEmailHtml, buildLoopEmailText } from '@/lib/loops'

export async function POST(_: NextRequest, context: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { id } = context.params

    // Verify loop ownership
    const { data: loop } = await admin
      .from('loops')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (!loop) return NextResponse.json({ error: 'Loop hittades inte' }, { status: 404 })
    if (loop.status === 'paused') return NextResponse.json({ error: 'Loop är pausad' }, { status: 400 })

    // Find next unsent approved message
    const { data: messages } = await admin
      .from('loop_messages')
      .select('*')
      .eq('loop_id', id)
      .eq('status', 'approved')
      .is('sent_at', null)
      .order('order_index')
      .limit(1)

    const nextMessage = messages?.[0]
    if (!nextMessage) return NextResponse.json({ error: 'Inga fler meddelanden att skicka' }, { status: 400 })

    // Get all approved messages count (for "Del X av Y")
    const { count: totalMessages } = await admin
      .from('loop_messages')
      .select('*', { count: 'exact', head: true })
      .eq('loop_id', id)
      .eq('status', 'approved')

    // Get pending sends for this message
    const { data: pendingSends } = await admin
      .from('loop_sends')
      .select('*, loop_recipients(*)')
      .eq('message_id', nextMessage.id)
      .eq('status', 'pending')

    if (!pendingSends || pendingSends.length === 0) {
      // All sends already done for this message — mark message as sent and return
      await admin.from('loop_messages').update({ sent_at: new Date().toISOString() }).eq('id', nextMessage.id)
      return NextResponse.json({ ok: true, sent: 0, message: 'Redan skickat till alla mottagare' })
    }

    // Get consultant profile for sender name/email
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, sender_email')
      .eq('id', user.id)
      .maybeSingle()

    const senderName = profile?.full_name || 'Doings'
    const senderEmail = profile?.sender_email || process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'

    const { getResendClient } = await import('@/lib/server-clients')
    const resend = getResendClient()

    const results: Array<{ recipientId: string; email: string; ok: boolean; reason?: string }> = []
    const now = new Date().toISOString()

    // Send to each recipient
    for (const send of pendingSends) {
      const recipient = (send as { loop_recipients: { name: string; email: string } | null }).loop_recipients
      if (!recipient?.email) {
        results.push({ recipientId: send.id, email: '', ok: false, reason: 'saknar email' })
        continue
      }

      try {
        const html = buildLoopEmailHtml({
          loop,
          message: nextMessage,
          recipientName: recipient.name || recipient.email,
          senderName,
          senderEmail,
          totalMessages: totalMessages || 1,
          baseUrl,
        })
        const text = buildLoopEmailText({
          loop,
          message: nextMessage,
          recipientName: recipient.name || recipient.email,
          senderName,
          senderEmail,
          totalMessages: totalMessages || 1,
        })

        const { error: emailError } = await resend.emails.send({
          from: `${senderName} via Doings <${fromEmail}>`,
          reply_to: senderEmail !== fromEmail ? senderEmail : undefined,
          to: recipient.email,
          subject: nextMessage.subject,
          html,
          text,
        })

        if (emailError) {
          results.push({ recipientId: send.recipient_id, email: recipient.email, ok: false, reason: emailError.message })
          await admin.from('loop_sends').update({ status: 'failed' }).eq('id', send.id)
        } else {
          results.push({ recipientId: send.recipient_id, email: recipient.email, ok: true })
          await admin.from('loop_sends').update({ status: 'sent', sent_at: now }).eq('id', send.id)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Okänt fel'
        results.push({ recipientId: send.recipient_id, email: recipient.email || '', ok: false, reason: msg })
        await admin.from('loop_sends').update({ status: 'failed' }).eq('id', send.id)
      }
    }

    const sentCount = results.filter(r => r.ok).length

    // Mark message as sent
    await admin.from('loop_messages').update({ sent_at: now }).eq('id', nextMessage.id)

    // Check if all messages are now sent → complete the loop
    const { count: remainingUnsent } = await admin
      .from('loop_messages')
      .select('*', { count: 'exact', head: true })
      .eq('loop_id', id)
      .eq('status', 'approved')
      .is('sent_at', null)

    if (remainingUnsent === 0) {
      await admin.from('loops').update({ status: 'completed', updated_at: now }).eq('id', id)
    }

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: results.length - sentCount,
      results,
      messageOrderIndex: nextMessage.order_index,
      loopCompleted: remainingUnsent === 0,
    })
  } catch (err) {
    console.error('POST /api/loops/[id]/send-next error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
