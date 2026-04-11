# Project Decisions Log

Running log of significant decisions made during development. For formal architectural decisions, see `docs/decisions/ADR-*.md`.

## 2026-03-29 — Discovery Will Be Spec-First and Separate from Brief

- `Discovery` is treated as a separate product format, not as a UI variation of `Brief`
- implementation should start from a written spec and explicit data model rather than incremental ad hoc reuse of `brief_*` tables
- the intended shape is a dedicated `discovery_*` table family with its own public route, send flow, response flow, and dashboard views
- reuse platform patterns where safe: token access, consultant auth, invite mechanics, and reminders

## 2026-03-29 — Discovery Questions Must Handle Mixed Audiences

- `Discovery` cannot assume a single respondent type
- some sends target only leaders, some only employees, some full teams, and some mixed groups
- the default editorial strategy is therefore audience-neutral question wording
- only themes with clear hierarchy-sensitive perspective shifts should later get dedicated variants
- first candidates for variants are `Ledarskap`, `Change management`, `AI readiness`, and `Vision & mål`

## 2026-03-30 — Discovery Should Get a Dedicated Data Tab

- `Discovery` should not stop at collecting responses; it should support interpretation inside the same workspace
- the editor flow is intended to become `Frågor`, `Upplägg`, `Skicka`, `Data`
- `Data` should be a consultant-facing interpretation layer, not a raw export screen
- the first version should combine response overview, theme summaries, raw-answer drill-down, and a small set of fixed AI analysis lenses
- arbitrary prompt writing is intentionally out of scope for the first implementation; analysis should start from named, opinionated lenses

## 2026-03-30 — Discovery Data Must Handle High Response Volume

- `Data` should be designed to work for tens or hundreds of responses, not only for a handful
- the interface should lead with filters, aggregation, and theme-level signal before raw answers
- a flat list of all responses should not be the default entry point
- theme detail views and drill-down should carry more weight than generic tables

## 2026-03-30 — Discovery AI Analysis Must Be Opinionated and Structured

- AI analysis in `Discovery` should start from fixed named lenses, not free-form prompting
- every analysis must distinguish between observations, differences, uncertainties, and next-step questions
- AI output should be returned as structured JSON rather than free text
- sparse datasets must produce visibly cautious analysis rather than generic overconfidence
- the UI must keep AI interpretation close to raw-answer evidence

## 2026-03-30 — Discovery AI Must Prefer Caution Over Coverage

- `Discovery` analysis should rather say too little than too much
- thin response sets should not produce a polished full analysis
- every important observation should carry explicit evidence from the current scope
- unsupported synthesis should be downgraded into uncertainty or omitted entirely

## 2026-03-30 — Discovery Should Be Ready for OpenAI or Anthropic in Vercel

- `Discovery` should expose whether current and future AI providers are configured, so the UI can reflect real readiness instead of guessing
- future provider keys should live in Vercel env vars under `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`
- preparation for those providers should not leak secrets to the client; only server routes may read them

## 2026-03-30 — Discovery Should Prefer Anthropic When It Is Configured

- once `ANTHROPIC_API_KEY` exists in Vercel, `Discovery` analysis should use Anthropic as its active provider
- the UI should reflect that Anthropic is active, not just available
- Berget remains in place for older AI surfaces until they are migrated separately

## 2026-03-30 — Discovery Data Should Be Customer-First and Support Anonymous Mode

- `Discovery Data` should start from customer or organisation, not from a flat list of people
- person-level drill-down is secondary and should appear only after a customer has been selected
- `Discovery` should support explicit `named` and `anonymous` send modes
- anonymous mode should be treated as a real product mode, not as a hidden workaround
- data views and AI analysis must respect whether the underlying responses are named or anonymous

## 2026-03-30 — Brief Should Move Toward a Lighter Split Workspace

- `Brief` should adopt the same broad internal logic as `Discovery`: internal editing on the left and recipient preview on the right
- the goal is consistency in how sendable experiences are built, not identical complexity across all formats
- `Brief` should stay lighter and more direct than `Discovery`, with a smaller header and fewer builder concepts
- the main candidate for this redesign is `/dashboard/send`
- `Utvärdering` should not be forced into the same shape until its own workflow is specified more clearly

## 2026-04-11 — Evaluation Should Be the Hub for Post-Training Follow-Up

- `Utvärdering` is not only a feedback form; it is the intake point for post-training follow-up
- sender.net should remain an infrastructure layer, not the main user-facing workflow
- the consultant experience should stay inside Doings Brief: collect participants, define a few follow-up steps, and review what has been sent
- follow-up should support two audience levels:
  - a customer-specific group for the exact training cohort
  - a global training-participants group for broader future outreach
- the concrete implementation direction is documented in `docs/specs/evaluation-followup.md`

## 2026-03-30 — Next.js Was Upgraded to a Patched 14.2.x Release

- the app was upgraded from `next@14.2.5` to `next@14.2.35`
- the reason was multiple advisories, including critical middleware and authorization issues in the older version
- the upgrade stayed within the same minor line and passed `npm run build`
- dependency risk remains in `xlsx`, which should be handled separately rather than mixed into the Next.js security upgrade

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
