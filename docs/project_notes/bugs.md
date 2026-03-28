# Known Bugs and Workarounds

## Active Issues

### PIN Token Midnight UTC Expiry

**Description**: The `verify-pin` HMAC token uses `Math.floor(Date.now() / 86_400_000)` as the HMAC input (day number since epoch). This means the token expires at midnight UTC, not 24 hours from when it was issued. A token issued at 23:50 UTC expires in 10 minutes.
**Impact**: Low — admin PIN access is infrequent and users can re-enter the PIN.
**Workaround**: If a PIN token expires unexpectedly, re-enter the PIN.
**Fix**: Change the HMAC input to a 24h-from-issue timestamp stored in a cookie or in `sessionStorage`.

### Font Config Inconsistency

**Description**: `tailwind.config.ts` declares `DM Sans` as the `fontFamily.sans` override, but the actually loaded font (via `next/font/local` in `app/layout.tsx`) is Inter Variable bound to `--font-sans`. The CSS variable takes precedence at runtime.
**Impact**: Negligible — the visual result is Inter, which is the intended design.
**Workaround**: None needed. Do not change either config without a full design decision.

## Resolved Issues

_(Add resolved bugs here with date and fix description)_
