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
| `discovery/send/` | Supabase session | Create Discovery sessions and either send personal invite emails or generate a shareable anonymous link |
| `discovery/data/[id]/` | Supabase session | Aggregate Discovery response status, theme coverage, and raw-answer snippets for the internal Data tab |
| `discovery/remind/` | Supabase session | Send manual reminder emails for pending Discovery sessions |
| `discovery/sessions/` | Supabase session | List Discovery sessions owned by the consultant |
| `discovery/sessions/[id]/` | Supabase session | Read one Discovery session with grouped answers |
| `discovery/public/[token]/` | Token (no session) | Fetch public Discovery payload for one recipient or one shared anonymous Discovery link |
| `discovery/submit/` | Token (no session) | Save Discovery answers, create a submission entry, and notify the consultant by email |
| `discovery/templates/` | Supabase session | Create, update, and list Discovery templates |
| `discovery/templates/[id]/` | Supabase session | Fetch one full Discovery template with sections and questions |
| `briefs/recipients-template/` | Supabase session | Download recipients CSV template |
| `briefs/send-invite/` | Supabase session | Send invite email via Resend |
| `briefs/submit/` | Token (no session) | Client submits brief answers |
| `briefs/summarize/` | Supabase session | Generate AI summary via Berget |
| `customers/` | Supabase session | Customer record management |
| `evaluations/` | Supabase session | Evaluation form metadata |
| `evaluations/[id]/` | Supabase session | Read or delete one evaluation together with its stored responses and unused question setup |
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

## Discovery Response Mode Contract Notes

`discovery_sessions` now also carries `response_mode`:

- `named`
- `anonymous`

Named mode uses one personal link per recipient.

Anonymous mode uses one shared link and stores each answer set as a separate row in `discovery_submission_entries`, with optional demographic metadata such as role and team.

## Discovery Analysis Guardrails

`/api/discovery/analyze` is intentionally stricter than a generic summary endpoint.

- Full AI analysis should not run on very thin material. Under small response counts, the route returns a visibly preliminary reading instead of a confident synthesis.
- Observations and differences must be tied to explicit evidence references from the current response scope.
- Cached analysis should only be reused if it still validates against the current evidence catalogue for that scope.
- The API should favor omission over invention: unsupported conclusions should become uncertainties, not polished claims.
- The route also exposes a `GET` status endpoint so the Discovery UI can show whether current and future AI providers are configured in Vercel.
- When `ANTHROPIC_API_KEY` exists, `Discovery` analysis should prefer Anthropic as the active provider.
