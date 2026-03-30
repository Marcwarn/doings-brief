'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, type QuestionSet, type Question } from '@/lib/supabase'
import { slugifyCustomer, type StoredCustomerRecord } from '@/lib/customers'
import { BriefSubnav } from '@/app/dashboard/brief/ui'

const F: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
}

type Recipient = {
  name: string
  email: string
  role: string | null
}

type SentSession = Recipient & {
  token: string
}

type QuestionDraft = {
  text: string
}

type BriefWorkspaceTab = 'questions' | 'setup' | 'send'

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

function parseDelimitedLine(line: string) {
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  parts.push(current.trim())
  return parts
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

function buildQuestionSetName(organisation: string) {
  const date = new Date().toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return organisation.trim() ? `${organisation.trim()} · Frågor ${date}` : `Nytt frågebatteri ${date}`
}

function SendBriefInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sb = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sets, setSets]               = useState<QuestionSet[]>([])
  const [selectedSet, setSelectedSet] = useState<string>('')
  const [questionSetQuery, setQuestionSetQuery] = useState('')
  const [showQuestionSetPicker, setShowQuestionSetPicker] = useState(false)
  const [questions, setQuestions]     = useState<Question[]>([])
  const [customSetName, setCustomSetName] = useState('')
  const [customQuestions, setCustomQuestions] = useState<QuestionDraft[]>([{ text: '' }, { text: '' }])
  const [clientOrg, setClientOrg]           = useState('')
  const [storedCustomers, setStoredCustomers] = useState<StoredCustomerRecord[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [recipientsInput, setRecipientsInput] = useState('')
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState<SentSession[] | null>(null)
  const [error, setError]             = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [activeTab, setActiveTab] = useState<BriefWorkspaceTab>('questions')
  const [introTitle, setIntroTitle] = useState('Några korta frågor')
  const [introText, setIntroText] = useState('Hjälp oss få en snabbare bild inför nästa steg. Det tar bara några minuter att svara.')
  const [internalLabel, setInternalLabel] = useState('')
  const [contextNote, setContextNote] = useState('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const [questionSetsResult, customersResponse] = await Promise.all([
        sb.from('question_sets').select('*').order('updated_at', { ascending: false }),
        fetch('/api/customers'),
      ])
      setSets(questionSetsResult.data || [])
      if (customersResponse.ok) {
        const payload = await customersResponse.json()
        setStoredCustomers(payload.customers || [])
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedSet) { setQuestions([]); return }
    sb.from('questions').select('*').eq('question_set_id', selectedSet).order('order_index')
      .then(({ data }) => setQuestions(data || []))
  }, [selectedSet])

  useEffect(() => {
    const initialSet = searchParams.get('set')
    if (initialSet && !selectedSet) {
      setSelectedSet(initialSet)
    }
  }, [searchParams, selectedSet])

  useEffect(() => {
    if (!customSetName.trim() && clientOrg.trim()) {
      setCustomSetName(buildQuestionSetName(clientOrg))
    }
  }, [clientOrg, customSetName])

  useEffect(() => {
    if (!internalLabel.trim() && clientOrg.trim()) {
      setInternalLabel(formatBatchLabel(clientOrg))
    }
  }, [clientOrg, internalLabel])

  const customerSuggestions = storedCustomers
    .filter(customer => {
      if (!clientOrg.trim()) return false
      return slugifyCustomer(customer.label).includes(slugifyCustomer(clientOrg))
    })
    .slice(0, 6)

  const selectedSetRecord = sets.find(set => set.id === selectedSet) || null
  const parsedRecipientsPreview = useMemo(() => {
    const { recipients } = parseRecipients(recipientsInput)
    return recipients
  }, [recipientsInput])
  const firstPreviewRecipient = parsedRecipientsPreview[0] || null
  const activeQuestions = customQuestions.map(question => question.text.trim()).filter(Boolean)
  const filteredSets = sets.filter(set => {
    if (!questionSetQuery.trim()) return true
    const query = questionSetQuery.trim().toLowerCase()
    return `${set.name} ${set.description || ''}`.toLowerCase().includes(query)
  })
  const visibleSets = filteredSets.slice(0, questionSetQuery.trim() ? 12 : 8)

  function updateCustomQuestion(index: number, value: string) {
    setCustomQuestions(prev => prev.map((question, questionIndex) => (
      questionIndex === index ? { text: value } : question
    )))
  }

  function addCustomQuestion() {
    setCustomQuestions(prev => [...prev, { text: '' }])
  }

  function removeCustomQuestion(index: number) {
    setCustomQuestions(prev => prev.length <= 1 ? prev : prev.filter((_, questionIndex) => questionIndex !== index))
  }

  function importSelectedSetIntoCustomQuestions() {
    if (!selectedSet || questions.length === 0) {
      setError('Välj ett frågebatteri först om du vill importera det.')
      return
    }

    setError('')
    setCustomSetName(prev => prev.trim() ? prev : `${sets.find(set => set.id === selectedSet)?.name || 'Importerade frågor'} · kopia`)
    setCustomQuestions(questions.map(question => ({ text: question.text })))
  }

  async function selectQuestionSetSource(setId: string) {
    const selected = sets.find(set => set.id === setId) || null
    setSelectedSet(setId)
    setShowQuestionSetPicker(false)
    setQuestionSetQuery('')

    const { data } = await sb
      .from('questions')
      .select('*')
      .eq('question_set_id', setId)
      .order('order_index')

    const importedQuestions = data || []
    setQuestions(importedQuestions)
    setCustomSetName(prev => prev.trim() ? prev : `${selected?.name || 'Importerade frågor'} · kopia`)
    setCustomQuestions(importedQuestions.length > 0
      ? importedQuestions.map(question => ({ text: question.text }))
      : [{ text: '' }, { text: '' }])
  }

  async function importRecipientsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setImportMessage('')

    try {
      let importedLines: string[] = []

      const lowerName = file.name.toLowerCase()
      const text = await file.text()

      if (lowerName.endsWith('.txt')) {
        importedLines = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
      } else {
        const rows = text
          .split(/\r?\n/)
          .filter(line => line.trim())
          .map(parseDelimitedLine)
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
      setError('Kunde inte läsa filen. Använd .csv eller .txt.')
    } finally {
      e.target.value = ''
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    let questionSetId = selectedSet

    const filteredQuestions = customQuestions
      .map(question => question.text.trim())
      .filter(Boolean)

    if (!customSetName.trim()) {
      setError('Ge frågorna ett namn innan du skickar.')
      return
    }

    if (filteredQuestions.length === 0) {
      setError('Lägg till minst en fråga.')
      return
    }

    const { data: { user: currentUser } } = await sb.auth.getUser()
    const { data: createdQuestionSet, error: questionSetError } = await sb
      .from('question_sets')
      .insert({
        user_id: currentUser?.id,
        name: customSetName.trim(),
        description: [
          selectedSet
            ? `Importerad och justerad från ${selectedSetRecord?.name || 'befintligt frågebatteri'}`
            : 'Skapad direkt i utskicksflödet',
          contextNote.trim() ? `Kontext: ${contextNote.trim()}` : '',
        ].filter(Boolean).join(' · '),
      })
      .select()
      .single()

    if (questionSetError || !createdQuestionSet) {
      setError('Kunde inte skapa frågebatteriet för utskicket.')
      return
    }

    const { error: questionInsertError } = await sb
      .from('questions')
      .insert(filteredQuestions.map((text, index) => ({
        question_set_id: createdQuestionSet.id,
        text,
        order_index: index,
      })))

    if (questionInsertError) {
      setError('Kunde inte spara frågorna för utskicket.')
      return
    }

    setSets(prev => [createdQuestionSet, ...prev])
    setSelectedSet(createdQuestionSet.id)
    setQuestions(filteredQuestions.map((text, index) => ({
      id: `draft-${index}`,
      question_set_id: createdQuestionSet.id,
      text,
      order_index: index,
      created_at: new Date().toISOString(),
    } as Question)))
    questionSetId = createdQuestionSet.id

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
      question_set_id: questionSetId,
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
        label: internalLabel.trim() || formatBatchLabel(clientOrg.trim()),
        organisation: clientOrg.trim() || null,
        questionSetId,
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
      <div style={pageShellStyle}>
        <div style={{ ...panelStyle, maxWidth: 640, margin: '0 auto', padding: '44px 36px', textAlign: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#f4fbf6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #ccefd5' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            {sent.length === 1 ? 'Brief skickad!' : `${sent.length} briefs skickade!`}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 28px', lineHeight: 1.7 }}>
            {sent.length === 1 ? (
              <>Vi skickade en länk till <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sent[0].email}</strong>.</>
            ) : (
              <>Vi skickade personliga länkar till <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{sent.length} mottagare</strong> under samma företag.</>
            )}
          </p>
          {sent.length > 1 && (
            <div style={{ ...subtlePanelStyle, marginBottom: 16, textAlign: 'left' }}>
              <div style={eyebrowLabelStyle}>
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
          <div style={{ ...subtlePanelStyle, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ ...eyebrowLabelStyle, marginBottom: 5 }}>
              {sent.length === 1 ? 'Länk till klienten' : 'Exempel på personlig länk'}
            </div>
            <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-2)', wordBreak: 'break-all' }}>{firstUrl}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigator.clipboard.writeText(firstUrl)} style={{ ...secondaryButtonStyle, flex: 1, justifyContent: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              {sent.length === 1 ? 'Kopiera länk' : 'Kopiera första länk'}
            </button>
            <button onClick={() => { setSent(null); setRecipientsInput(''); setClientOrg('') }} style={{ ...primaryButtonStyle, flex: 1, justifyContent: 'center' }}>
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
    <div style={pageShellStyle}>
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
          Nytt utskick
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.7, maxWidth: 620 }}>
          Skicka ett kort underlag till en eller flera personer inför nästa steg.
        </p>
      </div>

      <BriefSubnav active="send" />

      <div style={briefStatsRowStyle}>
        <BriefStatCard label="Frågor" value={`${activeQuestions.length}`} text={activeQuestions.length === 1 ? 'fråga i utskicket' : 'frågor i utskicket'} />
        <BriefStatCard label="Kund" value={clientOrg.trim() || 'Ingen vald'} text={clientOrg.trim() ? 'kopplad till utskicket' : 'lägg till i upplägget'} />
        <BriefStatCard label="Mottagare" value={`${parsedRecipientsPreview.length}`} text={parsedRecipientsPreview.length === 1 ? 'person i listan' : 'personer i listan'} />
      </div>

      <form onSubmit={send} style={briefWorkspaceStyle}>
        <section style={{ ...panelStyle, padding: '22px 24px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {[
              { key: 'questions' as const, label: 'Frågor' },
              { key: 'setup' as const, label: 'Upplägg' },
              { key: 'send' as const, label: 'Skicka' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...briefTabButtonStyle,
                  color: activeTab === tab.key ? 'var(--text)' : 'var(--text-2)',
                  background: activeTab === tab.key ? 'rgba(14,14,12,0.06)' : 'rgba(255,255,255,0.88)',
                  borderColor: activeTab === tab.key ? 'rgba(14,14,12,0.12)' : 'var(--border)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'questions' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Frågor och ton
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                  Håll det kort, tydligt och lätt att svara på. Briefen ska kännas som en snabb debrief, inte som en större behovsanalys.
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={fieldLabelStyle}>Rubrik i introduktionen</label>
                  <input
                    value={introTitle}
                    onChange={e => setIntroTitle(e.target.value)}
                    placeholder="Några korta frågor"
                    style={F}
                    onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Introduktion</label>
                  <textarea
                    value={introText}
                    onChange={e => setIntroText(e.target.value)}
                    rows={3}
                    placeholder="Hjälp oss få en snabbare bild inför nästa steg."
                    style={{ ...F, minHeight: 96, resize: 'vertical' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              <div style={{ ...eyebrowLabelStyle, marginBottom: -4 }}>
                Frågebatteri
              </div>
              {sets.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0 }}>
                  Inga batterier ännu.{' '}
                  <Link href="/dashboard/question-sets/new" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Skapa ett →</Link>
                </p>
              ) : (
                <div style={{ ...subtlePanelStyle, marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: showQuestionSetPicker ? 10 : 0 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Hämta från frågebatteri</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 }}>
                        Välj ett befintligt batteri om du vill använda det som startpunkt.
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowQuestionSetPicker(prev => !prev)} style={ghostActionStyle}>
                      {selectedSetRecord ? 'Byt källa' : 'Välj frågebatteri'}
                    </button>
                  </div>
                  {selectedSetRecord && !showQuestionSetPicker && (
                    <div style={selectedSourceCardStyle}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{selectedSetRecord.name}</div>
                        {selectedSetRecord.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedSetRecord.description}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Aktiv källa
                      </div>
                    </div>
                  )}
                  {showQuestionSetPicker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input
                        value={questionSetQuery}
                        onChange={e => setQuestionSetQuery(e.target.value)}
                        placeholder="Sök frågebatteri"
                        style={F}
                        onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
                        {visibleSets.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { void selectQuestionSetSource(s.id) }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 12,
                              width: '100%',
                              textAlign: 'left',
                              padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
                              border: `1.5px solid ${selectedSet === s.id ? 'rgba(198,35,104,0.4)' : 'rgba(14,14,12,0.08)'}`,
                              background: selectedSet === s.id ? 'rgba(198,35,104,0.08)' : 'rgba(255,255,255,0.82)',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                              {s.description && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.description}</div>}
                            </div>
                          </button>
                        ))}
                        {visibleSets.length === 0 && (
                          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(14,14,12,0.08)', fontSize: 12.5, color: 'var(--text-3)' }}>
                            Inga frågebatterier matchar din sökning.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={fieldLabelStyle}>Namn på frågebatteri</label>
                  <input
                    value={customSetName}
                    onChange={e => setCustomSetName(e.target.value)}
                    placeholder="Till exempel Workshop kickoff frågor"
                    style={F}
                    onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={eyebrowLabelStyle}>Egna frågor</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedSetRecord && (
                      <button type="button" onClick={importSelectedSetIntoCustomQuestions} style={ghostActionStyle}>
                        Hämta in källan igen
                      </button>
                    )}
                    <button type="button" onClick={addCustomQuestion} style={ghostActionStyle}>
                      Lägg till fråga
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customQuestions.map((question, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <textarea
                        value={question.text}
                        onChange={e => updateCustomQuestion(index, e.target.value)}
                        rows={2}
                        placeholder={`Fråga ${index + 1}`}
                        style={{ ...F, resize: 'vertical', minHeight: 72 }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                      />
                      <button type="button" onClick={() => removeCustomQuestion(index)} style={smallDeleteStyle}>
                        Ta bort
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Upplägg runt utskicket
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                  Lägg den korta kontext som hjälper dig att hitta rätt utskick senare. Detta är internt och syns inte i mottagarens vy.
                </p>
              </div>

              <div>
                <label style={fieldLabelStyle}>Kund eller organisation</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={clientOrg}
                    onChange={e => {
                      setClientOrg(e.target.value)
                      setShowCustomerSuggestions(true)
                    }}
                    placeholder="Skriv företagsnamn"
                    style={F}
                    onFocus={e => {
                      setShowCustomerSuggestions(true)
                      e.target.style.borderColor = 'rgba(198,35,104,0.45)'
                      e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)'
                    }}
                    onBlur={e => {
                      window.setTimeout(() => setShowCustomerSuggestions(false), 120)
                      e.target.style.borderColor = 'var(--border)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  {showCustomerSuggestions && customerSuggestions.length > 0 && (
                    <div style={suggestionPopoverStyle}>
                      {customerSuggestions.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setClientOrg(customer.label)
                            setShowCustomerSuggestions(false)
                          }}
                          style={suggestionRowStyle}
                        >
                          {customer.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={fieldLabelStyle}>Internt namn på utskicket</label>
                <input
                  value={internalLabel}
                  onChange={e => setInternalLabel(e.target.value)}
                  placeholder="Till exempel Acme · kickoff debrief"
                  style={F}
                  onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label style={fieldLabelStyle}>Kort intern notering</label>
                <textarea
                  value={contextNote}
                  onChange={e => setContextNote(e.target.value)}
                  rows={3}
                  placeholder="Till exempel vad briefen ska ge underlag för."
                  style={{ ...F, minHeight: 96, resize: 'vertical' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'send' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Mottagare och utskick
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.65 }}>
                  Klistra in eller importera mottagare. Skicka sedan briefen och följ svaren i översikten.
                </p>
              </div>

              <div>
                <label style={fieldLabelStyle}>Vilka ska svara? *</label>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={importRecipientsFile} style={{ display: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                    Klistra in flera rader eller importera en fil med mottagare.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Link href="/api/briefs/recipients-template" style={{ ...secondaryLinkStyle }}>
                      Ladda ner mall
                    </Link>
                    <button type="button" onClick={() => fileRef.current?.click()} style={secondaryButtonStyle}>
                      Importera CSV/TXT
                    </button>
                  </div>
                </div>
                <textarea
                  value={recipientsInput}
                  onChange={e => setRecipientsInput(e.target.value)}
                  placeholder={'Namn, e-post\nNamn <e-post>\ne-post'}
                  required
                  rows={7}
                  style={{ ...F, minHeight: 164, resize: 'vertical', lineHeight: 1.55 }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(198,35,104,0.45)'; e.target.style.boxShadow = '0 0 0 4px rgba(198,35,104,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '10px 0 0', lineHeight: 1.7 }}>
                  En person per rad. Du kan skriva <strong style={{ color: 'var(--text)' }}>Namn, e-post</strong>, <strong style={{ color: 'var(--text)' }}>Namn, e-post, roll</strong>, <strong style={{ color: 'var(--text)' }}>Namn &lt;e-post&gt;, roll</strong> eller bara <strong style={{ color: 'var(--text)' }}>e-post</strong>.
                </p>
                {importMessage && (
                  <p style={{ fontSize: 12.5, color: '#166534', margin: '10px 0 0', padding: '12px 14px', background: '#f4fbf6', border: '1px solid #ccefd5', borderRadius: 12 }}>
                    {importMessage}
                  </p>
                )}
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#b42318', margin: 0, padding: '12px 14px', background: '#fef3f2', borderRadius: 12, border: '1px solid #fecdca' }}>
                  {error}
                </p>
              )}

              <div style={{ ...subtlePanelStyle, display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  När du skickar skapas ett utskick som du sedan följer under <strong style={{ color: 'var(--text)' }}>Översikt</strong>.
                </div>
                <button
                  type="submit"
                  disabled={sending || sets.length === 0}
                  style={{
                    ...primaryButtonStyle,
                    width: '100%',
                    justifyContent: 'center',
                    background: (sending || sets.length === 0) ? '#d78aa5' : 'var(--text)',
                    cursor: (sending || sets.length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: (sending || sets.length === 0) ? 'none' : '0 10px 24px rgba(14,14,12,0.12)',
                  }}
                >
                  {sending ? 'Skickar…' : 'Skicka brief →'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, padding: 0, overflow: 'hidden', minWidth: 0 }}>
          <div style={briefPreviewShellStyle}>
            <div style={briefPreviewHeroStyle}>
              <div style={previewEyebrowStyle}>Mottagarens vy</div>
              <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.03em', color: '#fff', maxWidth: 520 }}>
                {introTitle.trim() || 'Några korta frågor'}
              </h2>
              <p style={{ margin: 0, maxWidth: 560, fontSize: 14.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.76)' }}>
                {introText.trim() || 'Hjälp oss få en snabbare bild inför nästa steg. Det tar bara några minuter att svara.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                <PreviewPill>{clientOrg.trim() || 'Ingen kund vald ännu'}</PreviewPill>
                <PreviewPill>{activeQuestions.length || 0} frågor</PreviewPill>
                <PreviewPill>{parsedRecipientsPreview.length || 0} mottagare</PreviewPill>
              </div>
            </div>

            <div style={briefPreviewContentStyle}>
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Förhandsvisning
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {firstPreviewRecipient ? `Till ${firstPreviewRecipient.name}` : 'Så här möter briefen mottagaren'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                    Fråga {activeQuestions.length > 0 ? '1' : '0'} av {activeQuestions.length || 0}
                  </div>
                </div>

                <div style={{ height: 6, borderRadius: 999, background: 'rgba(14,14,12,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: activeQuestions.length > 0 ? `${Math.max(18, Math.round(100 / activeQuestions.length))}%` : '0%', height: '100%', background: 'var(--accent)' }} />
                </div>

                <div style={previewQuestionCardStyle}>
                  <div style={previewQuestionBadgeStyle}>Fråga 1</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.18, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    {activeQuestions[0] || 'Lägg till minst en fråga för att se hur briefen kommer att kännas för mottagaren.'}
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'rgba(250,248,246,0.82)', minHeight: 124, padding: '16px 18px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-3)' }}>
                    Här svarar mottagaren med text eller röst. Frågan visas en i taget, med samma lugna rytm genom hela briefen.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={previewPrimaryButtonStyle}>Börja svara</button>
                    <button type="button" style={previewSecondaryButtonStyle}>Tillbaka</button>
                  </div>
                </div>

                <div style={previewMiniReviewStyle}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Känslan i slutet
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
                    Efter sista frågan kan mottagaren snabbt se över sina svar och skicka in dem. Briefen ska kännas kort, tydlig och respektfull mot tiden.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
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
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(198,35,104,0.10)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
      {value}
    </div>
  )
}

function BriefStatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div style={{ ...subtlePanelStyle, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  )
}

function PreviewPill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.14)',
      color: 'rgba(255,255,255,0.84)',
      fontSize: 12.5,
      fontWeight: 600,
      backdropFilter: 'blur(10px)',
    }}>
      {children}
    </div>
  )
}

const pageShellStyle: React.CSSProperties = {
  padding: '40px 44px',
  maxWidth: 1360,
  animation: 'fadeUp 0.35s ease both',
}

const briefStatsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 18,
}

const briefWorkspaceStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 0.92fr) minmax(440px, 1.28fr)',
  gap: 18,
  alignItems: 'start',
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 18px 44px rgba(14,14,12,0.06), 0 4px 14px rgba(14,14,12,0.03)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const subtlePanelStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(250,248,246,0.9)',
}

const selectedSourceCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginTop: 10,
  padding: '13px 15px',
  borderRadius: 12,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.85)',
}

const suggestionPopoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  zIndex: 20,
  background: 'rgba(255,255,255,0.98)',
  border: '1px solid rgba(14,14,12,0.08)',
  borderRadius: 14,
  boxShadow: '0 18px 40px rgba(14,14,12,0.10)',
  overflow: 'hidden',
}

const suggestionRowStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '11px 14px',
  border: 'none',
  borderBottom: '1px solid var(--border-sub)',
  background: 'rgba(255,255,255,0.98)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--text-3)',
  marginBottom: 8,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-display)',
}

const eyebrowLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'border-color 0.18s, background 0.18s',
}

const secondaryLinkStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '13px 18px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--text)',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.01em',
  color: '#fff',
  cursor: 'pointer',
  transition: 'background 0.18s, box-shadow 0.18s',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const briefTabButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.18s, border-color 0.18s, color 0.18s',
}

const ghostActionStyle: React.CSSProperties = {
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.88)',
  fontSize: 12,
  color: 'var(--text)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'border-color 0.18s, background 0.18s',
}

const smallDeleteStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid transparent',
  background: 'none',
  color: 'var(--text-3)',
  fontSize: 12,
  cursor: 'pointer',
}

const briefPreviewShellStyle: React.CSSProperties = {
  display: 'grid',
  minHeight: 820,
  background: 'linear-gradient(180deg, #131111 0%, #131111 260px, rgba(247,244,241,0.88) 260px, rgba(247,244,241,0.94) 100%)',
}

const briefPreviewHeroStyle: React.CSSProperties = {
  padding: '38px 38px 34px',
}

const previewEyebrowStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 18,
}

const briefPreviewContentStyle: React.CSSProperties = {
  padding: '0 32px 32px',
}

const previewQuestionCardStyle: React.CSSProperties = {
  borderRadius: 24,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(14,14,12,0.08)',
  boxShadow: '0 22px 54px rgba(14,14,12,0.08), 0 4px 14px rgba(14,14,12,0.04)',
  padding: '24px',
  display: 'grid',
  gap: 16,
}

const previewQuestionBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(198,35,104,0.08)',
  color: 'var(--accent)',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const previewPrimaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  justifyContent: 'center',
}

const previewSecondaryButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  justifyContent: 'center',
}

const previewMiniReviewStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(14,14,12,0.08)',
  background: 'rgba(255,255,255,0.74)',
  padding: '16px 18px',
}
