# lib/ — Shared Utilities

Server-side utility modules shared across API routes and Server Components.

## Files

### `supabase.ts` — Browser Client + Shared Types

- `createClient()` — browser Supabase client (singleton, safe for client components)
- TypeScript types for all DB entities: `Profile`, `QuestionSet`, `Question`, `BriefSession`, `BriefResponse`, `BriefAnswer`
- Contains a `PRERENDER_SUPABASE_URL` placeholder for Next.js static prerendering — do not remove

### `server-auth.ts` — SSR Session Client

- `getSupabaseRequestClient()` — creates a Supabase client using the anon key + cookie store
- Use this in API routes when you need to verify the current user's session
- Uses `@supabase/ssr` with `cookies()` from `next/headers`

### `server-clients.ts` — Privileged Clients

- `getSupabaseAdminClient()` — service role key, bypasses RLS — use for admin operations
- `getSupabaseAnonClient()` — anon key without cookies — use for server-side public queries
- `getResendClient()` — Resend SDK instance for sending email
- All three use `requiredEnv()` which throws if the env var is missing

### `brief-access.ts` — Consultant Access Control

- `hasBriefAccess(admin, userId)` — checks if a user has been granted brief access
- Two checks: explicit `brief_access:` settings record, or inferred from having existing data
- `listBriefAccessRecords()` — all explicit access grants
- `listInferredBriefUserIds()` — users with data who don't have explicit grants

### `brief-batches.ts` — Batch/Dispatch/Summary Logic

The most complex lib module. Covers:
- Type definitions: `BriefDispatchMetadata`, `BriefBatchMetadata`, `BriefSummaryPayload`, `GroupedBriefSessions`, `CustomerSummary`
- Key generator functions: `getBatchSettingKey()`, `getDispatchSettingKey()`, `getBriefSummaryKey()`, etc.
- Parsers: `parseDispatchMetadata()`, `parseBriefSummaryPayload()`, `parseStoredBriefSummary()`
- Grouping: `groupBriefSessions()` — groups sessions by batch/dispatch or org, `groupCustomers()` — aggregates to customer level

### `customers.ts` — Customer Records

- `CUSTOMER_RECORD_PREFIX` — key prefix for settings table
- `parseCustomerRecord()` — typed parser for customer JSON values

### `evaluations.ts` — Evaluation Metadata

- `EVALUATION_KEY_PREFIX` — key prefix for settings table
- `parseEvaluationMetadata()` — typed parser for evaluation JSON values

## Import Convention

Always use the `@/lib/` path alias:
```typescript
import { getSupabaseAdminClient } from '@/lib/server-clients'
import { groupBriefSessions } from '@/lib/brief-batches'
```

Never use relative imports (`../../lib/...`) from within `app/`.
