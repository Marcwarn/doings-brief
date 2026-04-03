import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'

export const dynamic = 'force-dynamic'

function escHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(resetUrl: string) {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(30,14,46,.10);">
        <tr>
          <td style="background:radial-gradient(circle at top left,#7a3ea1 0%,#3a1a54 46%,#1e0e2e 100%);padding:34px 32px 32px;">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.68);font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Doings Brief</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.15;">Återställ ditt lösenord</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);max-width:420px;">
              Klicka på knappen nedan för att välja ett nytt lösenord till ditt konto.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#312a3f;line-height:1.72;">
              Länken är personlig och kan användas en gång. Eftersom Brief och mötesassistenten delar inloggning kommer ett nytt lösenord att gälla i båda apparna.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background:#6b2d82;border-radius:12px;">
                  <a href="${resetUrl}" style="display:inline-block;background:#6b2d82;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;border:1px solid #6b2d82;">
                    Välj nytt lösenord
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;color:#7b748e;text-align:center;line-height:1.6;">
              Om du inte har bett om detta kan du ignorera mailet.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f7f1fb;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#746d86;text-align:center;line-height:1.65;">
              Skickat via <strong>Doings Brief</strong> · doingsclients.se
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'E-post krävs' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const resend = getResendClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'
    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'

    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const existingUser = (usersData?.users || []).find(user => user.email?.trim().toLowerCase() === normalizedEmail)
    if (!existingUser?.id) {
      return NextResponse.json({ ok: true })
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${siteUrl}/auth/reset-password`,
      },
    })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    const actionLink = linkData?.properties?.action_link
    if (!actionLink) {
      return NextResponse.json({ error: 'Kunde inte skapa återställningslänk' }, { status: 500 })
    }

    const { error: emailError } = await resend.emails.send({
      from: `Doings Brief <${fromEmail}>`,
      to: normalizedEmail,
      subject: 'Återställ ditt lösenord i Doings Brief',
      html: buildHtml(escHtml(actionLink)),
      text:
        `Återställ ditt lösenord i Doings Brief\n\n` +
        `Öppna länken nedan för att välja ett nytt lösenord:\n${actionLink}\n\n` +
        `Eftersom Brief och mötesassistenten delar inloggning kommer ett nytt lösenord att gälla i båda apparna.\n\n` +
        `Om du inte har bett om detta kan du ignorera mailet.`,
    })

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('forgot-password error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
