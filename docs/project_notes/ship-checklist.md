# Ship Checklist

This checklist is for the first narrow production release of the `Brief` workflow.

## Release target

Ship one reliable loop:

1. Consultant creates and sends a brief
2. Recipient opens the personal link and responds
3. Consultant reviews the response in dashboard
4. Consultant generates AI summary
5. Consultant exports Word

Primary code paths:
- `app/dashboard/send/page.tsx`
- `app/dashboard/briefs/page.tsx`
- `app/dashboard/briefs/[id]/page.tsx`
- `app/api/briefs/send-invite/route.ts`
- `app/api/briefs/submit/route.ts`
- `app/api/briefs/summarize/route.ts`

Primary smoke tests:
- `scripts/test-batch-send.mjs`
- `scripts/test-ai-summary.mjs`
- `scripts/test-word-export.mjs`

## Scope freeze

Before release, freeze all work not directly improving the brief loop.

Out of scope for this release:
- Discovery expansion
- broad dashboard redesign
- non-critical Admin changes
- world-class UI polish outside the brief flow
- new workflow types
- advanced analytics

## Product readiness

- [ ] The release goal is written in one sentence
- [ ] The primary user is named
- [ ] The primary outcome is named
- [ ] In-scope is explicit
- [ ] Out-of-scope is explicit

Suggested release sentence:

`A consultant can send a short brief, get a real response back, generate a usable AI summary, and export the result without manual intervention.`

## Canonical flow

Use only the canonical brief API and UI flow.

Canonical UI:
- `app/dashboard/send/page.tsx`
- `app/brief/[token]/page.tsx`
- `app/dashboard/briefs/page.tsx`
- `app/dashboard/briefs/[id]/page.tsx`

Canonical API:
- `app/api/briefs/send-invite/route.ts`
- `app/api/briefs/submit/route.ts`
- `app/api/briefs/summarize/route.ts`

- [ ] Canonical invite route is confirmed
- [ ] Canonical submit route is confirmed
- [ ] UI links use canonical routes only
- [ ] Smoke tests use canonical routes only
- [ ] Legacy routes are not extended for new work

Known overlapping routes to resolve or explicitly deprecate:
- `app/api/send-brief-invite/route.ts`
- `app/api/briefs/send-invite/route.ts`
- `app/api/submit-brief/route.ts`
- `app/api/briefs/submit/route.ts`

For this release, treat these as legacy and non-canonical:
- `app/api/send-brief-invite/route.ts`
- `app/api/submit-brief/route.ts`

## Trust and user safety

- [ ] Token validity behavior matches user-facing copy
- [ ] Reminder behavior is described honestly
- [ ] Error messages are Swedish and useful
- [ ] Consultant dashboard has an error boundary for the brief path
- [ ] No known misleading claims remain in the shipped path

Known trust risks:
- token expiry mismatch
- manual-only reminder model
- possible fragile failures in consultant dashboard surfaces

See:
- `docs/project_notes/issues.md`
- `docs/project_notes/key_facts.md`

## Technical verification

Required before release:

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run test:batch-send`
- [ ] `npm run test:ai-summary`
- [ ] `npm run test:word-export`

If any one fails:
- release is blocked
- failure is triaged before merge
- no workaround-by-hope

## Manual end-to-end check

Run one real consultant-path pass.

- [ ] Log in as consultant
- [ ] Create or open a question set
- [ ] Send a brief to test recipients
- [ ] Open recipient link
- [ ] Submit one real response
- [ ] Confirm response appears in dashboard
- [ ] Generate AI summary
- [ ] Export Word
- [ ] Confirm consultant notification behavior is acceptable

## Release hygiene

- [ ] No unrelated redesign bundled in the release
- [ ] No Discovery changes bundled unless they block the brief flow
- [ ] No `.agents/` or local-only helper files included by accident
- [ ] No generated noise included by accident
- [ ] Release notes include known limitations

## Post-ship learning

Define what will be watched after release.

- [ ] Number of briefs sent
- [ ] Number of completed responses
- [ ] Summary success/failure rate
- [ ] Export success/failure rate
- [ ] Top user friction points
- [ ] Any support or trust complaints

If analytics are not yet instrumented:
- track manually for the first release window
- write findings in `docs/project_notes/`

## Definition of done

This release is done when:

- [ ] A consultant can use the brief flow end to end without manual intervention
- [ ] The 3 brief smoke tests pass
- [ ] Typecheck and lint pass
- [ ] Manual end-to-end pass succeeds
- [ ] Known trust-breaking mismatches are fixed or explicitly documented
- [ ] Scope stayed narrow

## Stop rules

Do not ship if any of these are true:

- [ ] Canonical route ownership is still ambiguous
- [ ] The smoke tests are red
- [ ] The manual end-to-end pass fails
- [ ] The release includes broad unrelated UI work
- [ ] User-facing copy still promises behavior the code does not enforce
