# ADR-003: Berget AI for Transcription and Summarization

**Status**: Accepted
**Date**: 2024

## Context

Two AI capabilities are needed:
1. **Voice transcription**: Convert client audio recordings to text (Swedish speech)
2. **Brief summarization**: Generate structured Swedish-language analysis of submitted briefs

## Decision

Use Berget AI (Swedish AI infrastructure provider) with two models:
- `KBLab/kb-whisper-large` for transcription
- `meta-llama/Llama-3.3-70B-Instruct` for text generation

## Reasoning

- **Swedish language quality**: KB-Whisper is a Swedish-specific Whisper fine-tune from the National Library of Sweden (Kungliga Biblioteket). It handles Swedish accents, domain vocabulary, and mixed Swedish/English far better than base Whisper.
- **OpenAI-compatible API**: Berget uses the same request/response format as OpenAI. The transcription endpoint mirrors `POST /v1/audio/transcriptions` and the chat endpoint mirrors `POST /v1/chat/completions`. This means no Berget-specific SDK is needed — plain `fetch` calls work.
- **Swedish data residency**: Berget processes data in Sweden/EU, which matters for client data in a consulting context.
- **Llama-3.3-70B for summarization**: The model produces high-quality structured JSON output in Swedish when given explicit instructions. The system prompt enforces JSON keys (`summary`, `keySignals`, `risks`, `followUpQuestions`, `nextSteps`, `basedOn`) and Swedish-only output.

## Consequences

- **`maxDuration` limits**: Transcription is set to 60 seconds, summarization to 30 seconds (Vercel function duration caps). Large audio files may timeout on hobby tier deployments.
- **No streaming**: The current implementation collects the full response before returning. The summarize route uses `response_format: { type: 'json_object' }` which requires waiting for the complete output.
- **Single API key**: Both transcription and chat completions use the same `BERGET_API_KEY`. Rotate it in Vercel env vars and update the GitHub Secret if it changes.
- **FormData field naming**: The Berget transcription endpoint requires the audio field to be named `file` (not `audio`). The `/api/transcribe` route explicitly rebuilds the FormData to ensure this. Do not change this field name.
