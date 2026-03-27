import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import {
  CUSTOMER_RECORD_PREFIX,
  getCustomerRecordKey,
  parseCustomerRecord,
  slugifyCustomer,
} from '@/lib/customers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error } = await admin
      .from('settings')
      .select('key, value')
      .like('key', `${CUSTOMER_RECORD_PREFIX}%`)

    if (error) {
      return NextResponse.json({ error: 'Kunde inte läsa kunder.' }, { status: 500 })
    }

    const customers = (rows || [])
      .map(row => parseCustomerRecord(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => a.label.localeCompare(b.label, 'sv'))

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('customer list error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { label } = await req.json()
    const normalizedLabel = typeof label === 'string' ? label.trim() : ''

    if (!normalizedLabel) {
      return NextResponse.json({ error: 'Kundnamn krävs.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingRows, error: existingError } = await admin
      .from('settings')
      .select('key, value')
      .like('key', `${CUSTOMER_RECORD_PREFIX}%`)

    if (existingError) {
      return NextResponse.json({ error: 'Kunde inte verifiera kunden.' }, { status: 500 })
    }

    const existing = (existingRows || [])
      .map(row => parseCustomerRecord(row.value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .find(item => slugifyCustomer(item.label) === slugifyCustomer(normalizedLabel))

    if (existing) {
      return NextResponse.json({ customer: existing })
    }

    const customer = {
      id: randomUUID(),
      label: normalizedLabel,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }

    const { error: upsertError } = await admin
      .from('settings')
      .upsert({
        key: getCustomerRecordKey(customer.id),
        value: JSON.stringify(customer),
        updated_at: customer.createdAt,
      })

    if (upsertError) {
      return NextResponse.json({ error: 'Kunde inte skapa kunden.' }, { status: 500 })
    }

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('customer create error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseRequestClient()
    const admin = getSupabaseAdminClient()
    const { id } = await req.json()
    const normalizedId = typeof id === 'string' ? id.trim() : ''

    if (!normalizedId) {
      return NextResponse.json({ error: 'Customer id krävs.' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await admin
      .from('settings')
      .delete()
      .eq('key', getCustomerRecordKey(normalizedId))

    if (error) {
      return NextResponse.json({ error: 'Kunde inte radera kunden.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('customer delete error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
