# Skill: Code Review

Review code changes in this Next.js 14 project for correctness, security, and adherence to project conventions.

## Usage

```
/code-review [file or description of change]
```

## Review Checklist

When reviewing any new or modified API route (`app/api/*/route.ts`):

### Auth & Security
- [ ] Protected routes call `getSupabaseRequestClient()` and check `supabase.auth.getUser()`
- [ ] Unauthorized responses return `{ error: 'Obehörig' }` with status 401 (Swedish)
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` values appear in client-side code
- [ ] Admin DB operations use `getSupabaseAdminClient()`, not the anon client
- [ ] Token-validated routes (public brief submission) validate against the database, not just token presence

### Email Routes
- [ ] Uses `getResendClient()` from `lib/server-clients.ts`
- [ ] `FROM_EMAIL` comes from `process.env.FROM_EMAIL`, not hardcoded
- [ ] Error from `resend.emails.send()` is handled and logged
- [ ] Subject line and body text are in Swedish

### AI Routes (Berget)
- [ ] `export const maxDuration = 30` (or `60` for transcription) is present
- [ ] `!res.ok` is handled with error logging
- [ ] AI response is validated/parsed before use (do not trust raw AI output)
- [ ] System prompt instructs model to respond in Swedish

### Swedish Language Rule
- [ ] All user-visible strings are in Swedish
- [ ] JSON error messages returned to the browser are in Swedish
- [ ] No English labels, headings, or button text in UI components

### Next.js 14 Patterns
- [ ] Server Components do not import client-only libraries or use `useState`/`useEffect`
- [ ] Client Components have `'use client'` directive at the top
- [ ] No `pages/` directory additions — App Router only
- [ ] `export const dynamic = 'force-dynamic'` is present where needed

### Environment Variables
- [ ] No hardcoded URLs, API keys, or secrets
- [ ] New env vars are documented in `.env.example`
- [ ] New required vars use the `requiredEnv()` pattern from `lib/server-clients.ts`

## Output Format

Provide feedback as:
1. **Blocking issues** (security, data loss, broken auth) — must fix before merge
2. **Warnings** (convention deviations, missing error handling) — should fix
3. **Suggestions** (improvements, refactors) — optional
