# Discovery Admin Experience Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-04-13

## Purpose

`Discovery` needs an internal experience that feels like a premium consulting product, not a thin admin layer over stored responses.

The consultant should be able to move from:

1. customer
2. Discovery case
3. pattern
4. evidence
5. next conversation

without getting lost in raw sessions, template ids, or flat response lists.

This specification defines the intended admin experience for `Discovery` after sending has begun and answers have started to come in.

## Problem Statement

The current internal experience has the right building blocks, but it does not yet feel sufficiently customer-centered or analytically mature.

The main gaps are:

- no strong customer-first landing experience for consultants managing many customers
- no obvious path from one customer to all relevant Discovery rounds and responses
- limited visual distinction between orientation, interpretation, and raw data
- too much reliance on lists and technical structure instead of decision-oriented views
- no clearly productized visual model for reading `Likert`, scale, and open-text responses at a glance

The result is that `Discovery` works operationally, but does not yet feel like a world-class discovery survey product in the admin layer.

## Product Goal

The internal `Discovery` experience should help a consultant answer three questions quickly:

1. which customer am I looking at?
2. what has come in?
3. what does it mean?

The interface must feel:

- calm
- editorial
- customer-centered
- signal-first
- evidence-backed

It must not feel like:

- a spreadsheet
- a mail-log
- a generic BI dashboard
- a developer-facing data browser

## Primary User

The primary user is the Doings consultant.

This user is not trying to inspect database objects. The consultant is trying to:

- understand a customer context
- prepare for a meeting
- see whether enough answers have come in
- spot alignment, tension, and risk
- turn responses into a better next conversation

## Core Principles

1. Customer first, sessions second.
2. Signal before raw data.
3. Interpretation must always point back to evidence.
4. Visualizations should simplify judgment, not add dashboard clutter.
5. The interface must stay elegant under both low and high response volume.
6. Anonymous and named response modes must both feel natural in the same surface.

## Entry Hierarchy

The internal admin hierarchy should be:

1. customer
2. Discovery case
3. view mode
4. theme
5. evidence

The consultant should never land first in a generic list of sessions if there is customer context available.

## Information Architecture

### Level 1: Discovery Home

`/dashboard/discovery`

This page should act as the consultant's Discovery home, not only as a builder.

It should support two distinct modes:

- `Skapa`
- `Kunder & data`

The current builder can remain a main surface, but the response and interpretation side needs a clearer customer-first entry point.

### Level 2: Customer Overview

The first analytic landing view should be a customer grid or list.

Each customer card should show:

- customer name
- number of Discovery rounds
- total submitted responses
- latest response date
- response rate where relevant
- current activity state

Suggested states:

- `Utkast`
- `Skickad`
- `Pågår`
- `Klar för analys`

### Level 3: Customer Detail

When a customer is selected, the consultant should see all relevant Discovery rounds for that customer.

Each Discovery case should show:

- name of the Discovery
- date range or send date
- response mode
- number invited
- number answered
- response rate
- latest activity
- quick actions:
  - open data
  - copy link
  - remind
  - open setup

### Level 4: Discovery Case

A single Discovery case should open into a structured internal workspace with three top-level tabs:

- `Översikt`
- `Svar`
- `Insikter`

Optional later tab:

- `Utskick`

This should replace the feeling of "everything in one long admin surface".

## Screen Model

## 1. Overview

Purpose:

- orient the consultant quickly
- summarize current state
- identify where to look next

This screen should include:

- top summary row
  - invited
  - submitted
  - response rate
  - latest response
- customer/context header
  - customer
  - Discovery name
  - response mode
  - date sent
- theme cards
  - one card per enabled theme
  - short synthesis
  - answer count
  - signal strength
  - split marker

The `Overview` tab is not where the consultant reads everything. It is where the consultant gets oriented.

## 2. Answers

Purpose:

- make raw answers readable
- support trust and validation
- preserve nuance

This screen should support:

- filtering by theme
- filtering by respondent group
- filtering by anonymous vs named
- search in open text
- open one respondent or submission at a time

Display rules:

- named responses: show person and context clearly
- anonymous responses: show response entry and demographic context if present
- do not flatten all answers into one undifferentiated list

The consultant should be able to pivot between:

- by respondent
- by theme
- by question

## 3. Insights

Purpose:

- translate responses into consulting signal
- highlight patterns, gaps, and tensions

This screen should include:

- selected analytical lens
- short synthesis
- strongest signals
- strongest disagreements
- what needs follow-up
- direct links back to source evidence

Every interpretation should feel grounded and readable in a meeting-prep context.

## Visualizations

## General Rules

Visualizations must feel calm, sparse, and premium.

Do:

- use restrained bars, matrices, heat surfaces, and distributions
- keep chart count low
- label insights in plain language
- use whitespace generously

Do not:

- overload with dashboard widgets
- use decorative chart noise
- show data just because it exists

## Scale Questions

For standard scale questions, the preferred visual is:

- response distribution bar
- median or average marker if useful
- short label:
  - `lågt`
  - `blandat`
  - `högt`

These should be readable without statistical training.

## Likert Questions

`Likert` in `Discovery` is two-dimensional:

- agreement
- importance

This should not be visualized as a single average.

Preferred model:

- a 2x2 insight matrix

Axes:

- x-axis: agreement
- y-axis: importance

Quadrants:

- high agreement / high importance = strength to build on
- low agreement / high importance = urgent development area
- high agreement / low importance = stable but lower priority
- low agreement / low importance = weak signal or low relevance

This is the most important future visualization in the Discovery admin experience.

## Open Text

Open text should be handled in two layers:

- short thematic synthesis
- expandable underlying quotes or excerpts

The consultant should always be able to move from summary to real language quickly.

## Choice Questions

Choice questions should use:

- ranked bars
- selected count
- share of respondents

When max choices > 1, the visualization should not imply exclusive choice unless the data actually is exclusive.

## Customer-Centered Navigation

When many customers exist, the product should help the consultant stay oriented.

The global Discovery surface should include:

- customer search
- latest activity sort
- active / completed filters
- saved drafts separated from active Discovery cases

The admin should feel like a customer portfolio view, not just a template archive.

## Named and Anonymous Response Handling

The UI must support both modes elegantly.

### Named mode

Show:

- person
- email when relevant
- role where present

### Anonymous mode

Show:

- submission entry
- role/team if provided
- grouped summaries before raw entry detail

Anonymous mode must not feel like a degraded experience.

## Consultant Actions

At the case level the consultant should be able to:

- remind pending respondents
- copy active link
- open setup
- see current response state
- switch from overview to source answers quickly

These actions should stay secondary to the data, not dominate the layout.

## Recommended Route Model

The product can keep the current route structure, but the intended UX should move toward:

- `/dashboard/discovery`
  - creation + customer-first entry point
- `/dashboard/discovery/data`
  - customer portfolio view
- `/dashboard/discovery/data/[customerKey]`
  - customer detail
- `/dashboard/discovery/data/[customerKey]/[templateId]`
  - case overview, answers, insights

If route changes are too heavy in v1, the same model can first be implemented inside the existing `Data` tab.

## V1 Build Recommendation

The first serious admin upgrade should focus on:

1. stronger customer portfolio entry
2. cleaner customer detail view
3. improved case overview
4. better theme cards
5. better raw-answer reading modes
6. first `Likert` matrix visualization

This is enough to materially improve consultant confidence without rebuilding the entire Discovery product.

## V2 Build Recommendation

Later improvements can include:

- saved views
- compare segments
- compare two Discovery rounds for the same customer
- export-ready summary layouts
- reusable meeting-prep summary
- stronger dispatch/outreach history for each case

## Design Direction

The intended feel is:

- Apple-like simplicity
- consulting-grade calm
- strong hierarchy
- no redundancy
- no exposed internal mechanics

The admin should feel like a premium interpretation workspace, not a technical back office.

## Relationship to Existing Specs

This specification extends:

- `docs/specs/discovery.md`
- `docs/specs/discovery-data.md`
- `docs/specs/discovery-customer-and-anonymous.md`
- `docs/specs/discovery-ai-analysis.md`

Where these documents define structure and analysis behavior, this spec defines the desired end-to-end admin experience and product feel.
