export const CUSTOMER_RECORD_PREFIX = 'customer_record:'

export type StoredCustomerRecord = {
  id: string
  label: string
  createdBy: string
  createdAt: string
}

export function getCustomerRecordKey(id: string) {
  return `${CUSTOMER_RECORD_PREFIX}${id}`
}

export function parseCustomerRecord(raw: string | null | undefined) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCustomerRecord>
    if (
      !parsed
      || typeof parsed.id !== 'string'
      || typeof parsed.label !== 'string'
      || typeof parsed.createdBy !== 'string'
      || typeof parsed.createdAt !== 'string'
    ) {
      return null
    }

    const label = parsed.label.trim()
    if (!label) return null

    return {
      id: parsed.id,
      label,
      createdBy: parsed.createdBy,
      createdAt: parsed.createdAt,
    } satisfies StoredCustomerRecord
  } catch {
    return null
  }
}

export function slugifyCustomer(value: string) {
  return value.trim().toLowerCase()
}
