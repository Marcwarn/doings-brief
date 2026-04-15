# Release Owner Notes

## Current release
First narrow production release of the `Brief` workflow.

## Release owner
- Name:
- Role:
- Date assigned:

## Release goal
Ship one reliable loop:

1. Consultant creates and sends a brief
2. Recipient opens the personal link and responds
3. Consultant reviews the response in dashboard
4. Consultant generates AI summary
5. Consultant exports Word

## Current scope
In scope:
- `Brief` send flow
- public brief response flow
- consultant response detail
- AI summary
- Word export
- only supporting customer/dispatch visibility required for the flow

Out of scope:
- Discovery expansion
- broad dashboard redesign
- non-critical Admin changes
- advanced analytics
- new workflow types
- general polish outside the brief path

## Canonical surfaces
UI:
- `app/dashboard/send/page.tsx`
- `app/dashboard/briefs/page.tsx`
- `app/dashboard/briefs/[id]/page.tsx`

API:
- `app/api/briefs/send-invite/route.ts`
- `app/api/briefs/submit/route.ts`
- `app/api/briefs/summarize/route.ts`

## Current blockers
- [ ] Canonical brief routes are fully agreed
- [ ] Token validity behavior matches user-facing copy
- [ ] Relevant smoke tests are green
- [ ] Manual end-to-end pass is green
- [ ] No unrelated release scope is mixed in

## Current risks
- Legacy route ambiguity:
  - `app/api/send-brief-invite/route.ts`
  - `app/api/briefs/send-invite/route.ts`
  - `app/api/submit-brief/route.ts`
  - `app/api/briefs/submit/route.ts`
- Token expiry mismatch with product expectations
- Smoke tests depend heavily on live/shared environments
- Broad UI churn can create regressions outside the narrow release slice

## Verification status
- `npx tsc --noEmit`:
- `npm run lint`:
- `npm run test:batch-send`:
- `npm run test:ai-summary`:
- `npm run test:word-export`:
- Manual end-to-end check:

## Last verified
- Date:
- Environment:
- Verified by:

## Open decisions
- Which route set is canonical for brief invite and submit?
- What exact token-validity promise is acceptable in v1?
- What is the release/no-release threshold if smoke tests are flaky?

## Notes
- Keep this file short.
- Update it when scope, owner, blockers, or verification status changes.
- If this file becomes stale, release confidence is lower than it appears.
