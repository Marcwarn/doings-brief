# Doings Brief — Agent Instructions

This file is read by Codex and other agents. It mirrors the intent of `CLAUDE.md`.

## What This Is

A Swedish consulting platform where clients submit voice or text briefs before engagements. Consultants manage sessions, evaluate responses, and export reports. Built on Next.js 14, Supabase, and Berget AI.

---

## Operating Principles

These principles govern how an agent should think when the situation is ambiguous, novel, or messy.

- **Imitate before inventing.** When extending an existing feature, page, or workflow, first reuse the established product pattern as literally as possible. Do not create a new UI, UX, or copy approach unless the user explicitly asks for a new direction.
- **Verify before claiming.** Do not say something is fixed, complete, matching, or verified unless the relevant evidence exists. Separate what was observed from what is inferred.
- **Protect the user's time.** Prefer doing the next reasonable check yourself before asking the user to retest. Do not send the user through repeated test loops when the environment is unstable or the agent has not verified the right thing.
- **Stabilize before iterating.** If the local environment is corrupted, stale, or inconsistent, treat that as a problem to solve first. Do not continue piling on edits or asking for more visual feedback from an untrusted runtime.
- **Be explicit about uncertainty.** If a visual, behavioral, or environment-level claim cannot be verified safely, state that clearly instead of filling the gap with confidence.

---

## Before You Build Anything

**Read these files first. Do not guess what exists.**

| File | What it contains |
|---|---|
| `docs/project_notes/current-handoff.md` | Current release handoff: where we are, what is blocked, what to do next |
| `docs/project_notes/release-owner-notes.md` | Active release scope, blockers, verification status |
| `app/CLAUDE.md` | Feature inventory — what is built per module, what is missing |
| `docs/project_notes/decisions.md` | Why architectural decisions were made |
| `docs/project_notes/bugs.md` | Known bugs and their solutions |
| `docs/project_notes/key_facts.md` | API URLs, auth patterns, design tokens, quirks |
| `docs/project_notes/issues.md` | Open technical debt |
| `docs/decisions/` | Formal ADRs (ADR-001 to ADR-005) |

---

## Source of Truth

GitHub `origin/main` is the source of truth for this repository.

- Do not assume the local checkout reflects the latest project state.
- Before planning or implementing work, verify `origin/main`.
- If local files differ from GitHub, use GitHub for instructions, feature inventory, and current project state.
- Treat local files as a working copy only.
- If syncing a local checkout is blocked, surface that explicitly and continue to read from GitHub.

---

## Required Workflow

Before making or proposing changes:

1. Read `AGENTS.md`, `docs/project_notes/current-handoff.md`, `docs/project_notes/release-owner-notes.md`, `CLAUDE.md`, `app/CLAUDE.md`, `app/api/CLAUDE.md`, `lib/CLAUDE.md`, and relevant `docs/project_notes/*`.
2. Verify the current GitHub state and do not rely on a stale local checkout.

Before pushing changes:

1. Ensure dependencies are installed locally if the relevant verification step requires them.
2. Run the most relevant verification step for the change, at minimum the nearest build, lint, or targeted test.
3. Do not describe the work as complete if verification was skipped or could not run.
4. If verification cannot run, stop and surface the blocker clearly before push.

## Verification Contract

Use precise language about what was actually verified.

- A green build means the code compiled. It does **not** by itself prove the feature works.
- A passing targeted test or smoke test verifies only the behavior it actually covers. Do not generalize beyond that scope.
- A visual or UX claim requires an actual rendered check in the relevant state. Code similarity or successful build output is not enough.
- If the relevant verification could not be run, say exactly what was blocked and what remains unverified.

## Failure Handling

When reality does not match expectations, do not keep repeating the same loop.

- If dev servers, local caches, or generated assets become unreliable, stop and stabilize the environment before asking the user to keep testing.
- Do not keep switching ports, runtimes, or entry points without a concrete reason and a clear explanation.
- If the user asks for an exact match to an existing page or workflow, treat deviations as regressions unless explicitly approved.
- After repeated failed attempts, change strategy. Do not keep applying the same fix pattern with different wording.

## User Time Protection

- Minimize avoidable manual retesting.
- Prefer one stable, verified path over multiple temporary workarounds.
- Before asking the user to inspect UI or behavior, confirm that the page actually renders and that the relevant code path is live.
- If trust has been damaged by incorrect claims or unstable verification, raise the bar for what you claim and narrow the scope of each next step.

## Definition of Done

A change is not done until:

- the current GitHub state was reviewed
- required instruction files were read
- relevant documentation was updated
- dependencies were installed if needed for verification
- relevant verification was run, or a blocker was explicitly surfaced before push

---

## Non-Negotiable Rules

1. **All user-facing strings in Swedish** — UI, error messages, email copy, labels.
2. **Never use the anon Supabase key for admin operations** — always use `getSupabaseAdminClient()` from `lib/server-clients.ts`.
3. **Never hardcode env vars** — use `process.env.VARIABLE_NAME`.
4. **Never create a `pages/` directory** — this project uses Next.js 14 App Router only.
5. **AI routes must export `maxDuration`** — 30s for chat, 60s for transcription.
6. **A task is not done until `app/CLAUDE.md` is updated** — if you added, changed, or removed a feature in `app/` or `lib/`, update the feature inventory before committing.

---

## Key Architecture

- **Auth**: Two Supabase clients — `getSupabaseRequestClient()` (anon, session verify) and `getSupabaseAdminClient()` (service role, DB writes)
- **Client access**: Token-based via `brief_sessions.token` UUID — no Supabase account needed
- **AI**: Berget AI (OpenAI-compatible) — KB-Whisper for transcription, Llama-3.3-70B for chat
- **Email**: Resend — single verified domain, `reply_to` set to consultant email
- **Styling**: Tailwind + glassmorphic CSS classes in `app/globals.css`

Full details in `CLAUDE.md` and `docs/architecture.md`.
