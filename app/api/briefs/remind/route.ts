import { NextRequest, NextResponse } from 'next/server'
import { getResendClient, getSupabaseAdminClient } from '@/lib/server-clients'
import { getSupabaseRequestClient } from '@/lib/server-auth'

function escHtml(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = getSupabaseRequestClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { sessionIds } = await req.json()
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'sessionIds saknas' }, { status: 400 })
    }

    const sb = getSupabaseAdminClient()
    const resend = getResendClient()
    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'

    const results = await Promise.all(sessionIds.map(async (sessionId: string) => {
      const { data: session, error } = await sb
        .from('brief_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !session) return { sessionId, ok: false, reason: 'hittades inte' }
      if (session.consultant_id && session.consultant_id !== user.id) {
        return { sessionId, ok: false, reason: 'obehörig' }
      }
      if (session.status === 'submitted') return { sessionId, ok: false, reason: 'redan besvarad' }
      if (!session.token || !session.client_email) return { sessionId, ok: false, reason: 'saknar data' }

      const reminderKey = `brief_reminder:${sessionId}`
      const { data: existing } = await sb
        .from('settings')
        .select('key')
        .eq('key', reminderKey)
        .maybeSingle()

      if (existing) return { sessionId, ok: false, reason: 'påminnelse redan skickad' }

      const { data: profile } = await sb
        .from('profiles')
        .select('full_name, sender_email')
        .eq('email', session.consultant_email)
        .single()

      const senderName = profile?.full_name || 'Doings'
      const briefUrl = `${siteUrl}/brief/${session.token}`

      const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:linear-gradient(180deg,#f7f1fb 0%,#f4f2f8 100%);font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="max-width:580px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(30,14,46,.10);">
        <tr>
          <td style="background:radial-gradient(circle at top left,#7a3ea1 0%,#3a1a54 46%,#1e0e2e 100%);padding:36px 32px 34px;">
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.68);font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Påminnelse från ${escHtml(senderName)}</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.15;">Hej ${escHtml(session.client_name)}!</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);max-width:430px;">
              Vi vill påminna om att du har ett obesvarat underlag inför ert arbete med Doings.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#312a3f;line-height:1.72;">
              Din personliga länk är fortfarande aktiv. Det tar bara 5–10 minuter att svara.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background:#6b2d82;border-radius:12px;">
                  <a href="${briefUrl}" style="display:inline-block;background:#6b2d82;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                    Svara på frågorna →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f7f1fb;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#746d86;text-align:center;">
              Skickat via <strong>Doings Brief</strong>
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
        reply_to: session.consultant_email || undefined,
        to: session.client_email,
        subject: `Påminnelse: Brief från ${senderName}`,
        html,
        text: `Hej ${session.client_name}!\n\nVi vill påminna om att du har ett obesvarat underlag inför ert arbete med Doings.\n\nDin personliga länk är fortfarande aktiv:\n${briefUrl}\n\n– ${senderName}`,
      })

      if (emailError) {
        console.error('remind email error:', JSON.stringify(emailError))
        return { sessionId, ok: false, reason: 'email misslyckades' }
      }

      const { error: settingsError } = await sb.from('settings').upsert({
        key: reminderKey,
        value: JSON.stringify({ sentAt: new Date().toISOString(), clientEmail: session.client_email }),
        updated_at: new Date().toISOString(),
      })

      if (settingsError) {
        console.error('remind settings upsert error:', settingsError)
        return { sessionId, ok: false, reason: 'kunde inte logga påminnelse' }
      }

      return { sessionId, ok: true }
    }))

    const sent = results.filter(r => r.ok).length
    const failed = results.length - sent

    if (sent === 0) {
      const reason = results[0]?.reason || 'inga påminnelser skickades'
      return NextResponse.json({ ok: false, sent, failed, results, error: reason }, { status: 409 })
    }

    return NextResponse.json({ ok: failed === 0, sent, failed, results })
  } catch (err) {
    console.error('remind error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
