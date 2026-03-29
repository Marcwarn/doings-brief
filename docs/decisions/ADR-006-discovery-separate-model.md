# ADR-006: Discovery as a Separate Product Flow and Data Model

**Status**: Accepted
**Date**: 2026-03-29

## Context

The platform now supports three distinct consulting formats:

- `Brief`: short pre-engagement questions
- `Discovery`: deeper needs analysis before scoping or proposal work
- `Utvärdering`: post-session feedback for groups met in person

`Discovery` has already started to take shape as its own dashboard surface under `/dashboard/discovery`, with a split builder and customer preview experience.

The architectural question is whether `Discovery` should:

1. be implemented as a variant of `Brief` using the existing `brief_sessions` and `brief_responses` tables, or
2. receive its own route family, API surface, and normalized `discovery_*` table family

## Decision

Implement `Discovery` as a separate product flow with its own:

- public route
- consultant dashboard routes
- API routes
- normalized database tables

`Discovery` should reuse platform patterns where useful, but it should not overload `brief_sessions`, `brief_responses`, or other `brief_*` entities.

## Reasoning

- **Different response shape**: `Discovery` is organized around sections and supports more than one answer type. `Brief` is optimized for a simpler prompt-response model with voice and text input.
- **Different product semantics**: `Brief` is intentionally fast and light. `Discovery` is slower, deeper, and more structured. Treating them as the same domain object would blur intent and make the product harder to reason about.
- **Cleaner ownership and querying**: A dedicated `discovery_*` table family makes it easier to enforce consultant ownership, query responses by section, and extend the format later without carrying `Brief`-specific baggage.
- **Safer future evolution**: `Discovery` is likely to need richer summary, comparison, and reporting behavior than `Brief`. A separate model leaves room for that without risky retrofits.
- **Builder/public split is first-class**: `Discovery` is being designed with a deliberate builder-preview workflow. This is materially different from the current `Brief` creation flow and should be reflected in the architecture.

## What Is Reused

The separation is at the domain model level, not a rejection of existing proven patterns.

`Discovery` should still reuse:

- Supabase consultant auth via `getSupabaseRequestClient()`
- admin writes via `getSupabaseAdminClient()`
- token-based public access for respondents
- Resend email delivery patterns
- reminder semantics and ownership checks
- existing dashboard conventions where they remain appropriate

## Consequences

- **More tables and routes**: The system grows in breadth because `Discovery` gets its own route and table family.
- **Less schema ambiguity**: Queries and application code become easier to understand because `Brief` and `Discovery` are not multiplexed through the same records.
- **Migration cost is paid early**: This decision accepts more upfront implementation work to avoid future entanglement.
- **Operational metadata may still reuse `settings`**: Dispatch or reminder metadata can still use key prefixes in `settings` where that is appropriate, but the core content and response model must be normalized in dedicated `discovery_*` tables.
- **Documentation must stay aligned**: Any implementation of Discovery must update `app/CLAUDE.md` and the relevant files in `docs/project_notes/`.

## Implementation Direction

The intended first table family is:

- `discovery_templates`
- `discovery_sections`
- `discovery_questions`
- `discovery_question_options`
- `discovery_sessions`
- `discovery_responses`
- `discovery_response_options`

The intended first route family is:

- `/dashboard/discovery`
- `/dashboard/discovery/templates`
- `/dashboard/discovery/send/[id]`
- `/dashboard/discovery/responses`
- `/discovery/[token]`
- `/api/discovery/*`

The detailed shape is defined in `docs/specs/discovery.md`.
