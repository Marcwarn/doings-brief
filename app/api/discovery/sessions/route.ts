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
      .select('id, template_id, client_name, client_email, client_organisation, status, created_at, submitted_at')
      .eq('consultant_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionError) {
      console.error('discovery sessions list error:', sessionError)
      return NextResponse.json({ error: 'Kunde inte läsa discovery-utskicken.' }, { status: 500 })
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
      return NextResponse.json({ error: 'Kunde inte läsa discovery-uppläggen.' }, { status: 500 })
    }

    const templateNameById = new Map((templates || []).map(template => [template.id, template.name]))

    return NextResponse.json({
      sessions: (sessions || []).map(session => ({
        id: session.id,
        templateId: session.template_id,
        templateName: templateNameById.get(session.template_id) || 'Discovery',
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
