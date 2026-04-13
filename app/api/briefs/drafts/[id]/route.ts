import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { getBriefDraftKey, parseBriefDraftMetadata } from '@/lib/brief-drafts'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: row, error } = await admin
      .from('settings')
      .select('value')
      .eq('key', getBriefDraftKey(params.id))
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Utkastet hittades inte.' }, { status: 404 })
    }

    const draft = parseBriefDraftMetadata(row.value)
    if (!draft) {
      return NextResponse.json({ error: 'Ogiltigt utkast.' }, { status: 500 })
    }

    if (draft.createdBy !== user.id) {
      return NextResponse.json({ error: 'Åtkomst nekad.' }, { status: 403 })
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('brief draft detail error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: row, error } = await admin
      .from('settings')
      .select('value')
      .eq('key', getBriefDraftKey(params.id))
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Utkastet hittades inte.' }, { status: 404 })
    }

    const draft = parseBriefDraftMetadata(row.value)
    if (!draft) {
      return NextResponse.json({ error: 'Ogiltigt utkast.' }, { status: 500 })
    }

    if (draft.createdBy !== user.id) {
      return NextResponse.json({ error: 'Åtkomst nekad.' }, { status: 403 })
    }

    const { error: deleteError } = await admin
      .from('settings')
      .delete()
      .eq('key', getBriefDraftKey(params.id))

    if (deleteError) {
      return NextResponse.json({ error: 'Kunde inte radera utkastet.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('brief draft delete error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
