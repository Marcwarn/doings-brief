# Runbook: Adding a New API Route

## When to Use This

When adding a new `app/api/*/route.ts` file to the project.

## Checklist

### 1. Choose the right Supabase client

- Does the route need to verify a logged-in consultant? → Use `getSupabaseRequestClient()` from `lib/server-auth.ts`
- Does the route read/write data across users, or bypass RLS? → Use `getSupabaseAdminClient()` from `lib/server-clients.ts`
- Is the route called from the client-side without a session? → Validate via token in request body (see `/api/submit-brief` pattern)
- Never pass the service role key to client components

### 2. Auth check pattern (for protected routes)

```typescript
import { getSupabaseRequestClient } from '@/lib/server-auth'

const supabase = getSupabaseRequestClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
}
```

### 3. Error messages in Swedish

User-visible error strings must be in Swedish:
- `'Internt serverfel'` (500 errors)
- `'Obehörig'` (401)
- `'Otillräcklig behörighet'` (403)
- `'Hittades inte'` (404)

Internal logging (console.error) can be in English for developer readability.

### 4. Berget AI routes

If the route calls Berget AI (transcription or chat completions):
- Add `export const maxDuration = 30` (or `60` for transcription)
- Handle `!res.ok` with explicit error logging
- Validate the AI response before using it (Berget can return partial JSON on errors)

### 5. Email routes

If the route sends email:
- Use `getResendClient()` from `lib/server-clients.ts`
- Always check for `emailError` from `resend.emails.send()`
- Use `FROM_EMAIL` env var for the from address, never hardcode it
- Swedish subject lines and body text

### 6. File location

Name the directory to match the feature, not the HTTP method. Examples:
- `/api/briefs/summarize/route.ts` (not `/api/summarize-brief/route.ts`)
- `/api/customers/route.ts` (CRUD for customers)

### 7. Export pattern

```typescript
// Named export for HTTP method(s) only
export async function POST(req: NextRequest) { ... }
export async function GET() { ... }

// Optional: explicit dynamic if needed
export const dynamic = 'force-dynamic'

// Required for AI/long-running routes
export const maxDuration = 30
```

## Verification

After creating the route:
1. `npm run build` — checks for TypeScript errors
2. `npm run dev` — test the route with a local request
3. If the route involves auth: test with a logged-in consultant session and an unauthenticated request
