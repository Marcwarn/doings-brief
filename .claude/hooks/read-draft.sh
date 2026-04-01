#!/bin/bash
# Läses vid SessionStart och injicerar draft.md + CLAUDE.md-påminnelse som additionalContext.
# Om draft.md är tom injiceras bara standardpåminnelsen.

DRAFT="$CLAUDE_PROJECT_DIR/docs/project_notes/draft.md"
REMINDER="VIKTIGT: Innan du foreslar vad som ska byggas eller antar att nagot saknas - las app/CLAUDE.md for att se vad som redan ar byggt. Gissa aldrig."

if [ -f "$DRAFT" ] && [ -s "$DRAFT" ]; then
  # Filtrera bort rader som bara är kommentarer eller headers (tomma drafts)
  REAL_CONTENT=$(grep -v '^[[:space:]]*$' "$DRAFT" | grep -v '^#' | grep -v '^>' | grep -v '^---' | grep -v '^<!--')
  if [ -n "$REAL_CONTENT" ]; then
    DRAFT_CONTENT=$(cat "$DRAFT")
    FULL_MSG=$(printf '%s\n\n--- DRAFT / WIP-ANTECKNINGAR (docs/project_notes/draft.md) ---\n%s' "$REMINDER" "$DRAFT_CONTENT")
    jq -n --arg msg "$FULL_MSG" '{"additionalContext": $msg}'
    exit 0
  fi
fi

jq -n --arg msg "$REMINDER" '{"additionalContext": $msg}'
