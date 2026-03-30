import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'
import { getSupabaseRequestClient } from '@/lib/server-auth'

type RawRecipient = {
  name?: unknown
  email?: unknown
  role?: unknown
}

type ResponseMode = 'named' | 'anonymous'

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: 'Lägg till minst en mottagare.' }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
  const recipients: Array<{ name: string; email: string; role: string | null }> = []
  const seenEmails = new Set<string>()

  for (let index = 0; index < value.length; index += 1) {
    const rawRecipient = value[index]
    if (!rawRecipient || typeof rawRecipient !== 'object') {
      return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: `Mottagare ${index + 1} är ogiltig.` }
    }

    const recipient = rawRecipient as RawRecipient
    const name = asTrimmedString(recipient.name)
    const email = asTrimmedString(recipient.email).toLowerCase()
    const role = asTrimmedString(recipient.role) || null

    if (!emailPattern.test(email)) {
      return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: `Mottagare ${index + 1} saknar giltig e-postadress.` }
    }

    if (seenEmails.has(email)) {
      return { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: `E-postadressen ${email} finns flera gånger i listan.` }
    }

    seenEmails.add(email)
    recipients.push({
      name: name || email.split('@')[0],
      email,
      role,
    })
  }

  return { recipients, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const resend = getResendClient()
    const body = await req.json() as Record<string, unknown>

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const templateId = asTrimmedString(body.templateId)
    const organisation = asTrimmedString(body.organisation) || null
    const responseMode: ResponseMode = body.responseMode === 'anonymous' ? 'anonymous' : 'named'
    const { recipients, error: recipientError } = responseMode === 'named'
      ? normalizeRecipients(body.recipients)
      : { recipients: [] as Array<{ name: string; email: string; role: string | null }>, error: null }

    if (!templateId) {
      return NextResponse.json({ error: 'Välj ett upplägg innan du skickar.' }, { status: 400 })
    }

    if (responseMode === 'anonymous' && !organisation) {
      return NextResponse.json({ error: 'Ange kund eller organisation för den anonyma länken.' }, { status: 400 })
    }

    if (recipientError) {
      return NextResponse.json({ error: recipientError }, { status: 400 })
    }

    const [{ data: template, error: templateError }, { data: profile }] = await Promise.all([
      admin
        .from('discovery_templates')
        .select('id, user_id, intro_title')
        .eq('id', templateId)
        .single(),
      admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single(),
    ])

    if (templateError || !template) {
      return NextResponse.json({ error: 'Upplägget hittades inte.' }, { status: 404 })
    }

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 403 })
    }

    const sessionRows = responseMode === 'anonymous'
      ? [{
          consultant_id: user.id,
          consultant_email: user.email || null,
          template_id: templateId,
          response_mode: 'anonymous' as const,
          client_name: organisation || 'Anonymt svar',
          client_email: user.email || 'anonymous@doings.invalid',
          client_organisation: organisation,
        }]
      : recipients.map(recipient => ({
          consultant_id: user.id,
          consultant_email: user.email || null,
          template_id: templateId,
          response_mode: 'named' as const,
          client_name: recipient.name,
          client_email: recipient.email,
          client_organisation: organisation,
        }))

    const { data: sessions, error: sessionInsertError } = await admin
      .from('discovery_sessions')
      .insert(sessionRows)
      .select('id, client_name, client_email, response_mode, token')

    if (sessionInsertError || !sessions || sessions.length === 0) {
      console.error('discovery session insert error:', sessionInsertError)
      return NextResponse.json({ error: 'Kunde inte skapa utskicket.' }, { status: 500 })
    }

    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const senderName = profile?.full_name || 'Doings'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'

    if (responseMode === 'anonymous') {
      const session = sessions[0]
      const discoveryUrl = `${baseUrl}/discovery/${session.token}`

      return NextResponse.json({
        ok: true,
        sent: 1,
        failed: 0,
        results: [{
          sessionId: session.id,
          email: organisation || 'Anonym länk',
          ok: true,
          token: session.token,
          url: discoveryUrl,
          label: 'Anonym länk',
        }],
      })
    }

    const results = await Promise.all(
      sessions.map(async session => {
        const discoveryUrl = `${baseUrl}/discovery/${session.token}`
        const footerContactHtml = user.email
          ? `Har du frågor? Kontakta <a href="mailto:${escHtml(user.email)}" style="color:#6b2d82;">${escHtml(user.email)}</a>`
          : 'Har du frågor? Kontakta oss via Doings'
        const footerContactText = user.email
          ? `Har du frågor? Kontakta ${user.email}`
          : 'Har du frågor? Kontakta oss via Doings'

        const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(30,14,46,.10);">
        <tr>
          <td style="background:radial-gradient(circle at top left,#7a3ea1 0%,#3a1a54 46%,#1e0e2e 100%);padding:36px 32px 34px;">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.68);font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Fördjupande underlag från ${escHtml(senderName)}</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.15;">Hej ${escHtml(session.client_name)}!</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);max-width:430px;">
              Tack för dialogen hittills. Här vill vi samla in några fördjupande perspektiv inför nästa steg.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <div style="padding:18px 18px 16px;border:1px solid #ece4f3;border-radius:14px;background:linear-gradient(180deg,#fcfbfe 0%,#f8f4fb 100%);margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#5e5873;line-height:1.65;">
                Era svar hjälper oss att förstå nuläge, behov och riktning bättre och skapa en första utgångspunkt tillsammans.
                Discoveryn tar ungefär <strong style="color:#241433;">10–15 minuter</strong> att besvara.
              </p>
            </div>
            <p style="margin:0 0 22px;font-size:15px;color:#312a3f;line-height:1.72;">
              Klicka på knappen nedan för att öppna din personliga länk och dela era perspektiv i lugn och ro.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background:#6b2d82;border-radius:12px;">
                  <a href="${discoveryUrl}" style="display:inline-block;background:#6b2d82;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;border:1px solid #6b2d82;">
                    Öppna era frågor →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;color:#7b748e;text-align:center;line-height:1.6;">
              Länken är personlig och gäller för just den här discoveryn.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f7f1fb;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#746d86;text-align:center;line-height:1.65;">
              Skickat via <strong>Doings</strong> · ${footerContactHtml}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

        const { error: emailError } = await resend.emails.send({
          from: `${senderName} via Doings <${fromEmail}>`,
          reply_to: user.email || undefined,
          to: session.client_email,
          subject: `${template.intro_title} – några fördjupande frågor inför nästa steg`,
          html,
          text: `Hej ${session.client_name}!\n\nTack för dialogen hittills. Här vill ${senderName} på Doings samla in några fördjupande perspektiv för att förstå nuläge, behov och riktning bättre.\n\nEra svar hjälper oss att skapa en första utgångspunkt tillsammans.\n\nÖppna din personliga länk här:\n${discoveryUrl}\n\n${footerContactText}\n\n– Doings`,
        })

        if (emailError) {
          console.error('discovery send email error:', emailError)
          return {
            sessionId: session.id,
            email: session.client_email,
            ok: false,
            reason: emailError.message || 'Kunde inte skicka e-post.',
          }
        }

        return {
          sessionId: session.id,
          email: session.client_email,
          ok: true,
          token: session.token,
          url: discoveryUrl,
          label: session.client_name,
        }
      })
    )

    const sent = results.filter(result => result.ok)
    const failed = results.filter(result => !result.ok)

    if (sent.length === 0) {
      return NextResponse.json({
        ok: false,
        sent: 0,
        failed: failed.length,
        results,
      }, { status: 409 })
    }

    return NextResponse.json({
      ok: failed.length === 0,
      sent: sent.length,
      failed: failed.length,
      results,
    })
  } catch (error) {
    console.error('discovery send fatal:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
