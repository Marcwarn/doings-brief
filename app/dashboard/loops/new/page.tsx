'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type GeneratedMessage = {
  order: number
  subject: string
  bodyHtml: string
  bodyText: string
}

type Recipient = { name: string; email: string }

type EvalListItem = {
  id: string
  label: string
  customer: string
  collectEmail: boolean
  responseCount: number
}

const TABS = ['Innehåll', 'Mottagare', 'Generera', 'Aktivera'] as const
type Tab = (typeof TABS)[number]

export default function NewLoopPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<Tab>('Innehåll')
  const [title, setTitle] = useState('')
  const [topicDescription, setTopicDescription] = useState('')
  const [contextNotes, setContextNotes] = useState('')
  const [count, setCount] = useState(5)

  // Recipients — two modes
  const [importMode, setImportMode] = useState<'evaluation' | 'manual'>('evaluation')
  const [evaluationsList, setEvaluationsList] = useState<EvalListItem[]>([])
  const [loadingEvals, setLoadingEvals] = useState(false)
  const [selectedEvalId, setSelectedEvalId] = useState('')
  const [importedRecipients, setImportedRecipients] = useState<Recipient[]>([])
  const [loadingImport, setLoadingImport] = useState(false)
  const [recipientText, setRecipientText] = useState('')

  const [messages, setMessages] = useState<GeneratedMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Fetch evaluations list when on Mottagare tab in evaluation mode
  useEffect(() => {
    if (activeTab !== 'Mottagare' || importMode !== 'evaluation') return
    if (evaluationsList.length > 0) return
    setLoadingEvals(true)
    fetch('/api/evaluations')
      .then(r => r.json())
      .then(payload => {
        const list: EvalListItem[] = (payload.evaluations || []).filter(
          (e: EvalListItem) => e.collectEmail && e.responseCount > 0
        )
        setEvaluationsList(list)
      })
      .catch(() => {})
      .finally(() => setLoadingEvals(false))
  }, [activeTab, importMode, evaluationsList.length])

  async function importFromEvaluation(evalId: string) {
    if (!evalId) return
    setLoadingImport(true)
    setImportedRecipients([])
    try {
      const res = await fetch(`/api/evaluations/${evalId}`)
      const payload = await res.json()
      const seen = new Set<string>()
      const imported: Recipient[] = (payload.responses || [])
        .filter((r: { email: string }) => r.email)
        .map((r: { email: string }) => ({
          name: r.email.split('@')[0],
          email: r.email.toLowerCase(),
        }))
        .filter((r: Recipient) => {
          if (seen.has(r.email)) return false
          seen.add(r.email)
          return true
        })
      setImportedRecipients(imported)
    } catch {
      // silently fail — user sees 0 imported
    } finally {
      setLoadingImport(false)
    }
  }

  // Parse recipients from textarea (manual mode)
  function parseRecipients(text: string): Recipient[] {
    const seen = new Set<string>()
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .flatMap(line => {
        const angleMatch = line.match(/^(.+?)\s*<([^>]+)>$/)
        if (angleMatch) return [{ name: angleMatch[1].trim(), email: angleMatch[2].trim().toLowerCase() }]
        const commaMatch = line.match(/^(.+?),\s*(.+@.+)$/)
        if (commaMatch) return [{ name: commaMatch[1].trim(), email: commaMatch[2].trim().toLowerCase() }]
        if (line.includes('@')) return [{ name: line.split('@')[0], email: line.toLowerCase() }]
        return []
      })
      .filter(r => {
        if (seen.has(r.email)) return false
        seen.add(r.email)
        return true
      })
  }

  const recipients = importMode === 'evaluation' ? importedRecipients : parseRecipients(recipientText)

  async function generate() {
    if (!topicDescription.trim()) { setGenError('Beskriv ämnet först'); return }
    setGenerating(true)
    setGenError('')
    try {
      const res = await fetch('/api/loops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicDescription.trim(), context: contextNotes.trim(), count }),
      })
      const payload = await res.json()
      if (payload.error) { setGenError(payload.error); return }
      setMessages(payload.messages || [])
      setActiveTab('Aktivera')
    } catch {
      setGenError('Nätverksfel, försök igen')
    } finally {
      setGenerating(false)
    }
  }

  async function createLoop() {
    if (!title.trim()) { setCreateError('Ge loopen ett namn'); return }
    if (messages.length === 0) { setCreateError('Generera meddelanden först'); return }
    if (recipients.length === 0) { setCreateError('Lägg till minst en mottagare'); return }

    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/loops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          topicDescription: topicDescription.trim(),
          contextNotes: contextNotes.trim(),
          messages,
          recipients,
        }),
      })
      const payload = await res.json()
      if (payload.error) { setCreateError(payload.error); return }
      router.push(`/dashboard/loopar/${payload.loopId}`)
    } catch {
      setCreateError('Nätverksfel, försök igen')
    } finally {
      setCreating(false)
    }
  }

  function updateMessage(index: number, field: keyof GeneratedMessage, value: string) {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const canGenerate = topicDescription.trim().length > 10
  const canActivate = messages.length > 0 && recipients.length > 0 && title.trim().length > 0

  return (
    <div style={{ padding: '40px 44px', maxWidth: 800, animation: 'fadeUp 0.35s ease both' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Ny loop
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-3)' }}>
          Skapa en uppföljningssekvens med AI-genererade mail.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 32 }}>
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab
          const isDone = (tab === 'Generera' && messages.length > 0) || (tab === 'Mottagare' && recipients.length > 0)
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                marginBottom: -1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: isActive ? 'var(--accent)' : isDone ? '#15803d' : 'var(--border)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? '✓' : i + 1}
              </span>
              {tab}
            </button>
          )
        })}
      </div>

      {/* Tab: Innehåll */}
      {activeTab === 'Innehåll' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <Field label="Loopens namn" hint="Internt namn, visas inte för mottagaren">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="t.ex. Uppföljning workshop hållbarhet"
              style={inputStyle}
            />
          </Field>
          <Field label="Ämne / vad levererades" hint="Beskriv vad utbildningen eller workshopen handlade om">
            <textarea
              value={topicDescription}
              onChange={e => setTopicDescription(e.target.value)}
              placeholder="t.ex. En halvdagsworkshop om systemtänkande för mellanchefer..."
              rows={4}
              style={inputStyle}
            />
          </Field>
          <Field label="Nyckelinsikter eller innehåll (valfritt)" hint="Klistra in punkter, sammanfattning eller egna anteckningar — AI:n använder detta">
            <textarea
              value={contextNotes}
              onChange={e => setContextNotes(e.target.value)}
              placeholder="• Fokus på feedbackloopar&#10;• Gruppen diskuterade motstånd till förändring&#10;..."
              rows={5}
              style={inputStyle}
            />
          </Field>
          <Field label="Antal mail i sekvensen" hint="3–8 mail rekommenderas">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {[3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: `1px solid ${count === n ? 'var(--accent)' : 'var(--border)'}`,
                    background: count === n ? 'var(--accent)' : 'transparent',
                    color: count === n ? '#fff' : 'var(--text-2)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setActiveTab('Mottagare')} style={primaryBtnStyle(false)}>
              Nästa: Mottagare →
            </button>
          </div>
        </div>
      )}

      {/* Tab: Mottagare */}
      {activeTab === 'Mottagare' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['evaluation', 'manual'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setImportMode(mode)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 20,
                  border: `1px solid ${importMode === mode ? 'var(--accent)' : 'var(--border)'}`,
                  background: importMode === mode ? 'var(--accent)' : 'transparent',
                  color: importMode === mode ? '#fff' : 'var(--text-3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mode === 'evaluation' ? 'Från utvärdering' : 'Manuell inmatning'}
              </button>
            ))}
          </div>

          {/* Evaluation import mode */}
          {importMode === 'evaluation' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {loadingEvals ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Laddar utvärderingar…</p>
              ) : evaluationsList.length === 0 ? (
                <div style={{ padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-3)' }}>
                  Inga utvärderingar med insamlade e-postadresser hittades. Byt till manuell inmatning.
                </div>
              ) : (
                <Field label="Välj utvärdering" hint="Visar utvärderingar där e-postinsamling var aktiverat">
                  <select
                    value={selectedEvalId}
                    onChange={e => {
                      setSelectedEvalId(e.target.value)
                      importFromEvaluation(e.target.value)
                    }}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— Välj utvärdering —</option>
                    {evaluationsList.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.label} · {ev.customer} ({ev.responseCount} svar)
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {loadingImport && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Importerar mottagare…</p>
              )}
              {importedRecipients.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {importedRecipients.length} mottagare importerade
                </div>
              )}
            </div>
          )}

          {/* Manual entry mode */}
          {importMode === 'manual' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Mottagare" hint="En per rad. Format: Namn <email>, Namn, email, eller bara email">
                <textarea
                  value={recipientText}
                  onChange={e => setRecipientText(e.target.value)}
                  placeholder="Anna Karlsson <anna@företag.se>&#10;björn@example.com&#10;Carin Svensson, carin@arbete.se"
                  rows={10}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
                />
              </Field>
              {parseRecipients(recipientText).length > 0 && (
                <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {parseRecipients(recipientText).length} mottagare identifierade
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setActiveTab('Innehåll')} style={ghostBtnStyle}>
              ← Tillbaka
            </button>
            <button onClick={() => setActiveTab('Generera')} style={primaryBtnStyle(false)}>
              Nästa: Generera →
            </button>
          </div>
        </div>
      )}

      {/* Tab: Generera */}
      {activeTab === 'Generera' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Klar att generera</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              <strong>{count} mail</strong> om "{topicDescription.slice(0, 60)}{topicDescription.length > 60 ? '…' : ''}"
            </p>
          </div>

          {genError && (
            <div style={{ padding: '10px 14px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
              {genError}
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                {messages.length} mail genererade — granska och redigera vid behov:
              </p>
              {messages.map((msg, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>
                    Mail {i + 1}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
                    <input
                      value={msg.subject}
                      onChange={e => updateMessage(i, 'subject', e.target.value)}
                      style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }}
                      placeholder="Ämnesrad"
                    />
                    <textarea
                      value={msg.bodyText}
                      onChange={e => updateMessage(i, 'bodyText', e.target.value)}
                      rows={4}
                      style={{ ...inputStyle, fontSize: 12, fontFamily: 'inherit' }}
                      placeholder="Innehåll"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('Mottagare')} style={ghostBtnStyle}>
              ← Tillbaka
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={generate}
                disabled={generating || !canGenerate}
                style={primaryBtnStyle(generating || !canGenerate)}
              >
                {generating ? 'Genererar…' : messages.length > 0 ? 'Generera om' : 'Generera med AI'}
              </button>
              {messages.length > 0 && (
                <button onClick={() => setActiveTab('Aktivera')} style={primaryBtnStyle(false)}>
                  Nästa: Aktivera →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Aktivera */}
      {activeTab === 'Aktivera' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gap: 8 }}>
            <SummaryRow label="Namn" value={title || '(inte angivet)'} warn={!title.trim()} />
            <SummaryRow label="Mail i sekvens" value={`${messages.length} stycken`} warn={messages.length === 0} />
            <SummaryRow label="Mottagare" value={`${recipients.length} stycken`} warn={recipients.length === 0} />
          </div>

          {(!title.trim() || messages.length === 0 || recipients.length === 0) && (
            <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
              Fyll i alla fält ovan innan du aktiverar.
            </div>
          )}

          {createError && (
            <div style={{ padding: '10px 14px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
              {createError}
            </div>
          )}

          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Loopen skapas med status <strong>aktiv</strong>. Du väljer själv när du skickar nästa steg via loopöversikten.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setActiveTab('Generera')} style={ghostBtnStyle}>
              ← Tillbaka
            </button>
            <button
              onClick={createLoop}
              disabled={creating || !canActivate}
              style={primaryBtnStyle(creating || !canActivate)}
            >
              {creating ? 'Skapar…' : 'Skapa och aktivera loop'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</label>
      {hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>{hint}</p>}
      {children}
    </div>
  )
}

function SummaryRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: warn ? '#b91c1c' : 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical',
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '9px 18px',
    background: disabled ? 'var(--border)' : 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-2)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}
