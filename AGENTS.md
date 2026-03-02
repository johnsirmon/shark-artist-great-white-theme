# AGENTS

Guidelines for any agent or automated session working in this repository.

## Before starting

Read `.learnings/ERRORS.md`, `.learnings/LEARNINGS.md`, and `.learnings/FEATURE_REQUESTS.md`. If any entries are `Priority: high` or `Priority: critical` with `Status: open`, resolve them or note a concrete next step.

## Theme rules

- **All six theme files** must be edited for every token or scope change — there is no shared base:
  - `great-white-dark-color-theme.json` · `great-white-light-color-theme.json`
  - `great-white-storm-color-theme.json` · `great-white-frost-color-theme.json`
  - `great-white-hc-dark-color-theme.json` · `great-white-hc-light-color-theme.json`
- Any token type changed in `tokenColors` **must** also be updated in `semanticTokenColors`.
- Coral (`#c44f5f`) and amber (`#d9a441`) are **reserved for diagnostics and diff-removed only** — never use as syntax accents.
- Version bumps require both `package.json` and `CHANGELOG.md` before packaging.
- Run `vsce package` to validate JSON before committing. Run `node .scripts/audit.js` to check contrast and coverage.

## Icon rules

- The authoritative icon process is documented in `docs/icon-update-process.md`.
- Active icons live in `icons/` and are mapped in `themes/great-white-agent-file-icons.json`.
- **File icon themes**: use SVG `iconPath` — do **not** include a `fonts` key (empty `fonts: []` crashes VS Code). Must include generic fallbacks (`_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`).
- **Product icon themes**: require font-based `fontCharacter` + `fontId`, not SVG. Keep as a minimal stub until a webfont is set up.
- **`.midjourney-workspace/` is experimental and local-only — never merge it to `main`.**

## Logging

If a mistake, learning, or feature request arises, append an entry to the matching `.learnings/` file before closing the session.

**ID format**: `ERR-YYYYMMDD-XXX`, `LRN-YYYYMMDD-XXX`, or `FEAT-YYYYMMDD-XXX` (zero-padded, sequential per day).

**Rules**:
1. Copy the Template block from the top of the target file.
2. Fill every field — write `n/a` if not applicable.
3. If the same `Pattern-Key` already exists in `LEARNINGS.md`, increment `Recurrence-Count` and raise `Priority` one level instead of adding a duplicate.

**Promotion**: If an entry reaches `Priority: high` / `Priority: critical` or `Recurrence-Count: 3`, add the rule to `.github/copilot-instructions.md` or this file, then set `Status: promoted` on the source entry.

## Custom agents

Four specialist agents are available in `.github/agents/`. Use them via `@agent-name` in Copilot:

| Agent | When to use |
|---|---|
| `@theme-editor` | Making any color or token change — enforces 6-file sync, reserved colors, WCAG contrast |
| `@theme-auditor` | Auditing all six variants for contrast, coverage, symmetry (extends `audit.js` to all variants) |
| `@learnings-clerk` | Logging to `.learnings/` or reviewing entries for promotion |
| `@release-manager` | Preparing a release — walks the checklist, validates package |
