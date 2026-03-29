# Discovery AI Analysis Specification

Status: Draft for implementation

Owner: Doings Brief

Last updated: 2026-03-30

## Purpose

This specification defines how AI analysis in `Discovery Data` should work.

The goal is not to produce a generic summary. The goal is to create consultant-grade interpretation that:

- stays grounded in the actual responses
- separates observation from inference
- makes disagreement visible
- helps the consultant decide what to explore next

## Design Principles

1. AI must never feel like a black box that "understood everything".
2. Every analysis should be traceable back to raw answers.
3. The model must distinguish between:
   - what respondents explicitly said
   - what can reasonably be inferred
   - what still needs clarification
4. The product should favor strong structure over free-form prompting in v1.
5. Different analytical questions require different prompt contracts.

## Scope

## In scope for first implementation

- fixed analysis lenses
- one overall analysis per selected scope
- one theme-specific analysis per selected theme
- JSON-shaped output contract from the model
- explicit rendering of:
  - observations
  - differences
  - uncertainties
  - next-step questions

## Out of scope for first implementation

- end-user authored prompts
- fully open-ended chat with the dataset
- auto-generated recommendations that trigger downstream workflows
- cross-customer benchmarking

## Source Material

Every analysis request must declare exactly which material is included.

That scope should include:

- template id
- selected filters
- audience mode
- number of respondents
- selected theme or "all themes"
- normalized response payloads

The model should not receive more text than needed. Preprocessing should prepare:

- theme labels
- respondent metadata needed for context
- grouped answers
- short excerpts where available

## Analysis Modes

### Mode 1: Overall analysis

Used when the consultant wants a broad reading of the current response set.

Questions this mode should answer:

- what seems to matter most across the material?
- where is there alignment?
- where is there tension or divergence?
- what appears most important to clarify next?

### Mode 2: Theme analysis

Used when the consultant focuses on one theme.

Questions this mode should answer:

- what patterns appear inside this theme?
- what is respondents' strongest shared signal?
- where do perspectives diverge?
- what would be most useful to explore in the next conversation?

## Fixed Analysis Lenses

The first version should use a small set of opinionated lenses instead of free prompting.

### Lens: `Gemensamma behov`

Purpose:

- identify the needs, challenges, or aspirations that recur most clearly

Should emphasize:

- repeated signals
- recurring phrasing or concerns
- what multiple respondents seem to point toward

### Lens: `Skillnader i perspektiv`

Purpose:

- surface disagreements, mismatches, or uneven understanding

Should emphasize:

- where respondents seem to describe the situation differently
- where leadership and employee-facing experiences may differ
- where certainty is low because the picture is fragmented

### Lens: `Beredskap för nästa steg`

Purpose:

- assess whether the material indicates clarity, readiness, hesitation, or ambiguity

Should emphasize:

- confidence versus hesitation
- signs of energy versus resistance
- what suggests the group is ready for action versus more clarification

### Lens: `Vad bör utforskas vidare`

Purpose:

- help the consultant prepare the next dialogue, workshop, or scoping step

Should emphasize:

- what is still unclear
- what needs validation
- which questions are most worth asking next

## Output Contract

The model should return structured JSON, not free text.

Suggested top-level shape:

```json
{
  "lens": "Gemensamma behov",
  "scope": {
    "template_id": "uuid",
    "theme_id": "optional",
    "respondent_count": 18,
    "audience_mode": "mixed"
  },
  "summary": "Short plain-language synthesis",
  "observations": [
    {
      "title": "Observation title",
      "detail": "What respondents explicitly point to",
      "confidence": "high|medium|low"
    }
  ],
  "differences": [
    {
      "title": "Difference title",
      "detail": "Where perspectives diverge",
      "confidence": "high|medium|low"
    }
  ],
  "uncertainties": [
    {
      "title": "What remains unclear",
      "detail": "Why this still needs clarification"
    }
  ],
  "next_questions": [
    "Question to explore next"
  ],
  "evidence": [
    {
      "theme_id": "uuid",
      "respondent_label": "optional short label",
      "excerpt": "Short supporting excerpt"
    }
  ]
}
```

## Rendering Rules

The UI should render the result in clearly separated blocks:

- `Kort läsning`
- `Det som återkommer`
- `Det som skiljer sig`
- `Det vi inte vet ännu`
- `Bra frågor till nästa steg`
- `Underlag ur svaren`

The UI must not collapse everything into one paragraph.

## Prompt Rules

Every prompt should include these instructions:

1. Only use the provided responses and metadata.
2. Do not invent certainty.
3. Separate direct observations from possible interpretations.
4. Make disagreements visible when they exist.
5. If the material is thin, say that clearly.
6. Write in Swedish.
7. Keep the tone calm, specific, and consultant-usable.

## Guardrails

The model must not:

- claim consensus where responses clearly diverge
- produce generic consulting language detached from the material
- recommend a solution as if it is already agreed
- infer causes without marking them as interpretation
- present quotations that do not exist in the input

## Sparse Data Rules

When the number of responses is low, the model should adapt.

### 1 to 3 responses

The analysis must:

- avoid broad generalizations
- emphasize that the picture is preliminary
- focus more on specific observations and open questions

### 4 to 8 responses

The analysis may:

- begin to group repeating signals
- still be cautious about claiming broad alignment

### 9+ responses

The analysis may:

- talk more confidently about recurring patterns
- compare themes or clusters more explicitly

## Theme Analysis Prompt Contract

A theme-level prompt should ask for:

- one concise synthesis
- up to three explicit observations
- up to two meaningful differences
- up to three follow-up questions
- two to four supporting excerpts

## Overall Analysis Prompt Contract

An overall prompt should ask for:

- one concise synthesis of the whole response set
- strongest recurring needs
- strongest points of divergence
- readiness assessment
- recommended next questions for the consultant

## Caching Strategy

AI outputs may be cached in `settings` initially.

Suggested keys:

- `discovery_analysis:overall:{templateId}:{scopeHash}:{lens}`
- `discovery_analysis:theme:{templateId}:{themeId}:{scopeHash}:{lens}`

The `scopeHash` should change when the included sessions or filters change.

## Verification Checklist

Before an analysis implementation is considered done, verify that:

1. the model output is valid JSON
2. observations can be traced back to raw answers
3. disagreement appears when disagreement exists
4. sparse datasets produce cautious wording
5. the UI distinguishes observation, inference, and open questions
6. everything is rendered in Swedish
