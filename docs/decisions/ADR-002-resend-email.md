# ADR-002: Resend for Transactional Email

**Status**: Accepted
**Date**: 2024

## Context

Two email flows are needed:
1. Brief invite emails sent to clients (from consultant identity)
2. Brief submission notifications sent to internal team

## Decision

Use Resend instead of SendGrid, Postmark, or AWS SES.

## Reasoning

- **Simple API**: The Resend SDK is a single `resend.emails.send()` call with a clean TypeScript interface. No template IDs, no complex configuration.
- **Single verified domain**: All emails send from the address in `FROM_EMAIL`. Resend requires only one domain to be verified.
- **Reply-to hack for consultant identity**: Client invite emails show `[Consultant Name] via Doings <brief@doingsclients.se>` as sender but set `reply_to: consultantEmail`. This means clients see the consultant's name, deliverability is handled by the verified domain, and replies land directly in the consultant's inbox.
- **Free tier sufficiency**: Volume is low (per-engagement invites, not marketing blasts). Resend's free tier covers the expected usage.

## Consequences

- **`FROM_EMAIL` must be a verified domain in Resend**: If the env var points to an unverified domain, all sends will fail with a 403. The `.env.example` documents this.
- **No email templates stored in Resend**: All HTML is built inline in the route files (`buildHtml()` functions). This is intentional to keep the email design version-controlled alongside the code.
- **`RESEND_API_KEY` is a hard dependency**: The `getResendClient()` factory throws if the key is missing, so any route that sends email will return 500 if unconfigured.
