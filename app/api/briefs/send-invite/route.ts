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
<body style="margin:0;padding:0;background:#f4efea;font-family:Inter,Arial,sans-serif;color:#1a1715;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(180deg,#f4efea 0%,#f8f5f2 100%);">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fffdfb;border-radius:28px;overflow:hidden;box-shadow:0 24px 64px rgba(26,23,21,0.10),0 6px 18px rgba(26,23,21,0.05);">
        <tr>
          <td style="padding:0;background:#11100f;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 34px 32px;background:radial-gradient(circle at top right,rgba(198,35,104,0.22) 0%,rgba(198,35,104,0.08) 22%,rgba(17,16,15,0) 48%),linear-gradient(180deg,#171413 0%,#11100f 100%);">
                  <p style="margin:0 0 10px;font-size:11px;color:rgba(255,255,255,0.48);font-weight:700;letter-spacing:.10em;text-transform:uppercase;">Kort brief från ${escHtml(senderName)}</p>
                  <h1 style="margin:0;font-size:34px;line-height:1.02;font-weight:700;letter-spacing:-0.04em;color:#ffffff;">Hej ${escHtml(clientName)}</h1>
                  <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.72);max-width:470px;">
                    Vi vill samla in några korta perspektiv från dig inför nästa steg i dialogen. Det ger oss en bättre utgångspunkt för det fortsatta arbetet tillsammans.
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin-top:22px;">
                    <tr>
                      <td style="padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);font-size:12px;font-weight:600;color:rgba(255,255,255,0.78);">
                        5–10 minuter · text eller röst
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 34px 34px;background:#fffdfb;">
            <div style="padding:18px 18px 16px;border:1px solid rgba(26,23,21,0.08);border-radius:18px;background:#f8f4ef;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#5b5450;line-height:1.72;">
                ${escHtml(senderName)} vill få en snabbare och mer träffsäker bild innan arbetet går vidare. Svara i lugn och ro när det passar dig.
              </p>
            </div>
            <p style="margin:0 0 22px;font-size:15px;color:#332e2b;line-height:1.8;">
              Öppna din personliga länk nedan. Briefen är kort, fungerar lika bra på mobil som dator och går fint att besvara med både text och röst direkt i webbläsaren.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
              <tr>
                <td align="center" style="background:#161311;border-radius:14px;">
                  <a href="${briefUrl}" style="display:inline-block;background:#161311;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:15px 28px;border-radius:14px;border:1px solid #161311;">
                    Öppna briefen
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#7a726c;line-height:1.7;">
              Om knappen inte fungerar kan du öppna länken här:<br>
              <a href="${briefUrl}" style="color:#c62368;text-decoration:none;">${briefUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 34px;background:#f6f1ec;border-top:1px solid rgba(26,23,21,0.08);">
            <p style="margin:0;font-size:12px;color:#746c66;text-align:center;line-height:1.7;">
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
      subject: `Några korta frågor inför nästa steg – ${senderName}`,
      html,
      text:    `Hej ${clientName}!\n\n${senderName} vill samla in några korta perspektiv från dig inför nästa steg i dialogen.\nBriefen tar ungefär 5–10 minuter och går bra att besvara med både text och röst.\n\nÖppna din personliga länk här:\n${briefUrl}\n\n${footerContactText}\n\n– Doings Brief`,
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
