# Discovery Data Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-03-30

## Purpose

`Data` is the fourth internal tab in the `Discovery` workspace.

It is not a raw export view. It is the interpretation layer where consultants can understand what has come in, see patterns across respondents, and generate analysis from different lenses without losing access to the underlying answers.

The goal is to make `Discovery` more than a send-and-collect flow. It should become a structured basis for understanding a client situation before the next step in the dialogue.

## Position in the Workflow

The intended editor flow in `/dashboard/discovery` becomes:

- `Frågor`
- `Upplägg`
- `Skicka`
- `Data`

This mirrors the actual consultant workflow:

1. shape the questions
2. frame the setup
3. send the material
4. interpret what came back

## Core Principles

1. `Data` must feel editorial and decision-oriented, not like a spreadsheet.
2. `Data` must always preserve a path back to the underlying answers.
3. AI analysis must be clearly framed as interpretation, not as source truth.
4. The first version should prioritize clarity and useful pattern recognition over broad analytics breadth.
5. Visualizations must support consulting judgment, not become decorative dashboard clutter.

## Primary Use Cases

### Response overview

The consultant wants to quickly understand:

- how many have responded
- which themes have the strongest signal
- whether there are clear tensions or recurring needs

### Theme interpretation

The consultant wants to open one theme and see:

- all responses for that theme
- short AI-supported synthesis
- repeated phrases or concerns
- differences between audience groups where relevant

### Perspective-based analysis

The consultant wants to run the same response set through different analytical lenses, for example:

- strongest shared challenge
- readiness for change
- leadership implications
- where expectations differ between groups
- what should be explored in the next conversation

## Scope

## In scope for first implementation

- a `Data` tab in `/dashboard/discovery`
- response status summary
- per-theme summary cards
- access to raw answers behind each summary
- AI-generated theme summaries
- AI-generated overall summary from a small set of predefined analysis perspectives

## Out of scope for first implementation

- free-form prompt writing by end users
- benchmarking across customers
- charts that require new event pipelines
- PDF/PowerPoint export
- automatic recommendations that trigger product actions

## Information Architecture

### Internal UI

The `Data` tab should be divided into four sections:

1. `Överblick`
2. `Teman`
3. `Analysvyer`
4. `Rådata`

### Suggested layout

- top summary strip
  - number of invites
  - number of submitted responses
  - response rate
  - last response timestamp
- theme grid
  - one card per enabled Discovery theme
  - signal strength, short summary, click into details
- analysis panel
  - choose one lens
  - generate or refresh AI analysis
  - show analysis text with clear label that it is AI-generated
- raw responses panel
  - searchable, grouped by respondent and theme

## Data Sources

The first version should rely on existing Discovery entities:

- `discovery_templates`
- `discovery_sections`
- `discovery_questions`
- `discovery_sessions`
- `discovery_responses`
- `discovery_response_options`

No new response storage model should be introduced for v1.

AI summaries may initially be cached in `settings`, following the existing pattern used elsewhere in the product, with keys such as:

- `discovery_data_summary:{templateId}`
- `discovery_theme_summary:{templateId}:{sectionId}`
- `discovery_analysis:{templateId}:{lens}`

If the volume grows or invalidation becomes complex, this can later move into dedicated summary tables.

## Analysis Lenses

The first version should not expose arbitrary prompting. It should offer a small set of named lenses with predictable outputs.

Recommended v1 lenses:

- `Gemensamma behov`
  - what themes and needs recur across respondents
- `Skillnader i perspektiv`
  - where answers diverge or tension appears
- `Beredskap för nästa steg`
  - signs of readiness, hesitation, or ambiguity
- `Vad bör utforskas vidare`
  - what the next dialogue or workshop should clarify

Each lens should use a fixed prompt template behind the scenes and make the framing visible in the UI.

## AI Summary Rules

AI analysis in `Data` must:

- only use submitted Discovery responses tied to the chosen template or send context
- clearly state which responses were included
- distinguish between direct observations and inferred interpretations
- link back to raw answers where possible

AI analysis must not:

- invent quantitative certainty
- hide disagreement between respondents
- present inferred conclusions as if they were explicit respondent statements

## Visualization Model

The visual style should stay consistent with the calmer Discovery language already established.

Recommended v1 visual elements:

- summary cards
- stacked response bars
- theme signal cards
- compact comparison blocks
- expandable quote or answer lists

Avoid in v1:

- complex charts
- 3D or novelty visualizations
- dense BI-style tables as the primary surface

## UX Requirements

### DR-1 Data tab entry

The `Data` tab should be visible even before responses exist, but show a calm empty state:

- explain that responses and analysis will appear here after send-out
- point to `Skicka` if nothing has been sent

### DR-2 Theme summaries

Each enabled theme should surface:

- number of respondents who answered
- short synthesis
- one or two representative excerpts where appropriate
- entry point to deeper raw answers

### DR-3 AI transparency

Every AI-generated block should clearly state:

- that it is AI-generated
- which lens was used
- when it was generated

### DR-4 Raw answer access

The consultant must always be able to move from summary to raw answer context.

### DR-5 Regeneration

The consultant should be able to rerun a summary or analysis when new responses have arrived.

## Permissions

Only the consultant who owns the Discovery template or its sessions may:

- open the `Data` tab
- view aggregated response content
- trigger AI analysis

No public or cross-consultant access is allowed.

## Suggested Implementation Phases

### Phase 1

- add `Data` as the fourth tab in `/dashboard/discovery`
- show response counts and theme cards
- show empty state when no responses exist

### Phase 2

- add theme summaries
- add raw answer drill-down

### Phase 3

- add predefined AI lenses
- cache AI outputs
- allow refresh/regenerate

## Open Questions

1. Should `Data` summarize per template or per send-out when a template is reused across multiple customers?
2. Should AI analysis be scoped to all responses for a template, or filtered by customer/organisation by default?
3. Should raw answers display respondent names by default, or should the product support anonymous reading modes later?
4. When a Discovery has only one respondent, should `Data` still show theme summaries or pivot to a more narrative single-response mode?
