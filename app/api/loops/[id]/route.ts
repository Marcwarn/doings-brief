import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

// GET /api/loops/[id] — loop detail with messages, recipients, sends
export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { id } = context.params

    const { data: loop, error } = await admin
      .from('loops')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !loop) return NextResponse.json({ error: 'Loop hittades inte' }, { status: 404 })

    const [{ data: messages }, { data: recipients }, { data: sends }] = await Promise.all([
      admin.from('loop_messages').select('*').eq('loop_id', id).order('order_index'),
      admin.from('loop_recipients').select('*').eq('loop_id', id).order('created_at'),
      admin.from('loop_sends').select('*').eq('loop_id', id),
    ])

    return NextResponse.json({ loop, messages: messages || [], recipients: recipients || [], sends: sends || [] })
  } catch (err) {
    console.error('GET /api/loops/[id] error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

// PATCH /api/loops/[id] — update loop status or a single message
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { id } = context.params
    const body = await req.json()

    // Verify ownership
    const { data: loop } = await admin
      .from('loops')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (!loop) return NextResponse.json({ error: 'Loop hittades inte' }, { status: 404 })

    // Update loop status
    if (body.status) {
      const { error } = await admin
        .from('loops')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: 'Kunde inte uppdatera loop' }, { status: 500 })
    }

    // Update a single message
    if (body.messageId && (body.subject !== undefined || body.bodyHtml !== undefined || body.bodyText !== undefined)) {
      const update: Record<string, string> = {}
      if (body.subject !== undefined) update.subject = body.subject
      if (body.bodyHtml !== undefined) update.body_html = body.bodyHtml
      if (body.bodyText !== undefined) update.body_text = body.bodyText

      const { error } = await admin
        .from('loop_messages')
        .update(update)
        .eq('id', body.messageId)
        .eq('loop_id', id)
      if (error) return NextResponse.json({ error: 'Kunde inte uppdatera meddelande' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/loops/[id] error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

// DELETE /api/loops/[id] — delete loop and all children (cascade)
export async function DELETE(_: NextRequest, context: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { id } = context.params

    const { error } = await admin
      .from('loops')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Kunde inte radera loop' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/loops/[id] error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
