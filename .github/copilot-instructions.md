# Doings Brief — Copilot Instructions

This file is read by GitHub Copilot. It mirrors the intent of `CLAUDE.md`.

## What This Is

A Swedish consulting platform where clients submit voice or text briefs before engagements. Consultants manage sessions, evaluate responses, and export reports. Built on Next.js 14, Supabase, and Berget AI.

---

## Before You Suggest or Build Anything

**Read these files first. Do not guess what exists.**

| File | What it contains |
|---|---|
| `app/CLAUDE.md` | Feature inventory — what is built per module, what is missing |
| `docs/project_notes/decisions.md` | Why architectural decisions were made |
| `docs/project_notes/bugs.md` | Known bugs and their solutions |
| `docs/project_notes/key_facts.md` | API URLs, auth patterns, design tokens, quirks |
| `docs/project_notes/issues.md` | Open technical debt |
| `docs/decisions/` | Formal ADRs (ADR-001 to ADR-005) |

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
