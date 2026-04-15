# Brief Release Acceptance Criteria

## Release target
The first `Brief` release is acceptable when one consultant can use the flow end to end without manual intervention.

## Pass criteria

### 1. Send
- A consultant can create and send a brief from the dashboard
- At least one recipient receives a valid brief link
- The send flow returns clear success or failure feedback in Swedish

### 2. Respond
- A recipient can open the brief link without logging in
- A recipient can submit answers successfully
- The submission does not require manual database fixes

### 3. Review
- The consultant can see the submitted response in the dashboard
- The response detail shows the submitted content clearly
- The consultant can distinguish submitted vs pending state

### 4. AI summary
- AI summary can be generated on a real submitted response
- The result renders in the dashboard without broken state
- Failure returns a clear Swedish error message

### 5. Export
- Word export works on a real submitted response
- The exported file downloads successfully
- The exported file contains the expected response content

### 6. Verification
- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test:batch-send` passes
- `npm run test:ai-summary` passes
- `npm run test:word-export` passes
- One manual end-to-end pass succeeds

## Fail criteria

Do not ship if any of these are true:
- the canonical brief route flow is still unclear
- the recipient link works inconsistently
- the response does not appear correctly in dashboard
- AI summary fails on the real path
- Word export fails on the real path
- user-facing copy promises behavior the code does not support
- unrelated scope is bundled into the release

## Notes
This is for the first narrow ship only.
If a check is missing, the release is not ready.
