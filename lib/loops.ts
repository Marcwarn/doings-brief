import type { Loop, LoopMessage, LoopRecipient } from '@/lib/supabase'

// ─── Key helpers ──────────────────────────────────────────────────────────────

export const LOOP_TOKEN_PREFIX = 'loop_token:'

export function getLoopPublicUrl(token: string, step: number, baseUrl: string): string {
  return `${baseUrl}/loop/${token}/${step}`
}

// ─── Recipient parsing (same pattern as send-page) ────────────────────────────

export type ParsedRecipient = { name: string; email: string }

function normalizeEmail(s: string) {
  return s.trim().toLowerCase()
}

function parseLine(line: string): ParsedRecipient | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  // "Name <email>" format
  const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+)>\s*$/)
  if (angleMatch) {
    const email = normalizeEmail(angleMatch[2])
    if (!email.includes('@')) return null
    return { name: angleMatch[1].trim() || email, email }
  }

  // Comma/tab/semicolon separated: name, email  or  email, name
  const parts = trimmed.split(/[,;\t]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const emailIdx = parts.findIndex(p => p.includes('@'))
    if (emailIdx === -1) return null
    const email = normalizeEmail(parts[emailIdx])
    const name = parts.find((_, i) => i !== emailIdx)?.trim() || email
    return { name, email }
  }

  // Plain email
  if (trimmed.includes('@')) {
    const email = normalizeEmail(trimmed)
    return { name: email, email }
  }

  return null
}

export function parseRecipientLines(text: string): ParsedRecipient[] {
  const seen = new Set<string>()
  const result: ParsedRecipient[] = []

  for (const line of text.split('\n')) {
    const parsed = parseLine(line)
    if (!parsed) continue
    if (seen.has(parsed.email)) continue
    seen.add(parsed.email)
    result.push(parsed)
  }

  return result
}

// ─── Loop progress helpers ────────────────────────────────────────────────────

export type LoopProgress = {
  total: number
  sent: number
  nextMessageIndex: number | null  // null = all sent
}

export function computeLoopProgress(
  messages: Pick<LoopMessage, 'id' | 'order_index' | 'sent_at' | 'status'>[],
): LoopProgress {
  const approved = messages
    .filter(m => m.status === 'approved')
    .sort((a, b) => a.order_index - b.order_index)

  const sent = approved.filter(m => m.sent_at !== null).length
  const total = approved.length

  const nextUnsent = approved.find(m => m.sent_at === null)
  const nextMessageIndex = nextUnsent ? nextUnsent.order_index : null

  return { total, sent, nextMessageIndex }
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlParagraphs(text: string) {
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2d2926;">${escHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function buildLoopEmailHtml(opts: {
  loop: Pick<Loop, 'title' | 'token'>
  message: Pick<LoopMessage, 'subject' | 'body_html' | 'order_index'>
  recipientName: string
  senderName: string
  senderEmail: string
  totalMessages: number
  baseUrl: string
}): string {
  const { loop, message, recipientName, senderName, senderEmail, totalMessages, baseUrl } = opts
  const readOnlineUrl = getLoopPublicUrl(loop.token, message.order_index, baseUrl)
  const stepLabel = `Del ${message.order_index + 1} av ${totalMessages}`

  const bodyContent = message.body_html.trim()
    ? message.body_html
    : htmlParagraphs(message.subject)

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(message.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4efea;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:linear-gradient(160deg,#1a0a2e 0%,#2d1b4e 50%,#1a0a2e 100%);">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fffdfb;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.18);">

      <!-- Header -->
      <tr><td style="padding:32px 36px 28px;background:linear-gradient(135deg,#1a0a2e 0%,#3d1f6e 100%);">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.08em;text-transform:uppercase;">${escHtml(stepLabel)}</p>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.01em;">${escHtml(loop.title)}</h1>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.75);">${escHtml(message.subject)}</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 36px;">
        <p style="margin:0 0 20px;font-size:15px;color:#6b5a7e;">Hej ${escHtml(recipientName)},</p>
        ${bodyContent}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:20px 36px;background:#f6f1ec;border-top:1px solid rgba(107,45,130,0.1);">
        <p style="margin:0;font-size:12px;color:#9e8fa0;line-height:1.6;">
          Skickat av ${escHtml(senderName)} via Doings ·
          <a href="mailto:${escHtml(senderEmail)}" style="color:#6b2d82;text-decoration:none;">${escHtml(senderEmail)}</a>
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#c0b0c4;">
          <a href="${readOnlineUrl}" style="color:#6b2d82;text-decoration:none;">Öppna i webbläsaren</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function buildLoopEmailText(opts: {
  loop: Pick<Loop, 'title'>
  message: Pick<LoopMessage, 'subject' | 'body_text' | 'order_index'>
  recipientName: string
  senderName: string
  senderEmail: string
  totalMessages: number
}): string {
  const { loop, message, recipientName, senderName, senderEmail, totalMessages } = opts
  return [
    `${loop.title} — Del ${message.order_index + 1} av ${totalMessages}`,
    `${message.subject}`,
    '',
    `Hej ${recipientName},`,
    '',
    message.body_text || message.subject,
    '',
    `—`,
    `${senderName} via Doings`,
    senderEmail,
  ].join('\n')
}

// ─── Brief dispatch contact importer ─────────────────────────────────────────

export function contactsToRecipients(
  contacts: Array<{ name: string; email: string }>,
): ParsedRecipient[] {
  const seen = new Set<string>()
  return contacts
    .filter(c => c.email?.includes('@'))
    .map(c => ({ name: c.name || c.email, email: c.email.toLowerCase() }))
    .filter(c => {
      if (seen.has(c.email)) return false
      seen.add(c.email)
      return true
    })
}
