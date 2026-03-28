# Runbook: Smoke Testing

## Overview

Three Playwright smoke tests run against the live deployment to verify critical user flows end-to-end. They are not unit tests — they require a real deployment with real credentials.

## Test Scripts

| Script | File | What It Tests |
|---|---|---|
| `npm run test:ai-summary` | `scripts/test-ai-summary.mjs` | Login → open brief response → trigger AI summary → verify all 6 summary sections → verify copy button → verify cached reload |
| `npm run test:word-export` | `scripts/test-word-export.mjs` | Login → open brief response → export Word/Excel → verify download |
| `npm run test:batch-send` | `scripts/test-batch-send.mjs` | Login → create a multi-recipient batch dispatch → verify invite emails queued |

## Required Environment Variables

```
DOINGS_BRIEF_BASE_URL        # e.g. https://doings-brief.vercel.app
DOINGS_BRIEF_TEST_EMAIL      # Consultant login email
DOINGS_BRIEF_TEST_PASSWORD   # Consultant login password
DOINGS_BRIEF_RESPONSE_URL    # Optional: direct URL to a specific brief response page
```

In CI these are GitHub Secrets (`secrets.DOINGS_BRIEF_*`). Locally, set them in your shell or in a `.env.local` file (the scripts use `process.env` directly).

## Running Locally

```bash
# Install playwright browsers first (only needed once)
npx playwright install --with-deps chromium

# Set env vars
export DOINGS_BRIEF_BASE_URL=https://doings-brief.vercel.app
export DOINGS_BRIEF_TEST_EMAIL=your-consultant@example.com
export DOINGS_BRIEF_TEST_PASSWORD=yourpassword

# Run a specific test
npm run test:ai-summary
```

## CI Triggers

All three workflows (`.github/workflows/ai-summary-smoke.yml`, etc.) trigger on:
- Push to `main`
- Manual `workflow_dispatch`

Artifacts (screenshots on failure) are uploaded to GitHub Actions for 90 days.

## Adding a New Smoke Test

1. Create a new script in `scripts/test-{feature}.mjs`
2. Follow the existing pattern: `chromium.launch` → `context.newPage()` → actions → `finally { browser.close() }`
3. Add `"test:{feature}": "node scripts/test-{feature}.mjs"` to `package.json` scripts
4. Create `.github/workflows/{feature}-smoke.yml` following the pattern in existing workflows
5. Add any new required secrets to GitHub Actions secrets and document them in `.env.example`

## Debugging a Failing Test

1. Check the GitHub Actions artifact for screenshots
2. Run the test locally with `DOINGS_BRIEF_BASE_URL` pointing to the deployed URL
3. The test scripts write JSON output on success — check for unexpected error text in body assertions
4. Common failures:
   - Session expired: the test account password was rotated
   - AI timeout: Berget AI responding slowly — re-run manually via `workflow_dispatch`
   - Selector changed: a UI text string was changed from its Swedish label (e.g. "Sammanfatta med AI")
