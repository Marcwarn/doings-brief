# Brief Workspace Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-03-30

## Purpose

`Brief` is the shortest pre-work format in the product.

It should feel like a quick, personal debrief or need snapshot sent to one or a few people before an engagement, not like a heavier multi-theme intake.

The `Brief` workspace should therefore be simpler than `Discovery`, but still use the same design discipline:

- clear internal editing area
- clear recipient-facing preview
- minimal cognitive load
- direct path to send

## Product Positioning

The three formats should now be understood like this:

| Format | Primary use case | Typical audience | Shape |
|---|---|---|---|
| `Brief` | Quick debrief or pre-work questions | One or a few people | Short and direct |
| `Discovery` | Broader needs exploration | Multiple respondents, often with themes | Deeper and more structured |
| `Utvärdering` | Feedback after a physical session | Workshop participants | Reflective follow-up |

## Core UX Principle

`Brief` should adopt the same broad internal logic as `Discovery`, but in a lighter form.

When a consultant is shaping what another person will receive, the UI should use:

- left side: internal editing and send controls
- right side: recipient-facing preview

This creates cross-product consistency without forcing `Brief` to become as complex as `Discovery`.

## What Brief Should Feel Like

`Brief` should feel:

- quick
- personal
- easy to send
- easy to understand at a glance

It should not feel:

- admin-heavy
- theme-heavy
- like a landing page
- like a large builder tool

## Workspace Structure

### Left side — Internal workspace

This is where the consultant prepares the send-out.

It should contain three lightweight tabs:

- `Frågor`
- `Upplägg`
- `Skicka`

Unlike `Discovery`, `Brief` does not need a `Data` tab in the same workspace. Follow-up can continue to live in `Översikt`.

### Right side — Recipient preview

This is a faithful preview of what the recipient will see:

- intro text
- progress feel
- one-question-at-a-time rhythm
- tone of the questions
- final submit confirmation state if needed

The preview should look real, not like a wireframe.

## Tab Definitions

### 1. `Frågor`

Purpose: shape the question set and tone.

Should include:

- selected question set
- question order
- option to remove a question from this send if needed later
- intro title and intro text
- quick reading of how many questions the send contains

Should avoid:

- heavy controls
- large forms before the preview

### 2. `Upplägg`

Purpose: frame the send operationally.

Should include:

- customer or organisation
- internal label for the send
- optional short context note
- selected sender identity if needed

This tab is about preparing the context around the send, not editing the recipient experience directly.

### 3. `Skicka`

Purpose: finish and send.

Should include:

- recipients
- import or paste
- individual status rows
- send button
- clear success and failure feedback

This tab should be visually calm and decisive.

## Recommended Layout

### Header area

Keep it small.

`Brief` should not use a large hero.

Suggested header structure:

- title: `Nytt utskick`
- short helper line: what this is for

Example tone:

`Skicka ett kort underlag till en eller flera personer inför nästa steg.`

### Top utility row

Above the left-side tabs, keep a compact orientation row:

- question count
- selected customer, if any
- recipient count, if any

This gives fast context without competing with the preview.

### Split proportions

Recommended:

- left: 38–42%
- right: 58–62%

The preview should carry slightly more visual weight than the editor.

## Preview Principles

The right-side preview should show the exact rhythm of the public `Brief` flow:

- welcoming but short intro
- first question state
- progress indication
- primary CTA

It does not need to render every question at once.

Better preview choices:

- first question plus visible progress
- optional miniature review state lower down

This keeps the preview believable and light.

## Content Tone

### Brief

Tone should be:

- direct
- warm
- time-respectful
- less editorial than `Discovery`

It should sound like:

- “hjälp oss få en snabbare bild”
- “några korta frågor inför nästa steg”

Not like:

- “fördjupa underlaget”
- “behovsanalys”
- “perspektiv”

Those belong more naturally to `Discovery`.

## Navigation Recommendation

Inside `Brief`, prioritize action over admin structure.

Primary sub-navigation should be:

- `Nytt utskick`
- `Översikt`
- `Frågebatterier`

This matches the expected mental model:

- start something new
- follow up in overview
- manage content separately

## Relationship to Existing Brief Views

### `/dashboard/send`

This route is the strongest candidate to evolve into the new split workspace.

It already contains the core send mechanics and should become the primary `Brief` creation surface.

### `/dashboard/briefs`

This should remain an overview/follow-up surface, not a builder.

### `/dashboard/customers`

This should continue to support the flow, but not define the primary navigation order.

## Wireframe Outline

### Left

`[Top utility row]`

`[Tabs: Frågor | Upplägg | Skicka]`

When `Frågor` is active:

- selected question set
- intro fields
- question list

When `Upplägg` is active:

- customer
- internal send label
- optional context note

When `Skicka` is active:

- recipients
- send control
- status messages

### Right

`[Recipient preview shell]`

- short intro
- progress
- first question
- CTA

Optional lower block:

- how the final confirmation feels

## Definition of Good Conformity

Conformity across `Brief`, `Discovery`, and `Utvärdering` should come from:

- layout rhythm
- spacing
- tone
- reusable controls
- clear distinction between internal workspace and external experience

It should not require every format to use the exact same UI structure.

## Recommended Next Step

Implement the new `Brief` split workspace in `/dashboard/send` first.

Do not begin with `Utvärdering`.

That gives the clearest pair:

- `Brief` = light split workspace
- `Discovery` = deeper split workspace

Then evaluate which parts of the same system should later carry over into `Utvärdering`.
