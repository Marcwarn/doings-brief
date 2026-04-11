# Open Issues and Technical Debt

## High Priority

_(None currently documented)_

## Medium Priority

### No Brief Token Expiry Enforcement

The invite email implies links have a validity window but there is no expiry check in `/api/submit-brief`. A token remains valid indefinitely unless the session row is deleted or status is changed.
**Effort**: Small — add an `expires_at` column to `brief_sessions` and check it in the submit route.

### Reminder Flow Is Manual Only

Reminder email support exists, but it is manually triggered from the dashboard. There is no scheduler, retry policy, or overdue indicator.
**Effort**: Medium — add a scheduled job and a clearer reminder state model.

### Audio Upload Size Limit Not Enforced

`/api/transcribe` accepts any audio payload. Vercel has a 4.5MB request body limit for Serverless Functions. Large recordings will fail with a cryptic Vercel error, not a user-friendly message.
**Effort**: Medium — add client-side file size check before upload + server-side `Content-Length` check.

## Low Priority / Nice to Have

### TypeScript Types Not Generated from Supabase Schema

Types in `lib/supabase.ts` are hand-maintained. If the database schema changes, the types drift silently.
**Effort**: Medium — configure `supabase gen types typescript` in CI to regenerate types and fail on diff.

### Playwright Tests Not Isolated

Smoke tests use a shared production account and real production data. A test that creates a batch dispatch leaves real data behind.
**Effort**: Large — would require a dedicated test environment with seeded data and teardown.
