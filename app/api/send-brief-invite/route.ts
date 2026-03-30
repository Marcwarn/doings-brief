import { NextRequest, NextResponse } from 'next/server'
import { getResendClient } from '@/lib/server-clients'

const FROM     = `Doings Brief <${process.env.FROM_EMAIL || 'brief@doingsclients.se'}>`

export async function POST(req: NextRequest) {
  try {
    const resend = getResendClient()
    const { clientName, clientEmail, token, consultantEmail } = await req.json()
    const briefUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://doings-brief.vercel.app'}/brief/${token}`

    const html = `
<!DOCTYPE html><html lang="sv">
<body style="margin:0;padding:0;background:#f4efea;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(180deg,#f4efea 0%,#f8f5f2 100%);">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fffdfb;border-radius:28px;overflow:hidden;box-shadow:0 24px 64px rgba(26,23,21,0.10),0 6px 18px rgba(26,23,21,0.05);">
        <tr><td style="padding:36px 34px 32px;background:radial-gradient(circle at top right,rgba(198,35,104,0.22) 0%,rgba(198,35,104,0.08) 22%,rgba(17,16,15,0) 48%),linear-gradient(180deg,#171413 0%,#11100f 100%);">
          <p style="margin:0 0 10px;font-size:11px;color:rgba(255,255,255,0.48);font-weight:700;letter-spacing:.10em;text-transform:uppercase;">Kort brief från Doings</p>
          <h1 style="margin:0;font-size:34px;line-height:1.02;font-weight:700;letter-spacing:-0.04em;color:#fff;">Hej ${clientName}</h1>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.72);max-width:470px;">Vi vill samla in några korta perspektiv från dig inför nästa steg i arbetet tillsammans.</p>
        </td></tr>
        <tr><td style="padding:32px 34px 34px;background:#fffdfb;">
          <div style="padding:18px 18px 16px;border:1px solid rgba(26,23,21,0.08);border-radius:18px;background:#f8f4ef;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#5b5450;line-height:1.72;">
              Briefen tar ungefär 5–10 minuter och fungerar bra att besvara med både text och röst direkt i webbläsaren.
            </p>
          </div>
          <p style="margin:0 0 22px;font-size:15px;color:#332e2b;line-height:1.8;">
            Öppna din personliga länk nedan när det passar dig.
          </p>
          <div style="margin:0 0 18px;">
            <a href="${briefUrl}" style="display:inline-block;background:#161311;color:#ffffff;text-decoration:none;padding:15px 28px;border-radius:14px;font-weight:700;font-size:15px;">
              Öppna briefen
            </a>
          </div>
          <p style="margin:0;font-size:12px;color:#7a726c;line-height:1.7;">
            Om knappen inte fungerar, öppna länken här:<br>
            <a href="${briefUrl}" style="color:#c62368;text-decoration:none;">${briefUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 34px;background:#f6f1ec;border-top:1px solid rgba(26,23,21,0.08);">
          <p style="margin:0;font-size:12px;color:#746c66;text-align:center;line-height:1.7;">
            Skickat via <strong>Doings Brief</strong> · Har du frågor? Kontakta <a href="mailto:${consultantEmail}" style="color:#c62368;">${consultantEmail}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    await resend.emails.send({
      from: FROM,
      to:   clientEmail,
      subject: `Några korta frågor inför nästa steg`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Invite email error:', err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
