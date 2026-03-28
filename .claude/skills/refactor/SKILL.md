# Skill: Refactor

Safely refactor code in this Next.js 14 project following established patterns.

## Usage

```
/refactor [describe the refactor goal]
```

## Key Patterns to Follow

### Supabase Client Selection

Always use the correct factory for the context:

```typescript
// In API routes — verify current user's session:
import { getSupabaseRequestClient } from '@/lib/server-auth'
const supabase = getSupabaseRequestClient()
const { data: { user } } = await supabase.auth.getUser()

// In API routes — admin/privileged operations:
import { getSupabaseAdminClient } from '@/lib/server-clients'
const admin = getSupabaseAdminClient()

// In client components only:
import { createClient } from '@/lib/supabase'
const supabase = createClient()
```

### Server vs Client Components

Default to Server Components. Only add `'use client'` when the component:
- Uses `useState`, `useEffect`, or other React hooks
- Attaches browser event listeners
- Uses browser-only APIs (navigator, window, etc.)

### Error Response Pattern

```typescript
// API route error responses — Swedish, consistent shape:
return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
```

### Required Env Var Pattern

```typescript
// Use this pattern (from lib/server-clients.ts) instead of inline checks:
function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
```

### Settings Table Read/Write Pattern

```typescript
// Read a settings value:
const { data, error } = await admin
  .from('settings')
  .select('value')
  .eq('key', someKey)
  .maybeSingle()

// Write/update a settings value:
await admin.from('settings').upsert({
  key: someKey,
  value: JSON.stringify(payload),
  updated_at: new Date().toISOString(),
})
```

### Type Safety for Settings Values

Always parse settings values through a typed parser function (see `parseBriefSummaryPayload`, `parseDispatchMetadata` in `lib/brief-batches.ts` as examples). Never use `as SomeType` on raw settings values.

## Refactor Safety Rules

1. **Run `npm run build` before and after** — catch TypeScript errors immediately
2. **Check all callers** when changing a function signature in `lib/`
3. **Preserve Swedish strings** — do not translate error messages or UI text during refactors
4. **Keep the two Supabase client types separate** — never consolidate them into one factory
5. **Do not remove `maxDuration` exports** from AI routes — they protect against Vercel timeout charges
