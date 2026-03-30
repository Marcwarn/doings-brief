import { NextResponse } from 'next/server'
import { getSupabaseRequestClient } from '@/lib/server-auth'
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { EVALUATION_QUESTION_META_PREFIX } from '@/lib/evaluations'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseRequestClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })

    const admin = getSupabaseAdminClient()

    const [{ data: questionSets, error: questionSetError }, { data: settingsRows, error: settingsError }] = await Promise.all([
      admin
        .from('question_sets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      admin
        .from('settings')
        .select('key')
        .like('key', `${EVALUATION_QUESTION_META_PREFIX}%`),
    ])

    if (questionSetError) {
      console.error('question-sets list error:', questionSetError)
      return NextResponse.json({ error: 'Kunde inte läsa frågebatterierna.' }, { status: 500 })
    }

    if (settingsError) {
      console.error('question-sets settings error:', settingsError)
      return NextResponse.json({ error: 'Kunde inte läsa frågebatterierna.' }, { status: 500 })
    }

    const evaluationQuestionSetIds = new Set(
      (settingsRows || [])
        .map(row => row.key.replace(EVALUATION_QUESTION_META_PREFIX, ''))
        .filter(Boolean),
    )

    const debriefQuestionSets = (questionSets || []).filter(set => !evaluationQuestionSetIds.has(set.id))

    return NextResponse.json({ questionSets: debriefQuestionSets })
  } catch (error) {
    console.error('question-sets route error:', error)
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
