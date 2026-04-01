import { NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const { data: sessions, error: sessionError } = await admin
      .from('discovery_sessions')
      .select('id, template_id, response_mode, client_name, client_email, client_organisation, status, created_at, submitted_at')
      .eq('consultant_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionError) {
      console.error('discovery sessions list error:', sessionError)
      return NextResponse.json({ error: 'Kunde inte läsa utskicken.' }, { status: 500 })
    }

    const templateIds = Array.from(new Set((sessions || []).map(session => session.template_id).filter(Boolean)))

    const { data: templates, error: templateError } = templateIds.length > 0
      ? await admin
          .from('discovery_templates')
          .select('id, name')
          .in('id', templateIds)
      : { data: [], error: null }

    if (templateError) {
      console.error('discovery sessions template lookup error:', templateError)
      return NextResponse.json({ error: 'Kunde inte läsa uppläggen.' }, { status: 500 })
    }

    const templateNameById = new Map((templates || []).map(template => [template.id, template.name]))
    const sessionIds = (sessions || []).map(session => session.id)
    const { data: entries, error: entriesError } = sessionIds.length > 0
      ? await admin
          .from('discovery_submission_entries')
          .select('id, session_id')
          .in('session_id', sessionIds)
      : { data: [], error: null }

    if (entriesError) {
      console.error('discovery sessions entries lookup error:', entriesError)
      return NextResponse.json({ error: 'Kunde inte läsa svarsläget.' }, { status: 500 })
    }

    const respondentCountBySessionId = new Map<string, number>()
    for (const entry of entries || []) {
      respondentCountBySessionId.set(entry.session_id, (respondentCountBySessionId.get(entry.session_id) || 0) + 1)
    }

    return NextResponse.json({
      sessions: (sessions || []).map(session => ({
        id: session.id,
        templateId: session.template_id,
        templateName: templateNameById.get(session.template_id) || 'Perspektiv',
        responseMode: session.response_mode,
        respondentCount: respondentCountBySessionId.get(session.id) || 0,
        clientName: session.client_name,
        clientEmail: session.client_email,
        clientOrganisation: session.client_organisation,
        status: session.status,
        createdAt: session.created_at,
        submittedAt: session.submitted_at,
      })),
    })
  } catch (error) {
    console.error('discovery sessions list fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
