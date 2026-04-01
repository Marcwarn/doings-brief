import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient, getResendClient } from '@/lib/server-clients'

export const maxDuration = 30

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const { sessionIds } = await req.json() as { sessionIds: string[] }
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: 'sessionIds krävs' }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()
    const resend = getResendClient()
    const fromEmail = process.env.FROM_EMAIL || 'brief@doingsclients.se'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doings-brief.vercel.app'

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || 'Doings'
    const consultantEmail = profile?.email || user.email || ''

    const results: { sessionId: string; status: 'sent' | 'skipped' | 'error'; reason?: string }[] = []
    let sent = 0

    for (const sessionId of sessionIds) {
      const { data: session } = await admin
        .from('brief_sessions')
        .select('id, client_name, client_email, token, status')
        .eq('id', sessionId)
        .single()

      if (!session) {
        results.push({ sessionId, status: 'skipped', reason: 'session saknas' })
        continue
      }

      if (session.status !== 'pending') {
        results.push({ sessionId, status: 'skipped', reason: 'redan besvarad' })
        continue
      }

      const { data: existing } = await admin
        .from('settings')
        .select('key')
        .eq('key', `brief_reminder:${sessionId}`)
        .maybeSingle()

      if (existing) {
        results.push({ sessionId, status: 'skipped', reason: 'påminnelse redan skickad' })
        continue
      }

      const briefUrl = `${siteUrl}/brief/${session.token}`
      const clientName = session.client_name || 'du'

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
            <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,.68);font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Påminnelse från ${escHtml(senderName)}</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.15;">Hej ${escHtml(clientName)}!</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);max-width:430px;">
              Vi ville påminna dig om att du har en brief att besvara.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <div style="padding:18px 18px 16px;border:1px solid #ece4f3;border-radius:14px;background:linear-gradient(180deg,#fcfbfe 0%,#f8f4fb 100%);margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#5e5873;line-height:1.65;">
                ${escHtml(senderName)} väntar på dina svar inför ert kommande arbete tillsammans.
                Briefen tar ungefär <strong style="color:#241433;">5–10 minuter</strong> att besvara och fungerar lika bra med text som med röst.
              </p>
            </div>
            <p style="margin:0 0 22px;font-size:15px;color:#312a3f;line-height:1.72;">
              Din personliga länk är fortfarande aktiv. Klicka nedan för att öppna och svara i lugn och ro.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center" style="background:#6b2d82;border-radius:12px;">
                  <a href="${escHtml(briefUrl)}" style="display:inline-block;background:#6b2d82;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;border:1px solid #6b2d82;">
                    Öppna briefen →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;color:#7b748e;text-align:center;line-height:1.6;">
              Länken är personlig och giltig i 30 dagar.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f7f1fb;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#746d86;text-align:center;line-height:1.65;">
              Skickat via <strong>Doings Brief</strong> · Har du frågor? Kontakta <a href="mailto:${escHtml(consultantEmail)}" style="color:#6b2d82;">${escHtml(consultantEmail)}</a>
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
        reply_to: consultantEmail || undefined,
        to: session.client_email,
        subject: `Påminnelse: din brief från ${senderName} väntar`,
        html,
        text: `Hej ${clientName}!\n\n${senderName} väntar på dina svar inför ert kommande arbete tillsammans.\nBriefen tar ungefär 5–10 minuter att besvara.\n\nÖppna din personliga länk här:\n${briefUrl}\n\nLänken är personlig och giltig i 30 dagar.\n\n– Doings Brief`,
      })

      if (emailError) {
        console.error('remind email error:', sessionId, emailError)
        results.push({ sessionId, status: 'error', reason: emailError.message })
        continue
      }

      await admin.from('settings').upsert({
        key: `brief_reminder:${sessionId}`,
        value: JSON.stringify({ sentAt: new Date().toISOString(), clientEmail: session.client_email }),
        updated_at: new Date().toISOString(),
      })

      results.push({ sessionId, status: 'sent' })
      sent++
    }

    return NextResponse.json({ ok: true, sent, results })
  } catch (err) {
    console.error('remind error:', err)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
