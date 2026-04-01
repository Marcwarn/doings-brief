# System Architecture

## Overview

Doings Brief is a Next.js 14 full-stack application deployed on Vercel. It serves two distinct user groups:

- **Clients** (unauthenticated): Access a personal brief URL via email invite, submit voice or text answers
- **Consultants** (Supabase auth): Manage sessions, review responses, generate AI summaries, export reports
- **Admins** (Supabase auth + admin role): Manage consultant access, invite new users

The application has no separate backend service — all server logic runs as Next.js API routes (Serverless functions on Vercel).

---

## System Diagram

```
Client Browser ──── /brief/[token] ──────────────────────────────┐
                                                                   │
                         ┌─────────────────────────────────────┐  │
                         │         Next.js 14 (Vercel)         │  │
                         │                                      │  │
Consultant Browser ──── /dashboard/* ──► App Router (RSC)       │  │
Admin Browser ──────── /admin/*                                  │  │
                         │                                      │  │
                         │  API Routes (/app/api/*)             │  │
                         │  ├── transcribe ──────────────────── │──┤──► Berget AI
                         │  ├── briefs/summarize ────────────── │──┤──► (Llama-3.3-70B)
                         │  ├── generate-questions ──────────── │──┘
                         │  ├── send-brief-invite ─────────────────────► Resend
                         │  ├── send-email ─────────────────────────────► Resend
                         │  └── [other routes] ──────────────────────► Supabase
                         │                                      │
                         └─────────────────────────────────────┘
                                          │
                                          ▼
                                    Supabase (BaaS)
                                    ├── Auth (JWT sessions)
                                    ├── PostgreSQL (RLS enabled)
                                    └── Storage (not currently used)
```

---

## Request Flow: Consultant Dashboard

1. Browser loads `/dashboard` — Next.js middleware runs `supabase.auth.getUser()` to refresh session cookies
2. Server Component reads cookies via `getSupabaseRequestClient()` to verify the session
3. For data queries crossing RLS boundaries, the component calls an API route which uses `getSupabaseAdminClient()`
4. Client Components (marked `'use client'`) use the browser `createClient()` for interactive state

## Request Flow: Client Brief Submission

1. Consultant creates a `brief_session` — server generates a UUID `token`, stores it in the DB
2. Invite email is sent via `/api/briefs/send-invite` with a link to `/brief/{token}`
3. Client opens the URL — the `[token]` page segment is a public Next.js page, no auth required
4. Client optionally records audio → the page POSTs to `/api/transcribe` (no auth, token checked client-side)
5. On submission, the page POSTs to `/api/submit-brief` with the token — the API validates the token against `brief_sessions` and writes to `brief_responses`

## Request Flow: AI Summarization

1. Consultant clicks "Sammanfatta med AI" on a brief response page
2. Dashboard page POSTs `{ sessionId }` to `/api/briefs/summarize`
3. API route verifies the consultant's Supabase session (`getSupabaseRequestClient()`)
4. Uses admin client to read all `brief_responses` for the session
5. Sends structured Swedish prompt to Berget AI `chat/completions` (Llama-3.3-70B)
6. Parses and validates the JSON response against `BriefSummaryPayload` schema
7. Caches the result in the `settings` table under key `brief_summary:{sessionId}`
8. Returns cached result on subsequent requests (unless `regenerate: true`)

---

## Data Storage Patterns

### Supabase Tables (normalized)

Used for entities that need querying, filtering, and relational joins: `profiles`, `question_sets`, `questions`, `brief_sessions`, `brief_responses`.

### Settings Table (key-value)

Used as a flexible metadata store for derived or operational data. Key prefixes define the data type:

| Prefix | Content |
|---|---|
| `brief_summary:` | Cached AI summary JSON for a session |
| `brief_batch:` | Batch dispatch metadata (multi-recipient sends) |
| `brief_batch_lookup:` | Reverse index: sessionId → batchId |
| `brief_dispatch:` | Dispatch metadata (newer naming) |
| `brief_dispatch_lookup:` | Reverse index: sessionId → dispatchId |
| `brief_access:` | Consultant access grant records |

Customer and evaluation metadata use their own prefixes — see `lib/customers.ts` and `lib/evaluations.ts`.

---

## Deployment

- **Platform**: Vercel (Hobby or Pro tier)
- **Environment**: Env vars set in Vercel Dashboard → Settings → Environment Variables
- **CI**: GitHub Actions — 3 Playwright smoke tests run on push to `main` and on `workflow_dispatch`
- **No dedicated staging environment**: Vercel preview deploys serve as staging; smoke tests point to `DOINGS_BRIEF_BASE_URL` stored as a GitHub Secret

---

## Third-Party Services

| Service | Purpose | Auth |
|---|---|---|
| Supabase | Database, Auth | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Berget AI | Transcription (KB-Whisper) + current text generation routes | `BERGET_API_KEY` |
| OpenAI | Planned future Discovery analysis provider | `OPENAI_API_KEY` |
| Anthropic | Discovery analysis provider when configured | `ANTHROPIC_API_KEY` |
| Resend | Transactional email | `RESEND_API_KEY` |
| Vercel | Hosting + serverless functions | Deployment config |
| GitHub Actions | CI smoke tests | GitHub Secrets |
