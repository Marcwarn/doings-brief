import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'

function escHtml(s: string) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export async function POST(req: NextRequest) {
  try {
    const resend = getResendClient()
    const sb = getSupabaseAdminClient()
    const { token, responses } = await req.json()
    // responses: Array<{ questionId, questionText, orderIndex, responseType, textContent }>

    if (!token || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'Ogiltig payload' }, { status: 400 })
    }

    // Get session by token
    const { data: session, error: sessErr } = await sb
      .from('brief_sessions')
      .select('*')
      .eq('token', token)
      .single()

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Brief hittades inte' }, { status: 404 })
    }

    // Insert all responses
    await sb.from('brief_responses').insert(
      responses.map((r: any) => ({
        session_id:    session.id,
        question_id:   r.questionId || null,
        question_text: r.questionText,
        order_index:   r.orderIndex,
        response_type: r.responseType || 'text',
        text_content:  r.textContent || null,
      }))
    )

    // Mark session as submitted
    await sb.from('brief_sessions').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).eq('token', token)

    // Get consultant profile to send notification
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, sender_email')
      .eq('email', session.consultant_email)
      .single()

    const senderName  = profile?.full_name || 'Doings'
    const senderEmail = profile?.sender_email || 'brief@doingsclients.se'
    const dashUrl     = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'}/dashboard/briefs/${session.id}`

    // Send notification email to consultant
    if (session.consultant_email) {
      const rows = responses.map((r: any, i: number) => `
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid #f0eaf5;vertical-align:top;width:35%;">
            <span style="font-size:11px;font-weight:600;color:#6b2d82;text-transform:uppercase;">Fråga ${i+1}</span>
            <p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.5;">${escHtml(r.questionText)}</p>
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid #f0eaf5;vertical-align:top;">
            <p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.6;white-space:pre-wrap;">${escHtml(r.textContent || '(Inget svar)')}</p>
          </td>
        </tr>`).join('')

      const { data: emailData, error: emailError } = await resend.emails.send({
        from:    `${senderName} <${senderEmail}>`,
        to:      session.consultant_email,
        subject: `Brief besvarad – ${session.client_name}`,
        html: `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0"
             style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,.08);">
        <tr>
          <td colspan="2" style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:28px 32px;">
            <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.08em;">Brief besvarad</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${escHtml(session.client_name)}</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.55);">${escHtml(session.client_email)}</p>
          </td>
        </tr>
        <tr><td colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <tr>
          <td colspan="2" style="padding:24px 32px;text-align:center;background:#f5f4f8;border-top:1px solid #e8d9f0;">
            <a href="${dashUrl}" style="display:inline-block;background:linear-gradient(135deg,#6b2d82,#C62368);color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
              Visa i dashboard →
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        text: `Brief besvarad av ${session.client_name}\n\n${responses.map((r: any, i: number) => `Fråga ${i+1}: ${r.questionText}\nSvar: ${r.textContent || '(inget svar)'}`).join('\n\n')}\n\nSe i dashboard: ${dashUrl}`,
      })
      if (emailError) {
        console.error('Resend error:', JSON.stringify(emailError))
      } else {
        console.log('Email sent OK, id:', emailData?.id, '→', session.consultant_email)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('submit error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
