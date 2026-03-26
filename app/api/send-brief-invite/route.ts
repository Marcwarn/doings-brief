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
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:32px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">Hej ${clientName}!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Du har fått en brief att fylla i från Doings.</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#0a0a0f;line-height:1.6;">
            För att vi ska kunna förbereda oss inför vårt samarbete ber vi dig svara på några korta frågor.
            Det tar ungefär <strong>5–10 minuter</strong> och du kan svara med rösten direkt i webbläsaren — enkelt och smidigt.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${briefUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#3d1a47,#6b2d82);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;">
              Öppna din brief →
            </a>
          </div>
          <p style="margin:0;font-size:12px;color:#606070;text-align:center;">
            Om knappen inte fungerar, kopiera denna länk:<br>
            <a href="${briefUrl}" style="color:#6b2d82;">${briefUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f5f4f8;border-top:1px solid #e8d9f0;">
          <p style="margin:0;font-size:12px;color:#606070;text-align:center;">
            Skickat via <strong>Doings Brief</strong> · Har du frågor? Kontakta <a href="mailto:${consultantEmail}" style="color:#6b2d82;">${consultantEmail}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    await resend.emails.send({
      from: FROM,
      to:   clientEmail,
      subject: `Din brief från Doings`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Invite email error:', err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
