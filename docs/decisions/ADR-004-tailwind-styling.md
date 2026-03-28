# ADR-004: Tailwind CSS with Glassmorphic Design System

**Status**: Accepted
**Date**: 2024

## Context

The application needs a consistent visual design that works across consultant dashboard, client brief forms, admin panel, and email templates.

## Decision

Use Tailwind CSS with a custom design token extension plus a small set of reusable CSS component classes defined in `globals.css`.

## Design System Structure

Two complementary layers:

**Layer 1 — Tailwind theme extension** (`tailwind.config.ts`):
```
doings.purple:       #6b2d82  (primary brand)
doings.purple-dark:  #1e0e2e  (headers, gradients)
doings.purple-mid:   #3d1a47  (hover states)
doings.purple-light: #e8d9f0  (borders, tints)
doings.purple-pale:  #f0eaf5  (backgrounds)
doings.bg:           #f5f4f8  (page background)
doings.text:         #0a0a0f  (body text)
doings.muted:        #606070  (secondary text)
```

**Layer 2 — CSS custom properties** (`globals.css` `:root`):
```
--bg, --surface, --border, --border-sub
--text, --text-2, --text-3
--accent (#C62368 — the pink/magenta accent)
--accent-dim
```

Note: The CSS `--accent` value (`#C62368`) is distinct from the Tailwind `doings.purple`. Accent is used for recording indicators, waveforms, and action highlights. Purple is the brand identity.

**Layer 3 — Component classes** (`globals.css`):
- `.glass-card` — frosted glass card with drop shadow
- `.glass-header` — smaller glass surface for headers/pills
- `.glass-btn-outline` — ghost button with glass background
- `.mic-btn` — recording microphone button with gradient
- `.pulse-ring`, `.idle-ring` — recording state animations
- `.wave-bar` — audio waveform animation bars

## Reasoning

- **No component library**: The glassmorphic aesthetic requires precise `backdrop-filter` and gradient control that off-the-shelf component libraries don't support cleanly.
- **CSS vars for theming**: The `:root` CSS variables allow consistent values across Tailwind classes and inline styles in email templates.
- **Tailwind for layout**: Utility classes handle spacing, layout, and responsive design. Custom CSS only for complex visual effects.

## Consequences

- **Font inconsistency**: `tailwind.config.ts` declares `DM Sans` as the sans font family. The actual loaded font (via `next/font/local` in `app/layout.tsx`) is **Inter Variable** bound to `--font-sans`. The Tailwind `font-sans` class will not apply DM Sans at runtime — the CSS variable takes precedence. This is a known inconsistency; do not fix without a design decision.
- **No dark mode**: No dark mode variant is configured in Tailwind. Do not add `dark:` prefixes without a design decision.
- **Email templates use inline styles**: The glassmorphic CSS classes cannot be used in email HTML. Email templates in the API routes duplicate design tokens as inline styles.
