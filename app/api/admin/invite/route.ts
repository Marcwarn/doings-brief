import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const { email, fullName, senderEmail, password } = await req.json()
    if (!email) return NextResponse.json({ error: 'E-post krävs' }, { status: 400 })

    let userId: string | undefined

    if (password) {
      // Create user directly with a password — ready to log in immediately
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email confirmation
        user_metadata: { full_name: fullName },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      userId = data.user?.id
    } else {
      // Fall back to invite email flow
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/auth/reset-password`,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      userId = data.user?.id
    }

    // Upsert profile
    if (userId) {
      const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName || null,
        sender_email: senderEmail || null,
        role: 'consultant',
      }).select().single()

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, profile })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
