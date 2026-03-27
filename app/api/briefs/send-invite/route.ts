import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'

function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export async function POST(req: NextRequest) {
  try {
    const resend = getResendClient()
    const supabaseAdmin = getSupabaseAdminClient()
    const { clientName, clientEmail, token, consultantEmail } = await req.json()
    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'

    // Keep a central sending address for deliverability, but expose the
    // consultant's direct email as the reply/contact address.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('email', consultantEmail)
      .single()

    const senderName = profile?.full_name || 'Doings'
    const contactEmail = consultantEmail || fromEmail
    const briefUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/brief/${token}`
    const footerContactHtml = consultantEmail
      ? `Har du frågor? Kontakta <a href="mailto:${escHtml(contactEmail)}" style="color:#6b2d82;">${escHtml(contactEmail)}</a>`
      : 'Har du frågor? Kontakta oss via Doings'
    const footerContactText = consultantEmail
      ? `Har du frågor? Kontakta ${contactEmail}`
      : 'Har du frågor? Kontakta oss via Doings'

    const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="max-width:580px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(30,14,46,.10);">
        <tr>
          <td style="background:radial-gradient(circle at top left,#7a3ea1 0%,#3a1a54 46%,#1e0e2e 100%);padding:36px 32px 34px;">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.68);font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Brief från ${escHtml(senderName)}</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.15;">Hej ${escHtml(clientName)}!</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);max-width:430px;">
              Du har fått ett kort underlag inför ert kommande arbete tillsammans med Doings.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <div style="padding:18px 18px 16px;border:1px solid #ece4f3;border-radius:14px;background:linear-gradient(180deg,#fcfbfe 0%,#f8f4fb 100%);margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#5e5873;line-height:1.65;">
                ${escHtml(senderName)} vill samla in några snabba svar från dig innan arbetet drar igång.
                Briefen tar ungefär <strong style="color:#241433;">5–10 minuter</strong> att besvara och fungerar lika bra med text som med röst.
              </p>
            </div>
            <p style="margin:0 0 22px;font-size:15px;color:#312a3f;line-height:1.72;">
              Klicka på knappen nedan för att öppna din personliga länk. Du kan svara i lugn och ro och komma tillbaka senare om det behövs.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center">
                  <a href="${briefUrl}" style="display:inline-block;background:linear-gradient(135deg,#6b2d82 0%,#c62368 100%);color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 10px 24px rgba(198,35,104,.18);">
                    Svara på frågorna →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;color:#7b748e;text-align:center;line-height:1.6;">
              Länken är personlig och giltig i 30 dagar.
            </p>
            <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eee7f4;">
              <p style="margin:0;font-size:12px;color:#7b748e;line-height:1.7;text-align:center;">
                Om knappen inte fungerar kan du öppna länken direkt här:
                <br />
                <a href="${briefUrl}" style="color:#6b2d82;text-decoration:none;font-weight:600;word-break:break-all;">${briefUrl}</a>
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f7f1fb;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#746d86;text-align:center;line-height:1.65;">
              Skickat via <strong>Doings Brief</strong> · ${footerContactHtml}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set!')
      return NextResponse.json({ error: 'Email config missing' }, { status: 500 })
    }

    const { data: emailData, error: emailError } = await resend.emails.send({
      from:    `${senderName} via Doings <${fromEmail}>`,
      reply_to: consultantEmail || undefined,
      to:      clientEmail,
      subject: `Brief inför ert arbete – ${senderName} på Doings`,
      html,
      text:    `Hej ${clientName}!\n\n${senderName} på Doings vill samla in några snabba svar från dig innan arbetet drar igång.\nBriefen tar ungefär 5–10 minuter att besvara.\n\nÖppna din personliga länk här:\n${briefUrl}\n\nLänken är personlig och giltig i 30 dagar.\n\n${footerContactText}\n\n– Doings Brief`,
    })

    if (emailError) {
      console.error('Resend send-invite error:', JSON.stringify(emailError))
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    console.log('Invite sent OK, id:', emailData?.id, '→', clientEmail)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send-invite error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
