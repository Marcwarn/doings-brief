import { NextRequest, NextResponse } from 'next/server'
import { getResendClient } from '@/lib/server-clients'

const TO_EMAIL    = 'marcus.warn@doings.se'
const FROM_EMAIL  = process.env.FROM_EMAIL || 'brief@doingsclients.se'
const FROM_NAME   = 'Doings Brief'

type Answer = { question: string; label: string; answer: string }
type Payload = { clientName?: string; answers: Answer[] }

// ── HTML email template ──────────────────────────────────────────────────────
function buildHtml(clientName: string, answers: Answer[]) {
  const name = clientName || 'Okänd kund'
  const now  = new Date().toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })

  const rows = answers
    .map(
      (a, i) => `
    <tr>
      <td style="padding:16px 24px;border-bottom:1px solid #f0eaf5;vertical-align:top;width:40%;">
        <span style="font-size:11px;font-weight:600;color:#6b2d82;letter-spacing:0.01em;">
          Fråga ${i + 1} · ${a.label}
        </span>
        <p style="margin:4px 0 0;font-size:14px;color:#606070;line-height:1.5;">${escHtml(a.question)}</p>
      </td>
      <td style="padding:16px 24px;border-bottom:1px solid #f0eaf5;vertical-align:top;">
        <p style="margin:0;font-size:15px;color:#0a0a0f;line-height:1.6;white-space:pre-wrap;">${escHtml(a.answer || '(Inget svar)')}</p>
      </td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(107,45,130,0.08);">
        <!-- Header -->
        <tr>
          <td colspan="2" style="background:linear-gradient(135deg,#1e0e2e,#6b2d82);padding:32px 32px 28px;">
            <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.6);font-weight:600;letter-spacing:0.01em;">Ny brief</p>
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${escHtml(name)}</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">Inlämnad ${now}</p>
          </td>
        </tr>
        <!-- Answers -->
        <tr><td colspan="2">
          <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <!-- Footer -->
        <tr>
          <td colspan="2" style="padding:24px 32px;background:#f5f4f8;border-top:1px solid #e8d9f0;">
            <p style="margin:0;font-size:12px;color:#606070;text-align:center;">
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

// ── Plain-text fallback ──────────────────────────────────────────────────────
function buildText(clientName: string, answers: Answer[]) {
  const name = clientName || 'Okänd kund'
  const now  = new Date().toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })
  const lines = [
    `NY BRIEF FRÅN: ${name}`,
    `Datum: ${now}`,
    '',
    ...answers.flatMap((a, i) => [
      `FRÅGA ${i + 1}: ${a.question}`,
      a.answer || '(Inget svar)',
      '',
    ]),
    '---',
    'Doings Brief · doingsclients.se',
  ]
  return lines.join('\n')
}

function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const resend = getResendClient()
    const { clientName = '', answers }: Payload = await req.json()

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const subject = clientName
      ? `Brief från ${clientName}`
      : `Ny brief – ${new Date().toLocaleDateString('sv-SE')}`

    const { data, error } = await resend.emails.send({
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      TO_EMAIL,
      subject,
      html:    buildHtml(clientName, answers),
      text:    buildText(clientName, answers),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
