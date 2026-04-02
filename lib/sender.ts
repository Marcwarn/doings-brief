// sender.net integration
// Docs: https://api.sender.net/#introduction
// Auth: Bearer token in Authorization header

const SENDER_API_BASE = 'https://api.sender.net/v2'

function getSenderKey(): string {
  const key = process.env.SENDER_API_KEY
  if (!key) throw new Error('SENDER_API_KEY not configured')
  return key
}

export type SenderGroup = {
  id: string
  name: string
  subscriberCount?: number
}

/** Add (or update) a subscriber and assign them to a group. */
export async function addSubscriberToGroup(opts: {
  email: string
  firstname?: string
  groupId: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SENDER_API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getSenderKey()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: opts.email,
        firstname: opts.firstname || opts.email.split('@')[0],
        groups: [opts.groupId],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status))
      return { ok: false, error: `sender.net ${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** Create a new group in the sender.net account. Returns the group id, or null on failure. */
export async function createSenderGroup(name: string): Promise<{ id: string; name: string } | null> {
  try {
    const key = process.env.SENDER_API_KEY
    if (!key) return null
    const res = await fetch(`${SENDER_API_BASE}/groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ title: name }),
    })
    if (!res.ok) {
      console.error('sender.net create group failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    const g = data?.data ?? data
    return {
      id: String(g.id ?? g.hash ?? ''),
      name: String(g.title ?? g.name ?? name),
    }
  } catch (err) {
    console.error('sender.net create group error:', err)
    return null
  }
}

/** List all groups in the sender.net account. */
export async function listSenderGroups(): Promise<SenderGroup[]> {
  try {
    const res = await fetch(`${SENDER_API_BASE}/groups`, {
      headers: {
        'Authorization': `Bearer ${getSenderKey()}`,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    // sender.net wraps data in { data: [...] }
    const items: Array<Record<string, unknown>> = data?.data ?? data?.groups ?? []
    return items.map(g => ({
      id: String(g.id ?? g.hash ?? ''),
      name: String(g.title ?? g.name ?? g.id ?? ''),
      subscriberCount: typeof g.subscribers_count === 'number' ? g.subscribers_count : undefined,
    })).filter(g => g.id)
  } catch {
    return []
  }
}
