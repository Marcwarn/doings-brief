'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, type BriefSession, type BriefResponse } from '@/lib/supabase'

type BriefSummary = {
  summary: string
  keySignals: string[]
  risks: string[]
  followUpQuestions: string[]
  nextSteps: string[]
  basedOn: string[]
}

export default function BriefResponsesPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const sb = createClient()

  const [session, setSession]     = useState<BriefSession | null>(null)
  const [responses, setResponses] = useState<BriefResponse[]>([])
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summary, setSummary] = useState<BriefSummary | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('brief_sessions').select('*').eq('id', id).single(),
      sb.from('brief_responses').select('*').eq('session_id', id).order('order_index'),
    ]).then(([{ data: sess }, { data: resp }]) => {
      if (!sess) { router.replace('/dashboard/briefs'); return }
      setSession(sess); setResponses(resp || []); setLoading(false)
    })
  }, [id])

  async function exportAsWord() {
    if (!session || responses.length === 0 || exporting) return

    setExporting(true)
    setExportError(null)

    try {
      const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')

      const submittedLabel = session.submitted_at
        ? new Date(session.submitted_at).toLocaleDateString('sv-SE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Inte inskickad ännu'

      const doc = new Document({
        creator: 'Doings Brief',
        title: `${session.client_name} briefsvar`,
        description: `Inkommande briefsvar för ${session.client_name}`,
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: session.client_name,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.LEFT,
                spacing: { after: 220 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'E-post: ', bold: true }),
                  new TextRun(session.client_email),
                ],
                spacing: { after: 80 },
              }),
              ...(session.client_organisation
                ? [new Paragraph({
                    children: [
                      new TextRun({ text: 'Organisation: ', bold: true }),
                      new TextRun(session.client_organisation),
                    ],
                    spacing: { after: 80 },
                  })]
                : []),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Status: ', bold: true }),
                  new TextRun(session.status === 'submitted' ? 'Besvarad' : 'Inväntar'),
                ],
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Inskickad: ', bold: true }),
                  new TextRun(submittedLabel),
                ],
                spacing: { after: 240 },
              }),
              ...responses.flatMap((response, index) => {
                const answer = response.text_content?.trim() || 'Inget svar'
                const answerParagraphs = answer.split('\n').map(line => new Paragraph({
                  text: line || ' ',
                  spacing: { after: 80 },
                }))

                return [
                  new Paragraph({
                    text: `Fråga ${index + 1}`,
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 120, after: 120 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Typ: ', bold: true }),
                      new TextRun(response.response_type === 'voice' ? 'Röst' : 'Text'),
                    ],
                    spacing: { after: 80 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: response.question_text, bold: true })],
                    spacing: { after: 120 },
                  }),
                  ...answerParagraphs,
                ]
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      downloadBlob(blob, `${sanitizeFilename(session.client_name)}-brief.docx`)
    } catch (error) {
      console.error('DOCX export failed', error)
      setExportError('Kunde inte skapa Word-dokumentet.')
    } finally {
      setExporting(false)
    }
  }

  async function summarizeWithAi() {
    if (!session || responses.length === 0 || summarizing) return

    setSummarizing(true)
    setSummaryError(null)

    try {
      const response = await fetch('/api/briefs/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.summary) {
        setSummaryError(payload?.error || 'Kunde inte skapa AI-sammanfattningen.')
        return
      }

      setSummary(payload.summary)
    } catch {
      setSummaryError('Nätverksfel. Försök igen.')
    } finally {
      setSummarizing(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '40px 44px', maxWidth: 780, animation: 'fadeUp 0.35s ease both' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12.5 }}>
        <Link href="/dashboard/briefs" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Briefs</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{session?.client_name}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
            {session?.client_name}
          </h1>
          <Pill ok={session?.status === 'submitted'} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          {session?.client_email}
          {session?.submitted_at && (
            <> · Besvarad {new Date(session.submitted_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
      </div>

      {responses.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' }}>
            {session?.status === 'submitted' ? 'Inga svar hittades.' : 'Klienten har inte svarat ännu.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
          {responses.map((r, i) => (
            <div key={r.id} style={{ background: 'var(--surface)', padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: '#fff',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em', marginBottom: 6 }}>
                    {r.response_type === 'voice' ? 'Röst' : 'Text'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{r.question_text}</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 7, padding: '12px 16px', border: '1px solid var(--border-sub)' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {r.text_content || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Inget svar</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {responses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={exportAsWord}
              disabled={exporting}
              style={{
                padding: '9px 18px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13, fontWeight: 500, color: 'var(--text-2)',
                cursor: exporting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s',
                opacity: exporting ? 0.65 : 1,
              }}
              onMouseEnter={e => {
                if (!exporting) e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              {exporting ? 'Skapar Word-dokument...' : 'Ladda ner som Word'}
            </button>
            <button
              onClick={summarizeWithAi}
              disabled={summarizing}
              style={{
                padding: '9px 18px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13, fontWeight: 500, color: 'var(--text-2)',
                cursor: summarizing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s',
                opacity: summarizing ? 0.65 : 1,
              }}
              onMouseEnter={e => {
                if (!summarizing) e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              {summarizing ? 'Sammanfattar med AI...' : (summary ? 'Generera om AI-sammanfattning' : 'Sammanfatta med AI')}
            </button>
          </div>
          {exportError && (
            <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}>{exportError}</p>
          )}
          {summaryError && (
            <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c' }}>{summaryError}</p>
          )}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 28, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-sub)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.01em' }}>
              AI-sammanfattning
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
              Första versionen analyserar bara detta enskilda svar och markerar vad slutsatserna främst bygger på.
            </p>
          </div>

          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SummaryBlock title="Kort sammanfattning">
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7 }}>{summary.summary}</p>
            </SummaryBlock>
            <SummaryBlock title="Viktigaste signaler">
              <SummaryList items={summary.keySignals} emptyLabel="Inga tydliga signaler kunde sammanfattas." />
            </SummaryBlock>
            <SummaryBlock title="Risker eller oklarheter">
              <SummaryList items={summary.risks} emptyLabel="Inga särskilda risker eller oklarheter identifierades." />
            </SummaryBlock>
            <SummaryBlock title="Följdfrågor">
              <SummaryList items={summary.followUpQuestions} emptyLabel="Inga följdfrågor föreslogs." />
            </SummaryBlock>
            <SummaryBlock title="Rekommenderade nästa steg">
              <SummaryList items={summary.nextSteps} emptyLabel="Inga nästa steg föreslogs." />
            </SummaryBlock>
            <SummaryBlock title="Bygger främst på">
              <SummaryList items={summary.basedOn} emptyLabel="AI:n angav inget tydligt underlag." />
            </SummaryBlock>
          </div>
        </div>
      )}
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'briefsvar'
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.01em',
      background: ok ? '#f0fdf4' : '#f5f5f4',
      color: ok ? '#16a34a' : '#a8a29e',
      flexShrink: 0,
    }}>
      {ok ? 'Besvarad' : 'Inväntar'}
    </span>
  )
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.01em' }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function SummaryList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>{emptyLabel}</p>
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <li key={item} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  )
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
