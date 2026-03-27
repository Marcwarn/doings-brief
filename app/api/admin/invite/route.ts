import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { getBriefAccessKey } from '@/lib/brief-access'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const { email, fullName, senderEmail, password, createdBy } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : ''
    const normalizedSenderEmail = typeof senderEmail === 'string' ? senderEmail.trim().toLowerCase() : ''

    if (!normalizedEmail) return NextResponse.json({ error: 'E-post krävs' }, { status: 400 })

    let userId: string | undefined
    let linkedExisting = false

    if (password) {
      // Create user directly with a password — ready to log in immediately
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true, // skip email confirmation
        user_metadata: { full_name: normalizedFullName },
      })
      if (error) {
        if (!error.message.toLowerCase().includes('already been registered')) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      } else {
        userId = data.user?.id
      }
    } else {
      // Fall back to invite email flow
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { full_name: normalizedFullName },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/auth/reset-password`,
      })
      if (error) {
        if (!error.message.toLowerCase().includes('already been registered')) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      } else {
        userId = data.user?.id
      }
    }

    if (!userId) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, sender_email, role')
        .eq('email', normalizedEmail)
        .single()

      if (existingProfile?.id) {
        userId = existingProfile.id
        linkedExisting = true
      }
    }

    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const existingUser = (data?.users || []).find(user => user.email?.trim().toLowerCase() === normalizedEmail)
      if (existingUser?.id) {
        userId = existingUser.id
        linkedExisting = true
      }
    }

    // Upsert profile
    if (userId) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email: normalizedEmail,
        full_name: normalizedFullName || existingProfile?.full_name || null,
        sender_email: normalizedSenderEmail || existingProfile?.sender_email || null,
        role: existingProfile?.role || 'consultant',
      }).select().single()

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }

      const accessCreatedAt = new Date().toISOString()
      const { error: accessError } = await supabaseAdmin
        .from('settings')
        .upsert({
          key: getBriefAccessKey(userId),
          value: JSON.stringify({
            userId,
            email: normalizedEmail,
            enabled: true,
            createdAt: accessCreatedAt,
            createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy : userId,
          }),
          updated_at: accessCreatedAt,
        })

      if (accessError) {
        return NextResponse.json({ error: accessError.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, profile, mode: linkedExisting ? 'linked_existing' : 'created' })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
