# Current Handoff

Last updated: 2026-04-15

## Release target
Ship the first narrow production release of the `Brief` workflow:
1. consultant creates and sends a brief
2. recipient opens the public link and responds
3. consultant reviews the response
4. consultant generates AI summary
5. consultant exports Word

## Where we are
- Canonical brief routes are agreed and documented.
- `npx tsc --noEmit` passes locally.
- `npm run lint` is now a real gate and passes locally with warnings only.
- Brief smoke tests were updated so they no longer assume the old post-login route.
- The public brief page no longer implies token expiry with misleading copy.

## What is currently blocking release
- Smoke tests are not green because the current Vercel smoke account fails to log in.
- Manual end-to-end brief verification is not complete for the same reason.

## Confirmed current blockers
1. `DOINGS_BRIEF_TEST_EMAIL` / `DOINGS_BRIEF_TEST_PASSWORD` currently fail on `https://doings-brief.vercel.app/login`
   Observed result: `Fel e-post eller lösenord.`
2. Brief smoke tests now fail with the real login error instead of a stale route timeout.

## Do not re-diagnose these again unless something changes
- Do not spend more time on canonical brief route selection. That is already decided.
- Do not spend more time making `npm run lint` work. That is already done.
- Do not spend more time on the old `**/dashboard/evaluations/new**` smoke-test assumption. That is already fixed in the test scripts.

## Next steps for the next agent
1. Get valid smoke-test credentials for Vercel, or point the smoke tests at a verified environment.
2. Re-run:
   - `npm run test:batch-send`
   - `npm run test:ai-summary`
   - `npm run test:word-export`
3. Run one manual end-to-end brief pass.
4. Update `docs/project_notes/release-owner-notes.md` with the actual verification result.
5. Commit only the release-gate changes cleanly. Do not mix in unrelated dashboard redesign work.

## Files that matter for the current release gate
- `docs/project_notes/release-owner-notes.md`
- `docs/project_notes/ship-checklist.md`
- `docs/project_notes/brief-release-acceptance-criteria.md`
- `app/brief/[token]/page.tsx`
- `scripts/test-batch-send.mjs`
- `scripts/test-ai-summary.mjs`
- `scripts/test-word-export.mjs`
- `.eslintrc.json`

## Important local context
- The worktree contains many unrelated local UI changes. Do not sweep them into a release-gate commit.
- Keep the release work narrow to the brief path and its verification.
