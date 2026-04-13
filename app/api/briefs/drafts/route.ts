import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  BRIEF_DRAFT_KEY_PREFIX,
  BriefDraftMetadata,
  getBriefDraftKey,
  parseBriefDraftMetadata,
} from '@/lib/brief-drafts'

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: rows, error } = await admin
      .from('settings')
      .select('key, value')
      .like('key', `${BRIEF_DRAFT_KEY_PREFIX}%`)

    if (error) {
      return NextResponse.json({ error: 'Kunde inte läsa utkast.' }, { status: 500 })
    }

    const drafts = (rows || [])
      .map(row => parseBriefDraftMetadata(row.value))
      .filter((value): value is BriefDraftMetadata => Boolean(value))
      .filter(item => item.createdBy === user.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('brief drafts list error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Ogiltig payload.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const draftId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID()
    const now = new Date().toISOString()

    const existing = typeof body.id === 'string' && body.id.trim()
      ? await admin.from('settings').select('value').eq('key', getBriefDraftKey(draftId)).single()
      : { data: null }

    const existingDraft = parseBriefDraftMetadata(existing.data?.value)
    if (existingDraft && existingDraft.createdBy !== user.id) {
      return NextResponse.json({ error: 'Åtkomst nekad.' }, { status: 403 })
    }

    const label = typeof body.label === 'string' && body.label.trim()
      ? body.label.trim()
      : (typeof body.organisation === 'string' && body.organisation.trim() ? `${body.organisation.trim()} · utkast` : 'Utkast')

    const customQuestions = Array.isArray(body.customQuestions)
      ? body.customQuestions
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const candidate = item as Record<string, unknown>
            const text = typeof candidate.text === 'string' ? candidate.text.trim() : ''
            if (!text) return null
            return { text }
          })
          .filter(Boolean)
      : []

    const metadata: BriefDraftMetadata = {
      id: draftId,
      label,
      organisation: typeof body.organisation === 'string' ? body.organisation.trim() : '',
      introTitle: typeof body.introTitle === 'string' ? body.introTitle : 'Några korta frågor',
      introText: typeof body.introText === 'string' ? body.introText : '',
      contextNote: typeof body.contextNote === 'string' ? body.contextNote : '',
      selectedSet: typeof body.selectedSet === 'string' && body.selectedSet.trim() ? body.selectedSet.trim() : null,
      customSetName: typeof body.customSetName === 'string' ? body.customSetName : '',
      customQuestions,
      recipientsInput: typeof body.recipientsInput === 'string' ? body.recipientsInput : '',
      activeTab: body.activeTab === 'questions' || body.activeTab === 'send' ? body.activeTab : 'setup',
      activePreviewQuestionIndex: typeof body.activePreviewQuestionIndex === 'number' ? body.activePreviewQuestionIndex : 0,
      createdBy: existingDraft?.createdBy || user.id,
      createdAt: existingDraft?.createdAt || now,
      updatedAt: now,
      status: 'draft',
    }

    const { error } = await admin
      .from('settings')
      .upsert({
        key: getBriefDraftKey(draftId),
        value: JSON.stringify(metadata),
        updated_at: now,
      })

    if (error) {
      return NextResponse.json({ error: 'Kunde inte spara utkastet.' }, { status: 500 })
    }

    return NextResponse.json({ draft: metadata })
  } catch (error) {
    console.error('brief draft save error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
