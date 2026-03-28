# Skill: Release Checklist

Verify that a change is ready to deploy to the live Vercel deployment.

## Usage

```
/release [describe what is being released]
```

## Pre-Deploy Checklist

### Build Verification
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm run lint` passes (or lint errors are acknowledged and documented)
- [ ] No `console.log` debugging statements left in API routes (console.error is fine)

### Environment Variables
- [ ] Any new required env vars are added to `.env.example` with descriptions
- [ ] New env vars have been added to Vercel Dashboard → Settings → Environment Variables
- [ ] GitHub Actions secrets updated if the change affects smoke tests

### Security
- [ ] No secrets, API keys, or passwords committed to the repository
- [ ] No `.env.local` file staged in git (`git status` check)
- [ ] Service role key not exposed in client-side code

### Swedish Language
- [ ] All new user-facing strings are in Swedish
- [ ] Email subject lines and body text are in Swedish
- [ ] Error messages returned to the browser are in Swedish

### API Routes
- [ ] New protected routes check `supabase.auth.getUser()` and return 401 if no session
- [ ] New AI routes have `export const maxDuration = 30`
- [ ] New email routes use `FROM_EMAIL` env var

### Smoke Tests

After deploying to Vercel:

1. **AI Summary test**: Go to GitHub Actions → Run `AI Summary Smoke Test` manually
   - Verifies: login, brief response page loads, AI summarization returns all 6 sections, copy works, cache works

2. **Word Export test**: Go to GitHub Actions → Run `Word Export Smoke Test` manually
   - Verifies: login, brief response page loads, Word/Excel download triggered

3. **Batch Send test**: Go to GitHub Actions → Run `Batch Send Smoke Test` manually
   - Verifies: login, multi-recipient dispatch flow completes

### Rollback Plan

Vercel instant rollback: Go to Vercel Dashboard → Deployments → select previous deployment → Promote to Production.

No database migrations to reverse in most cases. If a migration was applied:
- The migration cannot be auto-rolled back
- Revert must be done manually in Supabase SQL editor
- Document the rollback SQL before applying any migration
