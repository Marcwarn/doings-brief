# Milestone Brief — First Brief Release

## Milestone
Ship one narrow, reliable `Brief` workflow that a consultant can use end to end without manual intervention.

## Goal
A consultant should be able to:
1. create and send a brief
2. receive a completed response from a recipient
3. review the response in dashboard
4. generate an AI summary
5. export the result as Word

## Why this milestone
`Brief` is the strongest existing path in the product:
- it already has the clearest send/respond/review flow
- it already has smoke coverage
- it is the fastest way to validate real value with live users
- it is narrower and lower-risk than trying to ship Discovery or a full admin redesign first

## Primary user
Consultant at Doings running a pre-work or pre-dialogue intake with one or a few people.

## User outcome
The consultant gets usable pre-meeting input quickly enough to improve the next conversation, workshop, or proposal step.

## In scope
- `Brief` send flow
- public brief response flow
- consultant response detail
- AI summary
- Word export
- only the minimum customer/dispatch visibility required to support this path
- release checks and smoke coverage for this path

## Out of scope
- Discovery expansion
- broad dashboard redesign
- Admin improvements not blocking the brief path
- advanced analytics
- PDF export
- major new UX work outside the brief loop
- new workflow types

## Canonical surfaces
UI:
- `app/dashboard/send/page.tsx`
- `app/brief/[token]/page.tsx`
- `app/dashboard/briefs/page.tsx`
- `app/dashboard/briefs/[id]/page.tsx`

API:
- `app/api/briefs/send-invite/route.ts`
- `app/api/briefs/submit/route.ts`
- `app/api/briefs/summarize/route.ts`

Legacy and non-canonical:
- `app/api/send-brief-invite/route.ts`
- `app/api/submit-brief/route.ts`

## Known risks to resolve or explicitly accept
- token validity behavior must match copy
- legacy brief routes must not remain ambiguous
- release confidence is too dependent on smoke tests against live environments
- dashboard failures need clearer containment for consultant-facing paths

## Acceptance criteria
This milestone is done when:
- a consultant can send a brief without manual DB or env intervention
- a recipient can complete the brief through the public link
- the consultant can see the response in dashboard
- AI summary works on a real submitted response
- Word export works on a real submitted response
- `tsc`, lint, and the relevant smoke tests pass
- one manual end-to-end pass succeeds
- no known trust-breaking mismatch remains in the shipped path

## Success signals after release
- real briefs are sent by real consultants
- real responses are completed successfully
- AI summary is used on real responses
- export is used on real responses
- the first feedback is about usefulness, not about confusion or breakage

## What we are explicitly not optimizing yet
- perfect dashboard information architecture
- premium redesign across every screen
- deep Discovery analytics
- broad system elegance

This milestone is about proving one reliable value loop, not finishing the whole product.
