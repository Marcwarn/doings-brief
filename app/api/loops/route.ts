import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

// GET /api/loops — list consultant's loops with progress
export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { data: loops, error } = await admin
      .from('loops')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Kunde inte hämta loopar' }, { status: 500 })

    // For each loop, get message + recipient counts
    const loopIds = (loops || []).map(l => l.id)
    const [{ data: messages }, { data: recipients }] = await Promise.all([
      loopIds.length
        ? admin.from('loop_messages').select('id, loop_id, sent_at, status, order_index').in('loop_id', loopIds)
        : Promise.resolve({ data: [] }),
      loopIds.length
        ? admin.from('loop_recipients').select('id, loop_id').in('loop_id', loopIds)
        : Promise.resolve({ data: [] }),
    ])

    const enriched = (loops || []).map(loop => {
      const msgs = (messages || []).filter(m => m.loop_id === loop.id && m.status === 'approved')
        .sort((a, b) => a.order_index - b.order_index)
      const sentCount = msgs.filter(m => m.sent_at !== null).length
      const recipientCount = (recipients || []).filter(r => r.loop_id === loop.id).length
      const nextMessage = msgs.find(m => m.sent_at === null) || null
      return { ...loop, sentCount, totalMessages: msgs.length, recipientCount, nextMessageOrderIndex: nextMessage?.order_index ?? null }
    })

    return NextResponse.json({ loops: enriched })
  } catch (err) {
    console.error('GET /api/loops error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

// POST /api/loops — create loop with messages + recipients
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const body = await req.json()
    const { title, topicDescription, contextNotes, linkedDispatchId, messages, recipients } = body

    if (!title?.trim()) return NextResponse.json({ error: 'title krävs' }, { status: 400 })
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages krävs' }, { status: 400 })
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients krävs' }, { status: 400 })
    }

    // Create loop
    const { data: loop, error: loopError } = await admin
      .from('loops')
      .insert({
        user_id: user.id,
        title: title.trim(),
        topic_description: topicDescription?.trim() || '',
        context_notes: contextNotes?.trim() || '',
        linked_dispatch_id: linkedDispatchId || null,
        status: 'active',
      })
      .select()
      .single()

    if (loopError || !loop) {
      console.error('loop insert error:', loopError)
      return NextResponse.json({ error: 'Kunde inte skapa loop' }, { status: 500 })
    }

    // Insert messages
    const messageRows = messages.map((m: { order: number; subject: string; bodyHtml: string; bodyText: string }, i: number) => ({
      loop_id: loop.id,
      order_index: i,
      subject: String(m.subject || '').trim(),
      body_html: String(m.bodyHtml || '').trim(),
      body_text: String(m.bodyText || '').trim(),
      status: 'approved',
    }))

    const { data: insertedMessages, error: msgError } = await admin
      .from('loop_messages')
      .insert(messageRows)
      .select()

    if (msgError || !insertedMessages) {
      console.error('loop_messages insert error:', msgError)
      return NextResponse.json({ error: 'Kunde inte spara meddelanden' }, { status: 500 })
    }

    // Insert recipients
    const recipientRows = recipients.map((r: { name: string; email: string; source?: string }) => ({
      loop_id: loop.id,
      name: String(r.name || r.email || '').trim(),
      email: String(r.email || '').toLowerCase().trim(),
      source: r.source || 'manual',
    }))

    const { data: insertedRecipients, error: recipError } = await admin
      .from('loop_recipients')
      .insert(recipientRows)
      .select()

    if (recipError || !insertedRecipients) {
      console.error('loop_recipients insert error:', recipError)
      return NextResponse.json({ error: 'Kunde inte spara mottagare' }, { status: 500 })
    }

    // Create loop_sends for all message × recipient combos
    const sendRows = insertedMessages.flatMap(msg =>
      insertedRecipients.map(rec => ({
        loop_id: loop.id,
        message_id: msg.id,
        recipient_id: rec.id,
        status: 'pending',
      }))
    )

    const { error: sendsError } = await admin.from('loop_sends').insert(sendRows)
    if (sendsError) {
      console.error('loop_sends insert error:', sendsError)
      return NextResponse.json({ error: 'Kunde inte schemalägga utskick' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, loopId: loop.id })
  } catch (err) {
    console.error('POST /api/loops error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
