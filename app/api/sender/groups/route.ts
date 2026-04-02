import { NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { listSenderGroups } from '@/lib/sender'

export const dynamic = 'force-dynamic'

// GET /api/sender/groups — returns sender.net groups for the current consultant
export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    if (!process.env.SENDER_API_KEY) {
      return NextResponse.json({ groups: [], configured: false })
    }

    const groups = await listSenderGroups()
    return NextResponse.json({ groups, configured: true })
  } catch (err) {
    console.error('GET /api/sender/groups error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
