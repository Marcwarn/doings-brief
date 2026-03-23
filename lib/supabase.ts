import { createBrowserClient } from '@supabase/ssr'

export const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (for client components)
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON)
}

export type BriefSession = {
  id: string
  consultant_id: string
  client_name: string
  client_email: string
  token: string
  status: 'pending' | 'submitted'
  created_at: string
  submitted_at: string | null
}

export type BriefAnswer = {
  id: string
  session_id: string
  answers: Array<{ label: string; question: string; answer: string }>
  submitted_at: string
}
