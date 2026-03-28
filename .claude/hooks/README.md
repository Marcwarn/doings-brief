# Claude Code Hooks

This directory contains hook configurations for Claude Code automation.

## Current Status

No post-edit hooks are configured because this project has no auto-formatter (Prettier, ESLint auto-fix) set up to run on save. TypeScript type checking is done via `npm run build`.

## If You Add a Formatter

If Prettier is added to the project, a PostToolUse hook can auto-format edited files. Add this to `.claude/settings.json` under a `hooks` key:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATH"
          }
        ]
      }
    ]
  }
}
```

## Safety Notes

- Never add a hook that runs database migrations automatically
- Never add a hook that pushes to git without explicit confirmation
- The `deny` list in `settings.json` protects against destructive Supabase operations
