# ADR-001: Supabase as Database and Auth Provider

**Status**: Accepted
**Date**: 2024

## Context

The platform needs user authentication for consultants, a relational database for brief sessions and responses, and row-level access control so consultants only see their own data.

## Decision

Use Supabase (hosted PostgreSQL + Auth + PostgREST) instead of building a custom PostgreSQL setup with a separate auth service.

## Reasoning

- **Auth + RLS in one product**: Supabase Auth integrates directly with PostgreSQL Row Level Security. The `auth.uid()` function is available in RLS policies, eliminating the need for a separate auth middleware layer.
- **`@supabase/ssr` package**: Provides the exact SSR session-cookie pattern needed for Next.js App Router. The `middleware.ts` session refresh pattern comes directly from Supabase's official Next.js guide.
- **Service role escape hatch**: For admin operations that need to cross RLS boundaries (reading all consultants' sessions for the admin panel), the service role key bypasses RLS entirely. This is used explicitly via `getSupabaseAdminClient()` in `lib/server-clients.ts`.
- **Settings table as key-value store**: Supabase's schema flexibility allows using a single `settings` table as an operational key-value store for metadata (batch records, AI summaries, access grants) without schema migrations for every new data type.

## Consequences

- **Must maintain two client types**: The anon client (`lib/server-auth.ts`) for session verification, and the admin client (`lib/server-clients.ts`) for privileged operations. Mixing them up causes either security vulnerabilities (using service role in client code) or silent permission failures (using anon key for admin queries).
- **Prerender placeholder**: `lib/supabase.ts` contains a `PRERENDER_SUPABASE_URL` placeholder to allow Next.js static prerendering without live Supabase credentials. This is intentional — do not remove it.
- **No Supabase Realtime in use**: The current implementation uses polling/revalidation patterns, not Supabase's realtime websockets.
