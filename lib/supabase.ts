import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PRERENDER_SUPABASE_URL = 'https://prerender-placeholder.supabase.co'
const PRERENDER_SUPABASE_ANON = 'prerender-placeholder-anon-key'

export function createClient() {
  if (typeof window === 'undefined') {
    // During Next prerender we only need a harmless placeholder client so pages can build.
    return createBrowserClient(
      SUPABASE_URL || PRERENDER_SUPABASE_URL,
      SUPABASE_ANON || PRERENDER_SUPABASE_ANON,
      { isSingleton: true }
    )
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }

  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON, { isSingleton: true })
}

// ── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string
  email: string
  full_name: string | null
  sender_email: string | null
  role: 'admin' | 'consultant'
  created_at: string
}

export type QuestionSet = {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Question = {
  id: string
  question_set_id: string
  text: string
  order_index: number
  created_at: string
}

export type BriefSession = {
  id: string
  consultant_id?: string
  consultant_email: string | null
  question_set_id: string | null
  client_name: string
  client_email: string
  client_organisation: string | null
  token: string
  status: 'pending' | 'submitted'
  created_at: string
  submitted_at: string | null
}

export type BriefResponse = {
  id: string
  session_id: string
  question_id: string | null
  question_text: string
  order_index: number
  response_type: 'voice' | 'text'
  text_content: string | null
  created_at: string
}

export type BriefAnswer = {
  id: string
  session_id: string
  answers: Array<{ label: string; question: string; answer: string }>
  submitted_at: string
}
