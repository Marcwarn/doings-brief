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

export type DiscoveryTemplate = {
  id: string
  user_id: string
  name: string
  intro_title: string
  intro_text: string
  status: 'draft' | 'active'
  created_at: string
  updated_at: string
}

export type DiscoverySection = {
  id: string
  template_id: string
  label: string
  description: string
  order_index: number
  created_at: string
}

export type DiscoveryQuestion = {
  id: string
  section_id: string
  type: 'open' | 'choice' | 'scale'
  text: string
  order_index: number
  max_choices: number | null
  scale_min: number | null
  scale_max: number | null
  scale_min_label: string | null
  scale_max_label: string | null
  created_at: string
}

export type DiscoveryQuestionOption = {
  id: string
  question_id: string
  label: string
  order_index: number
}

export type DiscoverySession = {
  id: string
  consultant_id: string
  consultant_email: string | null
  template_id: string
  client_name: string
  client_email: string
  client_organisation: string | null
  token: string
  status: 'pending' | 'submitted'
  created_at: string
  submitted_at: string | null
}

export type DiscoveryResponse = {
  id: string
  session_id: string
  question_id: string
  response_type: 'open' | 'choice' | 'scale'
  text_value: string | null
  scale_value: number | null
  created_at: string
}

export type DiscoveryResponseOption = {
  id: string
  response_id: string
  option_label: string
}
