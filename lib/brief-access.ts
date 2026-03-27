import { SupabaseClient } from '@supabase/supabase-js'
import { CUSTOMER_RECORD_PREFIX, parseCustomerRecord } from '@/lib/customers'
import { EVALUATION_KEY_PREFIX, parseEvaluationMetadata } from '@/lib/evaluations'

export const BRIEF_ACCESS_PREFIX = 'brief_access:'

export type BriefAccessRecord = {
  userId: string
  email: string
  enabled: boolean
  createdAt: string
  createdBy: string
}

export function getBriefAccessKey(userId: string) {
  return `${BRIEF_ACCESS_PREFIX}${userId}`
}

export function parseBriefAccessRecord(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<BriefAccessRecord>
    if (
      !parsed
      || typeof parsed.userId !== 'string'
      || typeof parsed.email !== 'string'
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.createdBy !== 'string'
    ) {
      return null
    }

    return {
      userId: parsed.userId,
      email: parsed.email.trim().toLowerCase(),
      enabled: parsed.enabled !== false,
      createdAt: parsed.createdAt,
      createdBy: parsed.createdBy,
    } satisfies BriefAccessRecord
  } catch {
    return null
  }
}

export async function listBriefAccessRecords(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('settings')
    .select('key, value')
    .like('key', `${BRIEF_ACCESS_PREFIX}%`)

  if (error) {
    throw error
  }

  return (data || [])
    .map(row => parseBriefAccessRecord(row.value))
    .filter((record): record is BriefAccessRecord => Boolean(record))
}

export async function listInferredBriefUserIds(admin: SupabaseClient) {
  const userIds = new Set<string>()

  const [{ data: questionSets }, { data: sessions }, { data: settingsRows }] = await Promise.all([
    admin.from('question_sets').select('user_id'),
    admin.from('brief_sessions').select('consultant_id'),
    admin.from('settings').select('key, value').or(`key.like.${CUSTOMER_RECORD_PREFIX}%,key.like.${EVALUATION_KEY_PREFIX}%`),
  ])

  for (const row of questionSets || []) {
    if (typeof row.user_id === 'string' && row.user_id) userIds.add(row.user_id)
  }

  for (const row of sessions || []) {
    if (typeof row.consultant_id === 'string' && row.consultant_id) userIds.add(row.consultant_id)
  }

  for (const row of settingsRows || []) {
    if (typeof row.key !== 'string') continue
    if (row.key.startsWith(CUSTOMER_RECORD_PREFIX)) {
      const customer = parseCustomerRecord(row.value)
      if (customer?.createdBy) userIds.add(customer.createdBy)
      continue
    }
    if (row.key.startsWith(EVALUATION_KEY_PREFIX)) {
      const evaluation = parseEvaluationMetadata(row.value)
      if (evaluation?.createdBy) userIds.add(evaluation.createdBy)
    }
  }

  return userIds
}

export async function hasBriefAccess(admin: SupabaseClient, userId: string) {
  const records = await listBriefAccessRecords(admin)
  const record = records.find(candidate => candidate.userId === userId)
  if (record) return record.enabled !== false

  const inferred = await listInferredBriefUserIds(admin)
  return inferred.has(userId)
}
