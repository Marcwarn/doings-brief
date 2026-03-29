#!/bin/bash
# Blockerar git commit om produktionskod andrats utan att dokumentationen uppdaterats.
# Kors av PreToolUse-hook i .claude/settings.json

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Kors bara vid git commit
if ! echo "$command" | grep -qE 'git\s+commit'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Kollar om nagon fil i app/ eller lib/ ar stagead (exklusive CLAUDE.md-filer)
staged_prod=$(git diff --cached --name-only 2>/dev/null | grep -E '^(app/|lib/)' | grep -v 'CLAUDE\.md')

# Om ingen produktionskod ar stagead, fortsatt
if [ -z "$staged_prod" ]; then
  exit 0
fi

# Kollar om app/CLAUDE.md eller docs/project_notes/ ocksa ar stagead
staged_docs=$(git diff --cached --name-only 2>/dev/null | grep -E '^(app/CLAUDE\.md|docs/project_notes/)')

if [ -z "$staged_docs" ]; then
  echo '{"decision": "block", "reason": "Produktionskod andrad men dokumentationen inte uppdaterad. Uppdatera app/CLAUDE.md (vad som ar byggt) eller relevant fil i docs/project_notes/ innan commit."}'
  exit 0
fi

exit 0
