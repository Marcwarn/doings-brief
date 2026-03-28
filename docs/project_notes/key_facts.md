# Key Facts

Operational facts that are easy to forget and critical to get right.

## API & Infrastructure

- **Berget AI base URL**: `https://api.berget.ai/v1` (OpenAI-compatible)
- **Transcription model**: `KBLab/kb-whisper-large` (Swedish-optimized Whisper)
- **Chat model**: `meta-llama/Llama-3.3-70B-Instruct`
- **maxDuration**: 30s for AI chat routes, 60s for transcription (Vercel function limit)
- **Supabase URL**: configured via `NEXT_PUBLIC_SUPABASE_URL` env var (never hardcoded)
- **From email**: configured via `FROM_EMAIL` env var
- **Site URL**: `NEXT_PUBLIC_SITE_URL` — used in invite email links and auth redirects

## Auth & Access

- **Client access**: Token-based (UUID in `brief_sessions.token`), no Supabase account needed
- **Consultant access**: Supabase Auth session cookie, refreshed by middleware on every request
- **Admin access**: Supabase Auth + `role: 'admin'` in `profiles` table
- **PIN access**: `BRIEF_PIN_CODE` env var (4-digit code) → `/api/verify-pin` → HMAC token valid until midnight UTC
- **HMAC secret**: `NEXTAUTH_SECRET` (note: this project does not use NextAuth, the var is just a secret store)

## Language & Locale

- **Primary language**: Swedish (`lang="sv"` on root HTML element)
- **All UI strings in Swedish**: This includes JSON error messages returned to the browser
- **Date/time locale**: `sv-SE` where applicable

## Design Tokens

- **Primary brand**: `#6b2d82` (doings-purple) — headers, buttons, brand elements
- **Dark bg**: `#1e0e2e` (doings-purple-dark) — email gradients, dark surfaces
- **Accent/action**: `#C62368` (CSS `--accent`) — recording button, waveform, action highlights
- **Font**: Inter Variable (loaded via `next/font/local`) bound to `--font-sans` CSS var

## Testing

- **Test credentials**: Stored as GitHub Secrets (`DOINGS_BRIEF_TEST_EMAIL`, `DOINGS_BRIEF_TEST_PASSWORD`)
- **Test browser**: Chromium (Playwright headless)
- **Artifact output**: `output/playwright/` directory (gitignored, uploaded to GitHub Actions on failure)

## Known Quirks

- `lib/supabase.ts` has a `PRERENDER_SUPABASE_URL` placeholder for Next.js static prerendering — intentional, do not remove
- `tailwind.config.ts` declares `DM Sans` font but the actual loaded font is Inter Variable — known inconsistency, do not "fix" without design decision
- PIN token expires at midnight UTC (not 24h from issue) — day-granularity HMAC
- `brief_sessions.token` tokens have no expiry check in code — expiry is enforced by process
