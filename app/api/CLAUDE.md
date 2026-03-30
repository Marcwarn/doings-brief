# API Routes Context

This directory contains 14 API route groups. All routes are Next.js 14 App Router route handlers (`route.ts` files).

## Route Inventory

| Route | Auth | Purpose |
|---|---|---|
| `admin/bulk-template/` | Supabase session (admin) | Generate bulk invite template |
| `admin/invite/` | Supabase session (admin) | Admin: invite new consultant |
| `admin/users/` | Supabase session (admin) | Admin: list/manage users |
| `auth/` | None | Supabase auth callbacks |
| `brief-access/` | Supabase session | Check consultant access + return profile |
| `briefs/batches/` | Supabase session | CRUD for batch dispatches |
| `briefs/delete/` | Supabase session | Delete a brief session |
| `briefs/dispatches/` | Supabase session | CRUD for dispatch records |
| `discovery/analyze/` | Supabase session | Generate or fetch cached AI analysis for Discovery Data using fixed analysis lenses |
| `discovery/send/` | Supabase session | Create Discovery sessions and send token-based invite emails |
| `discovery/data/[id]/` | Supabase session | Aggregate Discovery response status, theme coverage, and raw-answer snippets for the internal Data tab |
| `discovery/remind/` | Supabase session | Send manual reminder emails for pending Discovery sessions |
| `discovery/sessions/` | Supabase session | List Discovery sessions owned by the consultant |
| `discovery/sessions/[id]/` | Supabase session | Read one Discovery session with grouped answers |
| `discovery/public/[token]/` | Token (no session) | Fetch public Discovery payload for one recipient |
| `discovery/submit/` | Token (no session) | Save Discovery answers, mark the session submitted, and notify the consultant by email |
| `discovery/templates/` | Supabase session | Create, update, and list Discovery templates |
| `discovery/templates/[id]/` | Supabase session | Fetch one full Discovery template with sections and questions |
| `briefs/recipients-template/` | Supabase session | Download recipients CSV template |
| `briefs/send-invite/` | Supabase session | Send invite email via Resend |
| `briefs/submit/` | Token (no session) | Client submits brief answers |
| `briefs/summarize/` | Supabase session | Generate AI summary via Berget |
| `customers/` | Supabase session | Customer record management |
| `evaluations/` | Supabase session | Evaluation form metadata |
| `generate-questions/` | None | AI-generated question suggestions |
| `send-brief-invite/` | Supabase session | Legacy invite route |
| `send-email/` | None | Legacy direct email (internal use only) |
| `submit-brief/` | Token (no session) | Legacy brief submission |
| `transcribe/` | None | Audio transcription via Berget KB-Whisper |
| `verify-pin/` | None | PIN → HMAC token generation |

## Auth Patterns Used

**Pattern 1 — Supabase session (consultant routes)**:
```typescript
import { getSupabaseRequestClient } from '@/lib/server-auth'

const supabase = getSupabaseRequestClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
```

**Pattern 2 — Token validation (public client routes)**:
Token is a UUID stored in `brief_sessions.token`. Validated by querying the DB directly — no session cookie required. Uses `getSupabaseAdminClient()` for the lookup.

**Pattern 3 — No auth (internal/AI routes)**:
`/api/transcribe`, `/api/generate-questions`, `/api/send-email` have no auth. They are called from controlled surfaces but are technically open. Do not store sensitive data in responses from these routes.

## Supabase Client Usage

- `getSupabaseRequestClient()` from `lib/server-auth.ts` → verify session, get user identity
- `getSupabaseAdminClient()` from `lib/server-clients.ts` → any privileged DB operation (bypasses RLS)

Never use `createClient()` (the browser client from `lib/supabase.ts`) in API routes.

## Discovery Template Contract Notes

`discovery_templates` now stores `audience_mode` on the template:

- `shared`
- `leaders`
- `mixed`

In v1 this is editorial metadata used by the builder and future template branching. It does not yet generate alternate question sets automatically.
