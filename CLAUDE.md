# Doings Brief — Project Memory

## What This Is

A Swedish consulting platform where clients submit voice or text briefs before engagements. Consultants manage sessions, evaluate responses, and export reports. Built on Next.js 14, Supabase, and Berget AI.

**Language rule**: All UI text, error messages, email copy, and user-facing strings must be in Swedish. The HTML root element uses `lang="sv"`. Keep this invariant when adding any user-facing feature.

---

## Repository Map

```
doings-brief/
├── app/
│   ├── api/                  # 14 API route groups (see app/api/CLAUDE.md)
│   │   ├── admin/            # Admin: bulk-template, invite, users
│   │   ├── auth/             # Auth helpers
│   │   ├── brief-access/     # Consultant access gate (GET, auth-checked)
│   │   ├── briefs/           # Core brief CRUD + batch/dispatch/summarize
│   │   ├── customers/        # Customer record management
│   │   ├── evaluations/      # Evaluation form state
│   │   ├── generate-questions/ # Berget AI question generation
│   │   ├── send-brief-invite/ # Email invite via Resend
│   │   ├── send-email/       # Legacy direct email (no auth)
│   │   ├── submit-brief/     # Token-authenticated brief submission
│   │   ├── transcribe/       # KB-Whisper audio → text (Berget)
│   │   └── verify-pin/       # PIN-code token generation
│   ├── auth/                 # Supabase callback + password reset pages
│   ├── brief/[token]/        # Public client-facing brief UI (no login)
│   ├── dashboard/            # Consultant dashboard (Supabase auth required)
│   ├── evaluation/           # Public evaluation forms
│   ├── admin/                # Admin panel
│   └── login/
├── lib/                      # Shared utilities (see lib/CLAUDE.md)
│   ├── supabase.ts           # Browser client + shared TypeScript types
│   ├── server-auth.ts        # SSR cookie-aware client (anon key)
│   ├── server-clients.ts     # Admin client (service role) + Resend factory
│   ├── brief-access.ts       # Consultant access control logic
│   ├── brief-batches.ts      # Batch/dispatch/summary logic and grouping
│   ├── customers.ts          # Customer record parsing
│   └── evaluations.ts        # Evaluation metadata parsing
├── scripts/                  # Playwright smoke tests (.mjs, Node-only)
│   ├── test-ai-summary.mjs
│   ├── test-word-export.mjs
│   └── test-batch-send.mjs
├── middleware.ts             # Session refresh on every request
├── .env.example              # Canonical list of required env vars
└── docs/                     # Architecture docs, ADRs, runbooks, notes
```

---

## Commands

```bash
npm run dev               # Start dev server on http://localhost:3000
npm run build             # Production build (type-checks + Next compile)
npm run lint              # ESLint
npm run test:ai-summary   # Playwright smoke: AI summarization flow
npm run test:word-export  # Playwright smoke: Word/Excel export
npm run test:batch-send   # Playwright smoke: Batch invite send
```

Smoke tests require live secrets — run against staging, not locally, unless you have a `.env.local` with `DOINGS_BRIEF_*` vars pointing to a real deployment.

---

## Architecture Quick Reference

### Auth Pattern: Supabase SSR

Two distinct Supabase client factories — never mix them up:

| Factory | File | Key | Use When |
|---|---|---|---|
| `getSupabaseRequestClient()` | `lib/server-auth.ts` | ANON | Verify session, get user identity in API routes |
| `getSupabaseAdminClient()` | `lib/server-clients.ts` | SERVICE_ROLE | Any DB write, cross-user read, RLS bypass |
| `createClient()` | `lib/supabase.ts` | ANON | Browser-side client components only |

`middleware.ts` calls `supabase.auth.getUser()` on every request to refresh session cookies. This is the SSR session refresh pattern from `@supabase/ssr` — do not remove it.

### Token-Based Public Access (Client Briefs)

Clients do not create Supabase accounts. They access `/brief/[token]` using a `token` field on the `brief_sessions` table. The token is generated server-side as a UUID and sent in the invite email. The `/api/submit-brief` route validates the token directly against the database — no session cookie needed.

For admin/reporting routes that do not involve a client session, use `BRIEF_PIN_CODE` + `/api/verify-pin` to generate a 24h HMAC token.

### Email: Resend

All emails go through `getResendClient()` from `lib/server-clients.ts`. The `FROM_EMAIL` env var controls the sender address (must be a verified domain in Resend). For consultant-to-client emails, the `reply_to` field is set to the consultant's email so replies land in their inbox — the `from` address stays on the verified domain.

### AI: Berget AI (OpenAI-compatible)

Two Berget endpoints are in use:
- **Transcription**: `POST https://api.berget.ai/v1/audio/transcriptions` — model `KBLab/kb-whisper-large` (Swedish-optimized Whisper)
- **Chat completions**: `POST https://api.berget.ai/v1/chat/completions` — model `meta-llama/Llama-3.3-70B-Instruct`

All AI routes set `export const maxDuration = 30` (Vercel function limit). The transcription route uses `maxDuration = 60` because audio uploads can be large.

Berget responses are always in Swedish — the system prompts instruct the model to use Swedish exclusively.

### Styling: Glassmorphic + Custom Tokens

Design system lives in two places:
- `tailwind.config.ts` — `doings.purple`, `doings.purple-dark`, etc. (Tailwind classes)
- `app/globals.css` `:root` block — `--bg`, `--surface`, `--border`, `--text`, `--accent` (CSS variables)

Reusable CSS component classes: `.glass-card`, `.glass-header`, `.glass-btn-outline`, `.mic-btn`. These are defined in `globals.css` and used directly in JSX className attributes.

The font is Inter Variable (loaded via `next/font/local` bound to `--font-sans` CSS var). Note: `tailwind.config.ts` references `DM Sans` — this is a legacy config inconsistency; Inter is what actually loads.

---

## Hard Rules (Never Violate)

1. **Never touch `.env.local`** — that file is gitignored and holds real secrets. Reference `.env.example` for variable names.
2. **Admin DB operations must use `getSupabaseAdminClient()`** (service role key), never the anon key. The anon key is subject to RLS and will silently return no rows on admin queries.
3. **All user-facing strings in Swedish** — this includes error messages returned in JSON (`"Internt serverfel"`, unauthorized → `"Obehörig"` for UI-visible errors), labels, headings, and email copy.
4. **Never hardcode env vars** — use `process.env.VARIABLE_NAME` with the `requiredEnv()` pattern from `lib/server-clients.ts`.
5. **Vercel `maxDuration` cap** — AI and transcription routes must export `maxDuration`. Set to 30 for AI chat, 60 for transcription.
6. **Do not create a `pages/` directory** — this project uses the Next.js 14 App Router exclusively.

---

## Environment Variables Reference

See `.env.example` for the full list. Key variables:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only, never expose) |
| `BERGET_API_KEY` | Yes | Berget AI auth (transcription + summarization) |
| `RESEND_API_KEY` | Yes | Resend email service |
| `FROM_EMAIL` | Yes | Verified sender address |
| `NEXT_PUBLIC_SITE_URL` | Yes | Used in invite email links |
| `BRIEF_PIN_CODE` | Yes | 4-digit PIN for admin/reporting access |
| `NEXTAUTH_SECRET` | Yes | HMAC secret for PIN token generation |
| `DOINGS_BRIEF_*` | CI only | Playwright smoke test credentials (GitHub Secrets) |

---

## Database: Supabase

Key tables:

| Table | Purpose |
|---|---|
| `profiles` | Consultant accounts (role: `admin` or `consultant`) |
| `question_sets` | Reusable question collections per consultant |
| `questions` | Individual questions within a set |
| `brief_sessions` | One per client engagement (holds `token`, `status`) |
| `brief_responses` | Per-question answers (voice transcript or text) |
| `settings` | Key-value store for batch metadata, access records, AI summaries |

The `settings` table acts as a flexible metadata store. Batch dispatch records, brief access grants, AI summary cache, evaluation metadata, and customer records are all stored here as JSON values with structured key prefixes (e.g. `brief_summary:`, `brief_batch:`, `brief_access:`).

Row Level Security is enabled. Always use `getSupabaseAdminClient()` for operations that need to read across multiple users' data.

---

## Further Reading

- `docs/architecture.md` — system diagram, request flows, data storage patterns
- `docs/decisions/` — Architecture Decision Records (ADRs) for key technology choices
- `docs/runbooks/` — step-by-step guides for common development tasks
- `docs/project_notes/` — key facts, running decisions log, known bugs, open issues
- `app/api/CLAUDE.md` — per-route auth patterns and inventory
- `lib/CLAUDE.md` — what each shared utility module does
