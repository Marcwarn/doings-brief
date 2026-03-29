import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })

    const admin = getSupabaseAdminClient()

    // Verify ownership before deleting
    const { data: qs } = await admin
      .from('question_sets')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!qs) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    if (qs.user_id !== user.id) return NextResponse.json({ error: 'Obehörig' }, { status: 403 })

    const { error } = await admin.from('question_sets').delete().eq('id', id)
    if (error) {
      console.error('delete question_set error:', error)
      return NextResponse.json({ error: 'Kunde inte radera' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('question-set delete error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
