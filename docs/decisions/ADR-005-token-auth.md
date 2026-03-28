# ADR-005: Token-Based Public Access for Client Briefs

**Status**: Accepted
**Date**: 2024

## Context

Clients (brief respondents) should be able to fill out a brief without creating an account. The brief link must be shareable by email, work on any device, and expire or be invalidatable.

## Decision

Use a UUID token stored in the `brief_sessions.token` column. The token is embedded in the brief URL (`/brief/{token}`) and validated server-side on each API call.

## Access Control Model

```
/brief/[token]        → Public Next.js page. Reads session metadata using the token.
/api/submit-brief     → Validates token against brief_sessions table. No session cookie needed.
/api/transcribe       → No auth. Rate limiting is the only protection (Vercel function timeout).
/api/verify-pin       → Separate PIN-based admin access. Generates a HMAC token.
```

Consultant-facing routes (`/api/brief-access`, `/api/briefs/*`, `/api/customers`, etc.) require a valid Supabase session cookie. These routes call `getSupabaseRequestClient()` and check `supabase.auth.getUser()`.

## Reasoning

- **Zero friction for clients**: No signup, no password, no OAuth. The link is the credential.
- **UUID entropy**: A UUID v4 has 122 bits of randomness. Brute-force guessing is not a practical attack.
- **Server-side validation**: The token is never used as a symmetric key — it's looked up in the database. Compromise of one token does not compromise others.
- **Revocability**: An admin can update `brief_sessions.status = 'submitted'` or delete the row to invalidate the token.

## Consequences

- **Link sharing risk**: If a client forwards the brief URL to a colleague, that colleague can also submit responses. This is an accepted trade-off for simplicity.
- **No expiry enforcement in code**: The invite email implies a validity window but there is no expiry check in the API routes. This is enforced by process (consultants archive old sessions) not by code.
- **PIN token expires at midnight UTC**: The `verify-pin` HMAC token uses day-granularity (`Math.floor(Date.now() / 86_400_000)`) as the HMAC input. It expires at midnight UTC, not 24h from issue. This is a known quirk documented in `docs/project_notes/bugs.md`.
