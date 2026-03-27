import type { BriefSession } from '@/lib/supabase'

export const BRIEF_DISPATCH_KEY_PREFIX = 'brief_dispatch:'
export const BRIEF_DISPATCH_LOOKUP_PREFIX = 'brief_dispatch_lookup:'
export const BRIEF_BATCH_KEY_PREFIX = 'brief_batch:'
export const BRIEF_BATCH_LOOKUP_PREFIX = 'brief_batch_lookup:'
export const BRIEF_SUMMARY_KEY_PREFIX = 'brief_summary:'

export type BriefDispatchMetadata = {
  dispatchId: string
  label: string
  organisation: string | null
  consultantId: string | null
  questionSetId: string | null
  sessionIds: string[]
  createdAt: string
}

export type BriefBatchMetadata = BriefDispatchMetadata

export type BriefBatchLookupMap = Record<string, BriefBatchMetadata>

export type BriefSummaryPayload = {
  summary: string
  keySignals: string[]
  risks: string[]
  followUpQuestions: string[]
  nextSteps: string[]
  basedOn: string[]
}

export type StoredBriefSummary = {
  summary: BriefSummaryPayload
  updatedAt: string
}

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

export type CustomerSummary = {
  key: string
  label: string
  dispatchCount: number
  recipientCount: number
  submittedCount: number
  pendingCount: number
  lastSentAt: string
  latestDispatchId: string | null
}

export function getBatchSettingKey(batchId: string) {
  return `${BRIEF_BATCH_KEY_PREFIX}${batchId}`
}

export function getBatchLookupKey(sessionId: string) {
  return `${BRIEF_BATCH_LOOKUP_PREFIX}${sessionId}`
}

export function getDispatchSettingKey(dispatchId: string) {
  return `${BRIEF_DISPATCH_KEY_PREFIX}${dispatchId}`
}

export function getDispatchLookupKey(sessionId: string) {
  return `${BRIEF_DISPATCH_LOOKUP_PREFIX}${sessionId}`
}

export function getBriefSummaryKey(sessionId: string) {
  return `${BRIEF_SUMMARY_KEY_PREFIX}${sessionId}`
}

export function parseDispatchMetadata(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<BriefDispatchMetadata> & { batchId?: string }
    const dispatchId = typeof parsed?.dispatchId === 'string' && parsed.dispatchId
      ? parsed.dispatchId
      : (typeof parsed?.batchId === 'string' ? parsed.batchId : '')

    if (!parsed || !dispatchId || !Array.isArray(parsed.sessionIds)) {
      return null
    }

    return {
      dispatchId,
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

export function parseBatchMetadata(raw: string | null | undefined) {
  return parseDispatchMetadata(raw)
}

export function getDispatchIdFromLookupValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .slice(0, 6)
}

export function parseBriefSummaryPayload(value: unknown): BriefSummaryPayload | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : ''
  if (!summary) return null

  return {
    summary,
    keySignals: normalizeStringList(candidate.keySignals),
    risks: normalizeStringList(candidate.risks),
    followUpQuestions: normalizeStringList(candidate.followUpQuestions),
    nextSteps: normalizeStringList(candidate.nextSteps),
    basedOn: normalizeStringList(candidate.basedOn),
  }
}

export function parseStoredBriefSummary(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StoredBriefSummary
    const summary = parseBriefSummaryPayload(parsed?.summary)
    if (!summary) return null

    return {
      summary,
      updatedAt: parsed?.updatedAt || new Date().toISOString(),
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
    const dispatch = batchLookup[session.id]
    const key = dispatch ? `dispatch:${dispatch.dispatchId}` : fallbackGroupKey(session)
    const label = dispatch?.organisation || fallbackGroupLabel(session)
    const sublabel = dispatch
      ? dispatch.label
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
      batchLabel: dispatch?.label || null,
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

export function groupCustomers(groups: GroupedBriefSessions[], batchLookup: BriefBatchLookupMap = {}) {
  const customers = new Map<string, CustomerSummary>()

  for (const group of groups) {
    const firstSession = group.sessions[0]
    const rawKey = group.label.trim().toLowerCase()
    const customerKey = rawKey ? `customer:${rawKey}` : `customer:${group.key}`
    const dispatchId = firstSession ? (batchLookup[firstSession.id]?.dispatchId || null) : null

    const existing = customers.get(customerKey)
    if (existing) {
      existing.dispatchCount += 1
      existing.recipientCount += group.sessions.length
      existing.submittedCount += group.submittedCount
      existing.pendingCount += group.pendingCount
      if (new Date(group.lastSentAt) > new Date(existing.lastSentAt)) {
        existing.lastSentAt = group.lastSentAt
        existing.latestDispatchId = dispatchId
      }
      continue
    }

    customers.set(customerKey, {
      key: customerKey,
      label: group.label,
      dispatchCount: 1,
      recipientCount: group.sessions.length,
      submittedCount: group.submittedCount,
      pendingCount: group.pendingCount,
      lastSentAt: group.lastSentAt,
      latestDispatchId: dispatchId,
    })
  }

  return Array.from(customers.values())
    .sort((a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime())
}
