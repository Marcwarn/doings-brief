# Runbook: Database Migrations

## Overview

There is no migration framework (Flyway, Drizzle, Prisma migrate) configured in this project. Schema changes are applied in Supabase, but the SQL files should still be versioned in the repo under `supabase/migrations/` for reviewability and history.

When adding or changing schema:

1. add a reviewed SQL file under `supabase/migrations/`
2. apply the SQL via Supabase Dashboard SQL editor or Supabase CLI
3. update `lib/supabase.ts`
4. update docs if the feature inventory or architecture changed

## Current Schema Source of Truth

The TypeScript types in `lib/supabase.ts` define the shape of database tables as used by the application, but SQL in `supabase/migrations/` is the reviewable change log for schema evolution.

Current application-level table types:

- `Profile` → `profiles` table
- `QuestionSet` → `question_sets` table
- `Question` → `questions` table
- `BriefSession` → `brief_sessions` table
- `BriefResponse` → `brief_responses` table
- `DiscoveryTemplate` → `discovery_templates` table
- `DiscoverySection` → `discovery_sections` table
- `DiscoveryQuestion` → `discovery_questions` table
- `DiscoveryQuestionOption` → `discovery_question_options` table
- `DiscoverySession` → `discovery_sessions` table
- `DiscoveryResponse` → `discovery_responses` table
- `DiscoveryResponseOption` → `discovery_response_options` table

The `settings` table is a key-value store (`key TEXT, value TEXT`) — it has no TypeScript type because it's schemaless by design.

Recent Discovery column additions:

- `discovery_templates.audience_mode` with allowed values `shared`, `leaders`, `mixed`

## Adding a New Column

1. Add the column in Supabase Dashboard → Table Editor (or via SQL editor)
2. If the column is nullable, existing rows are unaffected
3. Update the TypeScript type in `lib/supabase.ts`
4. Update any API routes that select `*` — they will now receive the new column
5. Check RLS policies if the new column contains sensitive data

## Adding a New Table

1. Add a SQL migration file under `supabase/migrations/`
2. Apply it in Supabase Dashboard or via Supabase CLI
2. Set up RLS: enable RLS on the table, add appropriate policies
3. If consultants should only see their own rows: add a policy like `auth.uid() = user_id`
4. If admin routes need full access: admin client bypasses RLS (service role key)
5. Add the TypeScript type to `lib/supabase.ts`

## The Settings Table Pattern

For ad-hoc metadata that doesn't justify a new table, use the `settings` key-value store:

```sql
-- Already exists, schema is:
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Add a new key prefix constant in the relevant `lib/*.ts` file (follow the pattern in `lib/brief-batches.ts`).

## RLS Caution

- Always test RLS policies with both the anon key and the service role key
- The anon key respects RLS — a query returning 0 rows may be a permissions issue, not a missing record
- Use `getSupabaseAdminClient()` (service role) when you need to confirm a record exists, not just whether the current user can see it
- Never disable RLS on tables containing consultant or client data

## No Automated Backups Configured

Point-in-time recovery depends on the Supabase project tier. The free tier does not include PITR. Verify the backup situation before any destructive migration.
