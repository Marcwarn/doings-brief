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
| `discovery/templates/` | Supabase session | Create, update, and list Discovery templates |
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
