import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })

    const admin = getSupabaseAdminClient()

    const { data: qs } = await admin
      .from('question_sets')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!qs) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    if (qs.user_id !== user.id) return NextResponse.json({ error: 'Obehörig' }, { status: 403 })

    const { data: questions } = await admin
      .from('questions')
      .select('id')
      .eq('question_set_id', id)

    const questionIds = (questions || []).map(q => q.id)

    const { count: sessionCount } = await admin
      .from('brief_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('question_set_id', id)

    const { count: responseCount } = questionIds.length > 0
      ? await admin
          .from('brief_responses')
          .select('id', { count: 'exact', head: true })
          .in('question_id', questionIds)
      : { count: 0 }

    return NextResponse.json({
      sessionCount: sessionCount ?? 0,
      responseCount: responseCount ?? 0,
    })
  } catch (err) {
    console.error('question-set impact check error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

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

    // brief_responses.question_id → questions with NO ACTION — must delete responses first
    const { data: questions } = await admin
      .from('questions')
      .select('id')
      .eq('question_set_id', id)

    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id)
      await admin.from('brief_responses').delete().in('question_id', questionIds)
    }

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
