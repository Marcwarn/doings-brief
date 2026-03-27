'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'

const F: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13.5, color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, box-shadow 0.15s',
}

type Recipient = {
  name: string
  email: string
  role: string | null
}

type SentSession = Recipient & {
  token: string
}

function titleCaseFromEmail(email: string) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseRecipients(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { recipients: [] as Recipient[], error: 'Lägg till minst en mottagare.' }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
  const seen = new Set<string>()
  const recipients: Recipient[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    let name = ''
    let email = ''
    let role = ''

    const angleMatch = line.match(/^(.*?)<([^>]+)>(?:\s*[,|-]\s*(.+))?$/)
    if (angleMatch) {
      name = angleMatch[1].trim().replace(/,$/, '')
      email = angleMatch[2].trim()
      role = angleMatch[3]?.trim() || ''
    } else if (line.includes(',')) {
      const parts = line.split(',').map(part => part.trim()).filter(Boolean)
      if (parts.length >= 3 && emailPattern.test(parts[1])) {
        name = parts[0]
        email = parts[1]
        role = parts.slice(2).join(', ')
      } else if (parts.length === 2 && emailPattern.test(parts[1])) {
        name = parts[0]
        email = parts[1]
      } else if (parts.length === 2 && emailPattern.test(parts[0])) {
        email = parts[0]
        role = parts[1]
      } else {
        const [rawName, ...rest] = parts
        name = rawName.trim()
        email = rest.join(',').trim()
      }
    } else if (emailPattern.test(line)) {
      email = line
    }

    if (!emailPattern.test(email)) {
      return {
        recipients: [],
        error: `Rad ${index + 1} har fel format. Använd "Namn, e-post" eller "Namn <e-post>".`,
      }
    }

    const normalizedEmail = email.toLowerCase()
    if (seen.has(normalizedEmail)) {
      return {
        recipients: [],
        error: `E-postadressen ${normalizedEmail} finns flera gånger i listan.`,
      }
    }

    seen.add(normalizedEmail)
    recipients.push({
      name: name || titleCaseFromEmail(normalizedEmail),
      email: normalizedEmail,
      role: role || null,
    })
  }

  return { recipients, error: '' }
}

function buildRecipientLine(name: string, email: string, role: string) {
  const cleanName = name.trim()
  const cleanEmail = email.trim().toLowerCase()
  const cleanRole = role.trim()

  if (cleanName && cleanRole) return `${cleanName}, ${cleanEmail}, ${cleanRole}`
  if (cleanName) return `${cleanName}, ${cleanEmail}`
  if (cleanRole) return `${cleanEmail}, ${cleanRole}`
  return cleanEmail
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseSpreadsheetRows(rows: string[][]) {
  const normalizedRows = rows
    .map(row => row.map(cell => cell.trim()))
    .filter(row => row.some(cell => cell.length > 0))

  if (normalizedRows.length === 0) {
    return { lines: [] as string[], error: 'Filen innehåller inga mottagare.' }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
  const firstRow = normalizedRows[0].map(normalizeHeader)
  const emailIndexFromHeader = firstRow.findIndex(cell => ['email', 'e-post', 'epost', 'mail'].includes(cell))
  const nameIndexFromHeader = firstRow.findIndex(cell => ['name', 'namn', 'person', 'kontaktperson'].includes(cell))
  const roleIndexFromHeader = firstRow.findIndex(cell => ['role', 'roll', 'titel', 'title'].includes(cell))
  const hasHeaderRow = emailIndexFromHeader >= 0

  const lines: string[] = []

  for (let rowIndex = hasHeaderRow ? 1 : 0; rowIndex < normalizedRows.length; rowIndex += 1) {
    const row = normalizedRows[rowIndex]
    if (row.length === 1) {
      lines.push(row[0])
      continue
    }

    let name = ''
    let email = ''
    let role = ''

    if (hasHeaderRow) {
      email = row[emailIndexFromHeader] || ''
      name = nameIndexFromHeader >= 0 ? (row[nameIndexFromHeader] || '') : ''
      role = roleIndexFromHeader >= 0 ? (row[roleIndexFromHeader] || '') : ''
    } else {
      const emailIndex = row.findIndex(cell => emailPattern.test(cell))
      if (emailIndex === -1) {
        return {
          lines: [],
          error: `Rad ${rowIndex + 1} saknar giltig e-postadress.`,
        }
      }

      email = row[emailIndex]
      name = row.slice(0, emailIndex).join(' ').trim()
      role = row.slice(emailIndex + 1).join(' ').trim()
    }

    if (!email.trim()) continue
    lines.push(buildRecipientLine(name, email, role))
  }

  if (lines.length === 0) {
    return { lines: [], error: 'Filen innehåller inga giltiga mottagare.' }
  }

  return { lines, error: '' }
}

function formatBatchLabel(organisation: string) {
  const date = new Date().toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return organisation ? `${organisation} · ${date}` : `Utskick ${date}`
}

function SendBriefInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sb = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sets, setSets]               = useState<QuestionSet[]>([])
  const [selectedSet, setSelectedSet] = useState<string>(searchParams.get('set') || '')
  const [questions, setQuestions]     = useState<Question[]>([])
  const [clientOrg, setClientOrg]           = useState(searchParams.get('organisation') || '')
  const [recipientsInput, setRecipientsInput] = useState('')
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState<SentSession[] | null>(null)
  const [error, setError]             = useState('')
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data } = await sb.from('question_sets').select('*').order('updated_at', { ascending: false })
      setSets(data || []); setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedSet) { setQuestions([]); return }
    sb.from('questions').select('*').eq('question_set_id', selectedSet).order('order_index')
      .then(({ data }) => setQuestions(data || []))
  }, [selectedSet])

  async function importRecipientsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setImportMessage('')

    try {
      let importedLines: string[] = []

      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text()
        importedLines = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
      } else {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, { header: 1, defval: '' })
          .map(row => row.map(cell => `${cell ?? ''}`))
        const { lines, error: importError } = parseSpreadsheetRows(rows)
        if (importError) {
          setError(importError)
          e.target.value = ''
          return
        }
        importedLines = lines
      }

      const mergedInput = [recipientsInput.trim(), importedLines.join('\n')].filter(Boolean).join('\n')
      const { recipients, error: parseError } = parseRecipients(mergedInput)
      if (parseError) {
        setError(parseError)
        e.target.value = ''
        return
      }

      setRecipientsInput(recipients.map(recipient => buildRecipientLine(recipient.name, recipient.email, recipient.role || '')).join('\n'))
      setImportMessage(`${importedLines.length} mottagare importerade.`)
    } catch {
      setError('Kunde inte läsa filen. Använd .csv, .xlsx, .xls eller .txt.')
    } finally {
      e.target.value = ''
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSet) { setError('Välj ett frågebatteri.'); return }
    const { recipients, error: parseError } = parseRecipients(recipientsInput)
    if (parseError) { setError(parseError); return }
    setSending(true); setError('')
    const { data: { user } } = await sb.auth.getUser()
    const dispatchId = crypto.randomUUID()
    const recipientByEmail = Object.fromEntries(
      recipients.map(recipient => [recipient.email, recipient])
    )
    const payload = recipients.map(recipient => ({
      consultant_id: user?.id,
      client_name: recipient.name,
      client_email: recipient.email,
      client_organisation: clientOrg.trim() || null,
      consultant_email: user?.email,
      question_set_id: selectedSet,
    }))

    const { data: sessions, error: sessErr } = await sb
      .from('brief_sessions')
      .insert(payload)
      .select()

    if (sessErr || !sessions || sessions.length === 0) {
      setError('Kunde inte skapa briefar.')
      setSending(false)
      return
    }

    const inviteResults = await Promise.all(
      sessions.map(async session => {
        const response = await fetch('/api/briefs/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: session.client_name,
            clientEmail: session.client_email,
            token: session.token,
            consultantEmail: user?.email,
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error || `Kunde inte skicka till ${session.client_email}.`)
        }

        return {
          name: session.client_name,
          email: session.client_email,
          role: recipientByEmail[session.client_email]?.role || null,
          token: session.token,
        }
      })
    ).catch((inviteError: Error) => {
      setError(inviteError.message || 'Kunde inte skicka alla briefar.')
      return null
    })

    if (!inviteResults) {
      setSending(false)
      return
    }

    fetch('/api/briefs/batches/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dispatchId,
        label: formatBatchLabel(clientOrg.trim()),
        organisation: clientOrg.trim() || null,
        questionSetId: selectedSet,
        sessionIds: sessions.map(session => session.id),
        contacts: sessions.map(session => ({
          sessionId: session.id,
          name: session.client_name,
          email: session.client_email,
          role: recipientByEmail[session.client_email]?.role || null,
        })),
      }),
    }).then(async response => {
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        console.error('Batch metadata save failed', body?.error || response.statusText)
      }
    }).catch(metadataError => {
      console.error('Batch metadata request failed', metadataError)
    })

    setSent(inviteResults)
    setSending(false)
  }

  function briefUrl(token: string) { return `${window.location.origin}/brief/${token}` }

  if (loading) return <PageLoader />

  if (sent) {
    const firstUrl = briefUrl(sent[0].token)
    return (
      <div style={{ padding: '40px 44px', maxWidth: 560, animation: 'fadeUp 0.35s ease both' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 36px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #bbf7d0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            {sent.length === 1 ? 'Brief skickad!' : `${sent.length} briefs skickade!`}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '0 0 28px' }}>
            {sent.length === 1 ? (
              <>Vi skickade en länk till <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sent[0].email}</strong>.</>
            ) : (
              <>Vi skickade personliga länkar till <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sent.length} mottagare</strong> under samma företag.</>
            )}
          </p>
          {sent.length > 1 && (
            <div style={{ background: 'var(--bg)', borderRadius: 7, padding: '12px 14px', marginBottom: 16, textAlign: 'left', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 8 }}>
                Skickade mottagare
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sent.map(recipient => (
                  <div key={recipient.token} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text)' }}>
                      {recipient.name}
                      {recipient.role && <span style={{ color: 'var(--text-3)' }}> · {recipient.role}</span>}
                    </span>
                    <span style={{ color: 'var(--text-3)' }}>{recipient.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: 'var(--bg)', borderRadius: 7, padding: '12px 14px', marginBottom: 24, textAlign: 'left', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 5 }}>
              {sent.length === 1 ? 'Länk till klienten' : 'Exempel på personlig länk'}
            </div>
            <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-2)', wordBreak: 'break-all' }}>{firstUrl}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigator.clipboard.writeText(firstUrl)} style={{
              flex: 1, padding: '10px 0', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              {sent.length === 1 ? 'Kopiera länk' : 'Kopiera första länk'}
            </button>
            <button onClick={() => { setSent(null); setRecipientsInput(''); setClientOrg('') }} style={{
              flex: 1, padding: '10px 0', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700,
              letterSpacing: '0.01em', color: 'var(--text)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              Skicka fler
            </button>
          </div>
          <Link href="/dashboard/briefs" style={{ display: 'block', marginTop: 18, fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            Se alla utskick →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 700, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
          Nytt utskick
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 8 }}>
          Börja med företaget, välj frågorna, bestäm vilka som ska svara och skicka sedan ut briefen.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          ['1', 'Kunddialog', 'Vilket företag och vilka personer gäller detta?'],
          ['2', 'Frågor', 'Vilket frågebatteri ska användas för den här dialogen?'],
          ['3', 'Skicka', 'Skicka länkarna och följ sedan svaren i utskicket.'],
        ].map(([step, title, text]) => (
          <div key={step} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 16px 14px' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, marginBottom: 12 }}>
              {step}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>{text}</div>
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <StepBadge value="1" />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Kunddialog och mottagare
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Företag</label>
              <input value={clientOrg} onChange={e => setClientOrg(e.target.value)}
                     placeholder="Mojang" style={F}
                     onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                     onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>Vilka ska svara? *</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={importRecipientsFile}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  Klistra in flera rader eller importera en fil med namn och e-post.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Link
                    href="/api/briefs/recipients-template"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Ladda ner mall
                  </Link>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Importera CSV/XLSX
                  </button>
                </div>
              </div>
              <textarea
                value={recipientsInput}
                onChange={e => setRecipientsInput(e.target.value)}
                placeholder={'Anna Lindqvist, anna@mojang.se\nJohan Berg <johan@mojang.se>\nfatima@mojang.se'}
                required
                rows={6}
                style={{ ...F, minHeight: 148, resize: 'vertical', lineHeight: 1.55 }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = '' }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
                En person per rad. Använd <strong style={{ color: 'var(--text)' }}>Namn, e-post</strong>, <strong style={{ color: 'var(--text)' }}>Namn, e-post, roll</strong>, <strong style={{ color: 'var(--text)' }}>Namn &lt;e-post&gt;, roll</strong> eller bara <strong style={{ color: 'var(--text)' }}>e-post</strong>.
              </p>
              {importMessage && (
                <p style={{ fontSize: 12, color: '#166534', margin: '8px 0 0', padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7 }}>
                  {importMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <StepBadge value="2" />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Frågor att skicka
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 14 }}>
            Frågebatteri *
          </div>
          {sets.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0 }}>
              Inga batterier ännu.{' '}
              <Link href="/dashboard/question-sets/new" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Skapa ett →</Link>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map(s => (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 7, cursor: 'pointer',
                  border: `1.5px solid ${selectedSet === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedSet === s.id ? 'var(--accent-dim)' : 'var(--bg)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="radio" name="qs" value={s.id}
                         checked={selectedSet === s.id}
                         onChange={() => setSelectedSet(s.id)}
                         style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {questions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-sub)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 8 }}>
                {questions.length} frågor
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {questions.map(q => (
                  <li key={q.id} style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{q.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 7, border: '1px solid #fecaca' }}>
            {error}
          </p>
        )}

        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '20px 22px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <StepBadge value="3" />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Skicka utskicket
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 14px' }}>
            När du skickar skapas ett utskick som du sedan följer under <strong style={{ color: 'var(--text)' }}>Utskick</strong>.
          </p>
          <button type="submit" disabled={sending || sets.length === 0} style={{
            width: '100%',
            padding: '13px 0', borderRadius: 7, border: '1px solid var(--border)',
            background: (sending || sets.length === 0) ? 'var(--bg)' : 'var(--surface)',
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.01em', color: (sending || sets.length === 0) ? 'var(--text-3)' : 'var(--text)',
            cursor: (sending || sets.length === 0) ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { if (!sending && sets.length > 0) { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-dim)' } }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.background = (sending || sets.length === 0) ? 'var(--bg)' : 'var(--surface)' }}>
            {sending ? 'Skickar…' : 'Skicka utskick →'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function SendBriefPage() {
  return <Suspense fallback={<PageLoader />}><SendBriefInner /></Suspense>
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

function StepBadge({ value }: { value: string }) {
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
      {value}
    </div>
  )
}
