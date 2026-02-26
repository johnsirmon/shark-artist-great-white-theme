# AGENTS

Guidelines for any agent or automated session working in this repository.

## After every task

1. Open `.learnings/ERRORS.md`, `.learnings/LEARNINGS.md`, and `.learnings/FEATURE_REQUESTS.md`.
2. If any entries are `Priority: high` or `Priority: critical` and `Status: open`, either resolve them in this session or note a concrete next step in the entry.
3. If a `Pattern-Key` has `Recurrence-Count: 3` or more, promote the pattern to `.github/copilot-instructions.md` or to this file, then set `Status: promoted` on the source entry.

## Theme-specific rules

- Always edit both `themes/great-white-dark-color-theme.json` and `themes/great-white-light-color-theme.json` for every change.
- Any token type changed in `tokenColors` must also be updated in `semanticTokenColors`.
- Coral (`#c44f5f`) and amber (`#d9a441`) are reserved for diagnostics and diff-removed only.
- Version bumps require both `package.json` and `CHANGELOG.md` to be updated before packaging.
- Run `vsce package` to validate before committing.

## Logging

If a mistake, correction, or feature request arises during a task, append an entry to the matching
`.learnings/` file before closing the session. See `.github/copilot-instructions.md` Self-Improvement
section for ID format and field requirements.
