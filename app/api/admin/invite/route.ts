import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, senderEmail } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email krävs' }, { status: 400 })

    // Create user via admin API (sends invite email)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/auth/callback`,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Update profile with name and sender email
    if (data.user) {
      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName || null,
        sender_email: senderEmail || null,
        role: 'consultant',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
