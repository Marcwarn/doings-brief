# Discovery Customer and Anonymous Response Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-03-30

## Purpose

This specification defines two product rules for `Discovery`:

1. `Data` should be customer-first, not respondent-first.
2. `Discovery` should support both named and anonymous response modes.

These rules affect the send flow, the response model, and the internal interpretation workspace.

## Customer-First Data Model

The first meaningful unit in `Discovery Data` is usually the customer or organisation, not the individual person.

Consultants typically want to answer:

- what are we hearing from `Acme`?
- which customers have answered?
- which customer should we open next?

They do not usually start from:

- which individual person should I inspect first?

### Product rule

The default `Data` entry point should therefore group responses by customer or organisation first.

The navigation hierarchy should be:

1. customer
2. respondent or subgroup
3. themes, analysis, and raw answers

### UI implications

The first `Data` view should show cards or rows for customers, not people.

Each customer item should show:

- customer or organisation name
- number of invites
- number of submitted responses
- response rate
- latest response timestamp
- whether the material is named or anonymous

Opening a customer should then reveal:

- overview
- named respondents when applicable
- theme-level interpretation
- raw answers

## Anonymous Response Mode

Some `Discovery` sends should allow more open input by removing personal identification from the response flow.

This should be treated as a first-class send mode, not as an afterthought.

### Supported modes

`Discovery` should support:

- `named`
- `anonymous`

### Named mode

In named mode:

- each recipient gets a personal link
- responses are tied to a specific session and person
- `Data` may show respondent names
- reminders can be sent per person

### Anonymous mode

In anonymous mode:

- the send flow should generate a customer-level link or link set intended for anonymous participation
- responses should not expose respondent identity in internal data views
- reminders should target the shared distribution mechanism, not a named person
- AI analysis should know that the underlying material is anonymous

### Product rule

The send flow must make the response mode explicit before the invite is sent.

The consultant should understand:

- whether replies will be attributable to individuals
- whether `Data` will show names or only anonymous entries

## Data View Rules by Mode

### Named mode

Customer-level navigation should still come first, but the consultant may drill down into named respondents under each customer.

The order becomes:

1. customer
2. person
3. theme and answer interpretation

### Anonymous mode

Customer-level navigation should remain the first level, but there is no person-level drill-down by name.

Instead, the order becomes:

1. customer
2. anonymous response entries or grouped answer sets
3. theme and answer interpretation

Anonymous entries may still be separated as:

- `Svar 1`
- `Svar 2`
- `Svar 3`

but not by personal identity.

## First Implementation Recommendation

For the first implementation:

1. Make the `Data` landing view customer-first.
2. Add `response_mode` to `Discovery` sends and sessions.
3. Support named mode first in the current send flow.
4. Add anonymous mode as a separate send option next, without weakening named mode.

This preserves the current functionality while establishing the correct information architecture.

## Non-Goals

This specification does not require:

- anonymous free-for-all public links with no customer context
- cross-customer benchmarking
- mixed named and anonymous answers inside the same session without explicit product design
