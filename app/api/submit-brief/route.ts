import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = `Doings Brief <${process.env.FROM_EMAIL || 'brief@doingsclients.se'}>`

// Use anon key — RLS policies allow public read/insert for brief operations
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Answer = { label: string; question: string; answer: string }

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function buildHtml(clientName: string, answers: Answer[], now: string) {
  const rows = answers.map((a, i) => `
    <tr>
      <td style="padding:14px 24px;border-bottom:1px solid #f0eaf5;vertical-align:top;width:40%;">
        <span style="font-size:11px;font-weight:600;color:#6b2d82;text-transform:uppercase;letter-spacing:.05em;">${i+1}. ${esc(a.label)}</span>
        <p style="margin:4px 0 0;font-size:13px;color:#606070;">${esc(a.question)}</p>
      </td>
      <td style="padding:14px 24px;border-bottom:1px solid #f0eaf5;vertical-align:top;">
        <p style="margin:0;font-size:14px;color:#0a0a0f;line-height:1.6;white-space:pre-wrap;">${esc(a.answer||'(Inget svar)')}</p>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html><html lang="sv">
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,.08);">
    <tr><td colspan="2" style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,.55);font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Ny brief</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${esc(clientName)}</h1>
      <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,.5);">Inlämnad ${now}</p>
    </td></tr>
    <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td colspan="2" style="padding:20px 32px;background:#f5f4f8;border-top:1px solid #e8d9f0;">
      <p style="margin:0;font-size:12px;color:#606070;text-align:center;">Skickat via <strong>Doings Brief</strong></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, clientName, token, answers } = await req.json()

    // 1. Get consultant email from the session (stored when created)
    const { data: session } = await sb
      .from('brief_sessions')
      .select('consultant_email')
      .eq('id', sessionId)
      .single()

    const consultantEmail = session?.consultant_email || 'marcus.warn@doings.se'

    // 2. Save answers
    await sb.from('brief_answers').insert({ session_id: sessionId, answers })

    // 3. Mark session submitted
    await sb.from('brief_sessions')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('token', token)

    // 4. Email consultant
    const now = new Date().toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })
    await resend.emails.send({
      from:    FROM,
      to:      consultantEmail,
      subject: `Brief från ${clientName}`,
      html:    buildHtml(clientName, answers, now),
      text:    answers.map((a: Answer, i: number) => `${i+1}. ${a.question}\n${a.answer||'(Inget svar)'}`).join('\n\n'),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Submit brief error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
