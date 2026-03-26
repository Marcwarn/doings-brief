import type { BriefSession } from '@/lib/supabase'

export const BRIEF_BATCH_KEY_PREFIX = 'brief_batch:'
export const BRIEF_BATCH_LOOKUP_PREFIX = 'brief_batch_lookup:'

export type BriefBatchMetadata = {
  batchId: string
  label: string
  organisation: string | null
  consultantId: string | null
  questionSetId: string | null
  sessionIds: string[]
  createdAt: string
}

export type BriefBatchLookupMap = Record<string, BriefBatchMetadata>

export type GroupedBriefSessions = {
  key: string
  label: string
  sublabel: string
  batchLabel: string | null
  sessions: BriefSession[]
  submittedCount: number
  pendingCount: number
  lastSentAt: string
}

export function getBatchSettingKey(batchId: string) {
  return `${BRIEF_BATCH_KEY_PREFIX}${batchId}`
}

export function getBatchLookupKey(sessionId: string) {
  return `${BRIEF_BATCH_LOOKUP_PREFIX}${sessionId}`
}

export function parseBatchMetadata(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as BriefBatchMetadata
    if (!parsed || !parsed.batchId || !Array.isArray(parsed.sessionIds)) {
      return null
    }

    return {
      batchId: parsed.batchId,
      label: parsed.label || 'Utskick',
      organisation: parsed.organisation || null,
      consultantId: parsed.consultantId || null,
      questionSetId: parsed.questionSetId || null,
      sessionIds: parsed.sessionIds,
      createdAt: parsed.createdAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function fallbackGroupKey(session: BriefSession) {
  const organisation = session.client_organisation?.trim().toLowerCase()
  if (organisation) return `org:${organisation}`
  return `session:${session.id}`
}

function fallbackGroupLabel(session: BriefSession) {
  return session.client_organisation?.trim() || session.client_name
}

export function groupBriefSessions(sessions: BriefSession[], batchLookup: BriefBatchLookupMap = {}) {
  const groups = new Map<string, GroupedBriefSessions>()

  for (const session of sessions) {
    const batch = batchLookup[session.id]
    const key = batch ? `batch:${batch.batchId}` : fallbackGroupKey(session)
    const label = batch?.organisation || fallbackGroupLabel(session)
    const sublabel = batch
      ? batch.label
      : (session.client_organisation?.trim() ? session.client_name : session.client_email)

    const existing = groups.get(key)
    if (existing) {
      existing.sessions.push(session)
      existing.submittedCount += session.status === 'submitted' ? 1 : 0
      existing.pendingCount += session.status === 'submitted' ? 0 : 1
      if (new Date(session.created_at) > new Date(existing.lastSentAt)) {
        existing.lastSentAt = session.created_at
      }
      continue
    }

    groups.set(key, {
      key,
      label,
      sublabel,
      batchLabel: batch?.label || null,
      sessions: [session],
      submittedCount: session.status === 'submitted' ? 1 : 0,
      pendingCount: session.status === 'submitted' ? 0 : 1,
      lastSentAt: session.created_at,
    })
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      sessions: group.sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      sublabel: group.batchLabel
        ? group.batchLabel
        : (
            group.sessions.length === 1
              ? (group.sessions[0].client_organisation?.trim() ? group.sessions[0].client_name : group.sessions[0].client_email)
              : `${group.sessions.length} respondenter`
          ),
    }))
    .sort((a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime())
}
