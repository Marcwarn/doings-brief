# Discovery Audience Guidance

Status: Working recommendation

Owner: Doings Brief

Last updated: 2026-03-29

## Purpose

`Discovery` should not assume a single respondent type.

Some sends will target:

- only leaders
- only employees
- a full team
- a mixed group with leaders and employees in the same invite wave

That changes the language quality of the questions. A question that is clear for a leadership team can feel distant or abstract for employees, and a question written for employees can feel too operational for senior leaders.

This document recommends where one shared version is sufficient and where `Discovery` should later support audience-specific variants.

## Recommendation Summary

### Keep one shared version for now

These themes work well with broad, audience-neutral wording:

- `Teamutveckling`
- `Grupp som vill framåt`
- `Kommunikation`
- `Kultur`
- `Psykologisk trygghet`

These themes are usually about shared experience, collaboration, and day-to-day behavior. A single version works if the wording stays concrete and avoids assuming formal authority.

### Plan two variants later

These themes are more sensitive to who is answering and should eventually support at least:

- `Ledarperspektiv`
- `Blandad grupp / team`

Themes:

- `Ledarskap`
- `Change management`
- `AI readiness`
- `Vision & mål`

These themes shift significantly depending on whether the respondent has formal responsibility, influence without mandate, or only receives decisions from others.

### Consider optional variants later

These themes may eventually benefit from narrower variants, but they do not require it in v1:

- `Employer branding`
- `Försäljning`

They often depend more on business context than on hierarchy alone. For now, shared wording is acceptable.

## Theme-by-Theme Guidance

### Teamutveckling

Recommendation: shared version

Why:

- team language is naturally collective
- works for leaders, members, and mixed teams
- the key is to ask about what people notice in practice

Writing guidance:

- prefer `ni`, `teamet`, `i vardagen`
- avoid assuming the respondent manages others
- ask for concrete signs rather than abstract aspirations

### Ledarskap

Recommendation: split later into `Ledarperspektiv` and `Blandad grupp`

Why:

- leaders can answer about expectations, capability, follow-up, and role clarity
- employees often answer from experience of leadership rather than ownership of it

Risk if kept too generic:

- questions become vague and safe
- answers blur together between “what leaders do” and “how leadership is experienced”

Suggested future distinction:

- `Ledarperspektiv`: expectations on leaders, leadership capability, follow-up, leadership behaviors
- `Blandad grupp`: how leadership is experienced, where support is missing, what creates trust and clarity

### Change management

Recommendation: split later into `Ledarperspektiv` and `Blandad grupp`

Why:

- leaders can speak about mandate, sponsorship, sequencing, and execution
- employees and mixed groups can better speak about clarity, trust, overload, and local consequences

Suggested future distinction:

- `Ledarperspektiv`: mandate, ownership, change capacity, sponsor alignment
- `Blandad grupp`: understanding, buy-in, practical implications, communication quality

### AI readiness

Recommendation: split later into `Ledarperspektiv` and `Blandad grupp`

Why:

- leaders often focus on strategy, governance, priorities, and investment
- employees often focus on confidence, usability, relevance, and change in daily work

Suggested future distinction:

- `Ledarperspektiv`: ambition, governance, prioritization, capability build
- `Blandad grupp`: confidence, experimentation, support, practical use

### Grupp som vill framåt

Recommendation: shared version

Why:

- the theme is already about collective movement
- it works well for leadership teams, project groups, and mixed groups

Writing guidance:

- use language about direction, decisions, and momentum
- avoid over-specifying formal roles

### Kommunikation

Recommendation: shared version

Why:

- the best questions are about clarity, consistency, courage, and everyday communication
- those are observable regardless of role

Writing guidance:

- ask what people notice
- avoid making everything about official communication channels

### Employer branding

Recommendation: shared version for now, optional split later

Why:

- the topic spans talent attraction, internal reality, and ambassador behavior
- leadership and employee perspectives differ, but not enough to require a split in v1

Potential later variants:

- `Talent/HR perspective`
- `Employee reality perspective`

### Kultur

Recommendation: shared version

Why:

- culture is lived by everyone
- strong questions ask about observable behaviors, not only leadership intent

Writing guidance:

- ask what people are proud of, what they tolerate, and what they want more of
- use practical language instead of abstract “culture work” wording

### Psykologisk trygghet

Recommendation: shared version

Why:

- the core signal is lived experience
- both leaders and employees can answer meaningfully if questions stay concrete

Writing guidance:

- ask about speaking up, asking for help, disagreeing, and handling mistakes
- avoid academic wording

### Försäljning

Recommendation: shared version for now, optional split later

Why:

- some sends may go to sellers, some to sales leaders, some to mixed commercial teams
- broad wording works if it centers on customer dialogue and support, not only quotas

Potential later variants:

- `Säljledarskap`
- `Säljbeteenden i vardagen`

### Vision & mål

Recommendation: split later into `Ledarperspektiv` and `Blandad grupp`

Why:

- leaders can answer about strategy, priorities, and alignment mechanisms
- employees answer more clearly on meaning, clarity, and local ownership

Suggested future distinction:

- `Ledarperspektiv`: strategic clarity, cascades, follow-up, ownership
- `Blandad grupp`: meaning, relevance, connection to everyday work

## Practical Product Recommendation

Do not create multiple variants for every theme immediately.

Instead:

1. Keep the current broad versions as the default.
2. Add an internal metadata field later for each theme:
   - `shared`
   - `leader_variant_recommended`
   - `optional_variant_later`
3. Build v2 variant support only for the four themes that clearly benefit from it:
   - `Ledarskap`
   - `Change management`
   - `AI readiness`
   - `Vision & mål`

## Suggested Future Data Shape

If theme variants are added later, prefer a lightweight model:

- `audience_mode` on template or section
  - `shared`
  - `leaders`
  - `mixed`

Do not duplicate the entire `Discovery` model unless variants become a core feature.

## Editorial Rule

When writing `Discovery` questions:

- prefer concrete observation over abstract ambition
- prefer `hur märks det`, `vad fungerar`, `vad skaver`, `vad skulle ni märka` over generic consulting language
- avoid assuming the respondent has formal authority unless the theme is explicitly leader-targeted
- write so both a leader and a team member can answer without feeling they got the wrong form
