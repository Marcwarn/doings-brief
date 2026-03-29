# Discovery Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-03-29

## Purpose

`Discovery` is a deeper pre-engagement intake format than `Brief`.

It is intended for consulting situations where Doings needs a more structured understanding of needs, tensions, priorities, and maturity before proposing an intervention, workshop, or engagement plan.

`Discovery` is not a rename of `Brief`. It is a separate product surface with a different depth, tone, and response shape.

## Product Positioning

The platform now has three distinct formats:

| Format | Primary use case | Depth | Typical timing |
|---|---|---|---|
| `Brief` | Quick pre-work questions | Short | Before an engagement |
| `Discovery` | Deeper needs analysis with themes and more reflective answers | Medium to deep | Before scoping or proposal work |
| `Utvärdering` | Feedback from groups after a physical session | Reflective follow-up | After a workshop or intervention |

## Core Principles

1. `Discovery` must feel like a deliberate customer-facing intake experience, not an internal admin form.
2. `Discovery` must be modeled separately from `Brief` in the database and API surface.
3. `Discovery` should reuse proven platform patterns where that lowers risk:
   - token-based public access
   - consultant auth model
   - dispatch/invite mechanics
   - reminder mechanics
4. `Discovery` should not reuse `brief_responses` or overload `brief_sessions`.
5. The builder and the public customer experience must remain conceptually separate, even if they share rendering patterns.

## Users

### Consultant

The authenticated Doings user who:

- creates and edits a discovery template
- previews the public customer experience
- chooses recipients
- sends discovery invites
- reviews responses

### Client respondent

The recipient who:

- receives a personal email invite
- opens a token-based public link
- answers questions without logging in
- submits one set of responses

### Admin

No dedicated Discovery-specific admin workflow is required in the first version.

## Audience Fit

`Discovery` must support different respondent constellations:

- leaders only
- employees only
- a full team
- mixed groups where leaders and employees answer side by side

The default question language should therefore stay audience-neutral unless a theme clearly benefits from a more specific variant.

See `docs/specs/discovery-audience-guidance.md` for theme-by-theme recommendations on where shared wording is sufficient and where leader-specific or mixed-group variants should be introduced later.

## Scope

## In scope for first implementation

- Save and edit Discovery templates
- Multiple thematic sections per template
- Question types:
  - open text
  - single or multi-choice
  - scale
- Public token-based response route
- Multi-recipient send flow
- Reminder flow
- Dashboard response overview

## Out of scope for first implementation

- AI summary generation
- autosave in the public experience
- token expiry logic, unless aligned across the platform later
- collaborative editing by multiple consultants at once
- advanced analytics and benchmarking
- PDF export

## Information Architecture

### Internal routes

| Route | Purpose |
|---|---|
| `/dashboard/discovery` | Builder and preview workspace |
| `/dashboard/discovery` with `Data` tab | Response interpretation, summaries, and analysis lenses |
| `/dashboard/discovery/templates` | List of saved discovery templates |
| `/dashboard/discovery/templates/[id]` | Edit a saved template |
| `/dashboard/discovery/send/[id]` | Recipient selection and send flow for a template |
| `/dashboard/discovery/responses` | Response list and status overview |
| `/dashboard/discovery/responses/[sessionId]` | Single response detail |

### Public routes

| Route | Purpose |
|---|---|
| `/discovery/[token]` | Public customer-facing Discovery experience |

### API routes

| Route | Purpose |
|---|---|
| `/api/discovery/templates` | Create and update templates |
| `/api/discovery/templates/[id]` | Fetch a full template |
| `/api/discovery/send` | Create sessions and send invites |
| `/api/discovery/public/[token]` | Fetch public Discovery payload |
| `/api/discovery/submit` | Save Discovery responses |
| `/api/discovery/remind` | Send reminder emails for pending Discovery sessions |

## UX Model

### Builder workspace

The current `/dashboard/discovery` split-view is the intended foundation:

- left panel: editing
- right panel: public customer preview

The builder must support:

- template name
- intro title
- intro text
- ordered thematic sections
- ordered questions inside each section
- options for choice questions
- scale configuration where needed

The internal workspace is intended to expose four editor tabs:

- `Frågor`
- `Upplägg`
- `Skicka`
- `Data`

### Public customer experience

The public Discovery experience should:

- preserve the calmer landing-page-like composition already established
- show thematic navigation clearly
- feel lightweight and readable on desktop and mobile
- avoid exposing internal editing concepts

## Functional Requirements

### FR-0.5 Data interpretation layer

`Discovery` should evolve beyond collection into interpretation.

The internal workspace should therefore include a `Data` tab that:

- visualizes response status and theme-level signal
- gives consultants direct access to raw answers
- supports AI-generated summaries from predefined analytical lenses

See `docs/specs/discovery-data.md` for the dedicated specification of this surface.

### FR-0 Audience mode

Each Discovery template must store an `audience_mode` that describes who the wording is primarily intended for:

- `shared`
- `leaders`
- `mixed`

In the first implementation this is editorial metadata on the template. It does not yet generate separate question variants automatically, but it establishes the model for future audience-specific versions.

### FR-1 Template management

Consultants must be able to:

- create a new Discovery template
- edit an existing Discovery template
- save drafts
- duplicate a template later if needed

### FR-2 Sectioned content model

A Discovery template must support:

- multiple sections
- ordered sections
- section title
- section description
- multiple ordered questions per section

### FR-3 Question types

Supported question types in v1:

- `open`
- `choice`
- `scale`

For `choice`, the system must support:

- ordered options
- single-choice or multi-choice behavior

For `scale`, the system must support:

- integer scale values
- a configurable min and max range
- optional endpoint labels

### FR-4 Send flow

Consultants must be able to:

- choose a saved template
- add one or multiple recipients
- create a session per recipient
- send an email invite with a unique token link

### FR-5 Public response flow

A recipient must be able to:

- open the public token link
- see the correct template content
- answer all supported question types
- submit responses once

### FR-6 Status tracking

The system must track:

- `pending`
- `submitted`

Reminder metadata may initially live in `settings`, following the existing operational pattern used by `Brief`.

### FR-7 Ownership and access control

Only the consultant who owns a Discovery template or session may:

- edit the template
- send from that template
- view its sessions
- remind pending recipients
- view submitted responses

## Data Model

Discovery gets its own normalized table family.

### `discovery_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | owning consultant |
| `name` | `text` | internal template name |
| `intro_title` | `text` | hero/title shown publicly |
| `intro_text` | `text` | public explanatory copy |
| `audience_mode` | `text` | `shared`, `leaders`, or `mixed` |
| `status` | `text` | `draft` or `active` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### `discovery_sections`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `template_id` | `uuid` | FK to template |
| `label` | `text` | section name |
| `description` | `text` | public descriptive copy |
| `order_index` | `int` | render order |
| `created_at` | `timestamptz` | default now |

### `discovery_questions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `section_id` | `uuid` | FK to section |
| `type` | `text` | `open`, `choice`, `scale` |
| `text` | `text` | question copy |
| `order_index` | `int` | render order |
| `max_choices` | `int` | nullable, relevant for `choice` |
| `scale_min` | `int` | nullable, relevant for `scale` |
| `scale_max` | `int` | nullable, relevant for `scale` |
| `scale_min_label` | `text` | nullable |
| `scale_max_label` | `text` | nullable |
| `created_at` | `timestamptz` | default now |

### `discovery_question_options`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `question_id` | `uuid` | FK to question |
| `label` | `text` | option text |
| `order_index` | `int` | render order |

### `discovery_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `consultant_id` | `uuid` | owning consultant |
| `consultant_email` | `text` | copied for operational email use |
| `template_id` | `uuid` | FK to template |
| `client_name` | `text` | recipient name |
| `client_email` | `text` | recipient email |
| `client_organisation` | `text` | nullable |
| `token` | `uuid` | public access token |
| `status` | `text` | `pending` or `submitted` |
| `created_at` | `timestamptz` | default now |
| `submitted_at` | `timestamptz` | nullable |

### `discovery_responses`

One row per answered question.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK to session |
| `question_id` | `uuid` | FK to question |
| `response_type` | `text` | mirrors question type |
| `text_value` | `text` | nullable |
| `scale_value` | `int` | nullable |
| `created_at` | `timestamptz` | default now |

### `discovery_response_options`

Used for selected choice values.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `response_id` | `uuid` | FK to response |
| `option_label` | `text` | stored snapshot of selected label |

## Why a separate model

`Discovery` must not be squeezed into the `Brief` tables for these reasons:

- sectioned thematic structure is a first-class concept
- response shapes differ materially from brief text/audio answers
- public customer experience is deeper and longer-lived
- future comparison and summarization needs are different

This separation lowers schema ambiguity and makes ownership, querying, and future extensions safer.

## Auth and Security

### Consultant-side routes

- require a Supabase session
- read the session via `getSupabaseRequestClient()`
- use `getSupabaseAdminClient()` for privileged reads and writes

### Public routes

- rely on the session token in `discovery_sessions.token`
- do not require a Supabase account
- must validate token existence before reading or writing

### Ownership rules

Consultant-side API routes must verify ownership on every operation involving:

- templates
- sessions
- reminders
- response reads

Ownership checks should be pushed into the query whenever possible, not only applied in memory after fetch.

## API Contract

### `POST /api/discovery/templates`

Creates or updates a full template.

Request body:

```json
{
  "id": "optional-template-id",
  "name": "Ledningsgrupp discovery",
  "introTitle": "Berätta vad ni behöver",
  "introText": "Välj det område som känns mest relevant och svara på frågorna.",
  "status": "draft",
  "sections": [
    {
      "id": "optional-section-id",
      "label": "Teamutveckling",
      "description": "Stärk samarbete, tillit och prestation i teamet.",
      "orderIndex": 0,
      "questions": [
        {
          "id": "optional-question-id",
          "type": "open",
          "text": "Vad fungerar bra i teamet idag och vad är den största utmaningen?",
          "orderIndex": 0
        }
      ]
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "templateId": "uuid"
}
```

### `GET /api/discovery/templates`

Returns the consultant's template list.

### `GET /api/discovery/templates/[id]`

Returns a full template graph:

- template
- sections
- questions
- options

### `POST /api/discovery/send`

Creates sessions and sends invites.

Request body:

```json
{
  "templateId": "uuid",
  "organisation": "Acme",
  "recipients": [
    {
      "name": "Anna Andersson",
      "email": "anna@example.com"
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "sent": 1,
  "sessionIds": ["uuid"]
}
```

### `GET /api/discovery/public/[token]`

Returns public content for one session.

### `POST /api/discovery/submit`

Saves all responses and marks the session submitted.

Request body:

```json
{
  "token": "uuid",
  "responses": [
    {
      "questionId": "uuid",
      "responseType": "open",
      "textValue": "..."
    },
    {
      "questionId": "uuid",
      "responseType": "scale",
      "scaleValue": 4
    },
    {
      "questionId": "uuid",
      "responseType": "choice",
      "selectedOptions": ["Alternativ A", "Alternativ B"]
    }
  ]
}
```

### `POST /api/discovery/remind`

Sends manual reminders for pending sessions owned by the current consultant.

This route must follow the same ownership and truthful result reporting standard now used by `/api/briefs/remind`.

## Builder State Strategy

The first production version should persist templates in the database and load them server-side or through authenticated API calls.

Temporary in-memory editing state in the builder is acceptable only while implementing save support, not as the final state model.

## Email Strategy

Discovery invite emails should follow the same operational pattern as Brief:

- send from the verified domain
- use `reply_to` as the consultant's email where available
- include a unique token-based public link

The email copy should position Discovery as a needs analysis rather than a short brief.

## Dashboard Views

### Template list

Required columns for the first version:

- template name
- last updated
- number of sections
- number of questions
- actions: edit, send

### Response list

Required filters for the first version:

- status
- organisation
- template

Required row fields:

- recipient name
- organisation
- template name
- status
- sent date
- submitted date

## Reporting and analysis

For v1, response review can be manual and consultant-facing:

- open a single response
- read responses grouped by section
- view recipient identity and submission metadata

AI summarization is explicitly deferred until the collection flow is stable.

## Migration and Rollout Plan

### Phase 1

- create normalized Discovery tables
- persist templates
- load templates into the builder

### Phase 2

- implement public token route
- implement submit API
- validate complete response flow end to end

### Phase 3

- implement send flow
- implement reminders
- implement response list and response detail

### Phase 4

- consider summaries, exports, and analytics

## Verification Requirements

A Discovery implementation task is not complete until:

- the current GitHub state was reviewed
- the relevant markdown instructions were read
- the feature inventory was updated
- the relevant docs under `docs/` were updated
- the nearest relevant verification step was run successfully

At minimum, a new Discovery backend or route change should be verified with:

- database migration review
- `npm run build`
- targeted manual smoke test of the affected route or flow

## Open Decisions

These decisions should be resolved before or during implementation:

1. Should Discovery sessions and dispatch metadata use dedicated metadata tables, or follow the current `settings` prefix pattern for operational metadata?
2. Should template duplication ship in v1 or wait?
3. Should public Discovery allow partial progress and draft resume, or only full submit?
4. Should scale questions ship in the first backend implementation, or should v1 be limited to `open` and `choice` to reduce complexity?

## Non-goals

This spec does not authorize:

- replacing Brief with Discovery
- merging the data models
- introducing new design tokens at this stage
- skipping documentation in favor of rapid implementation
