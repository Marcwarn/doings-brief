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

    // Get consultant profile for sender name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, sender_email')
      .eq('email', consultantEmail)
      .single()

    const senderName  = profile?.full_name  || 'Doings'
    const senderEmail = profile?.sender_email || process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const briefUrl    = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/brief/${token}`

    const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:32px;">
            <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,.6);font-weight:600;letter-spacing:.01em;">Brief från ${escHtml(senderName)}</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">Hej ${escHtml(clientName)}!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              ${escHtml(senderName)} på Doings har skickat dig ett kort frågeformulär inför ert kommande arbete tillsammans.
              Det tar ungefär 5–10 minuter att besvara, och du kan svara med röst eller text.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:linear-gradient(135deg,#6b2d82,#C62368);border-radius:12px;padding:14px 32px;">
                  <a href="${briefUrl}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
                    Svara på frågorna →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#999;text-align:center;">
              Länken är personlig och giltig i 30 dagar.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f5f4f8;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#999;text-align:center;">
              Skickat via <strong>Doings Brief</strong> · doingsclients.se
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
      from:    `${senderName} <${senderEmail}>`,
      to:      clientEmail,
      subject: `Brief inför ert arbete – ${senderName} på Doings`,
      html,
      text:    `Hej ${clientName}!\n\n${senderName} på Doings har skickat dig ett frågeformulär.\nSvara här: ${briefUrl}\n\n– Doings Brief`,
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
