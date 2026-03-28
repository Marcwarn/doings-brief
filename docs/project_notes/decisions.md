# Project Decisions Log

Running log of significant decisions made during development. For formal architectural decisions, see `docs/decisions/ADR-*.md`.

## 2024 — Initial Architecture

- **Chose Next.js 14 App Router** over Pages Router for better server/client component control and co-located API routes
- **Chose Supabase** over Firebase (RLS is more powerful than Firestore rules for multi-tenant consultant data) and over custom PostgreSQL (auth integration simplicity)
- **Chose Berget AI** over OpenAI for Swedish language quality (KB-Whisper) and EU data residency
- **No ORM**: Using Supabase JS client directly rather than Prisma or Drizzle — the PostgREST query builder is sufficient for current query complexity
- **No state management library**: React Server Components + `useState`/`useEffect` in client components is sufficient; no Redux or Zustand
- **No unit test framework** beyond Playwright smoke tests: Unit tests were deferred — the surface area is primarily I/O (DB queries, API calls) that is difficult to unit test without extensive mocking

## Settings Table as Key-Value Store

Decision to use the `settings` table (key-value) rather than dedicated tables for batch metadata, AI summaries, and access records. Rationale: avoids schema migrations for experimental features. The trade-off is that queries cannot be indexed efficiently — this is acceptable at current scale.

## Email: Verified Domain + Reply-To Pattern

Decision to send all emails from a single verified domain with `reply_to` set to the consultant's email. Alternative was allowing consultants to send from their own domains (requires per-consultant domain verification in Resend — too complex for the current user base size).

## No Dedicated Staging Environment

Decision to use Vercel preview deploys as the staging environment. Smoke tests run against the production URL. Rationale: the team is small enough that staging overhead outweighs its benefits.
