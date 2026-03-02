# Copilot Instructions

A VS Code color theme extension — six variants plus a file icon theme, product icon theme, and an agents-markdown grammar. All work happens in the theme JSON files under `themes/` and `package.json`. There is no shared base file; each variant is fully self-contained.

## Commands

No npm scripts exist. Use `vsce` directly:

```bash
npm install -g @vscode/vsce   # one-time
vsce package                  # produces a .vsix, validates JSON; same as CI
node .scripts/audit.js        # contrast + coverage check (exits 1 on high-severity)
node .scripts/audit.js --json # machine-readable audit output
```

CI runs `vsce package` on every push to `main` and every PR.

## Making changes

**Token or color change** — must touch **all six** theme files:
1. `great-white-dark-color-theme.json` · `great-white-light-color-theme.json`
2. `great-white-storm-color-theme.json` · `great-white-frost-color-theme.json`
3. `great-white-hc-dark-color-theme.json` · `great-white-hc-light-color-theme.json`

For any token type, update it in **both** `tokenColors` (TextMate) **and** `semanticTokenColors` — semantic rules silently override TextMate in language-server-supported files.

**Variant relationships:**
- **Dark / Light**: the reference pair; canonical token colors.
- **Storm**: cooler, higher-contrast dark (editor bg `#111820`).
- **Frost**: colder, slightly muted light.
- **HC Dark / HC Light**: high-contrast accessibility (`hc-black` / `hc-light`) — push contrast further, no decorative accents.

**Release:**
1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Run `vsce package` — commit the generated `.vsix` to the repo root.
3. See `docs/release-checklist.md` before `vsce publish`.

## Theme file structure

Each theme JSON has exactly three top-level sections in this order:

1. `colors` — Workbench UI (editor surfaces, sidebar, activity bar, tabs, status bar, terminal ANSI, diff, diagnostics)
2. `tokenColors` — TextMate grammar scopes (all languages)
3. `semanticTokenColors` — Semantic token overrides (language-server languages; wins over TextMate)

## Key conventions

- **All six files for token changes** — there is no shared base. Workbench-only changes may target specific variants.
- **`tokenColors` and `semanticTokenColors` must stay in sync** for every token type.
- **Reserved colors**: coral (`#c44f5f`) for errors/diagnostics, amber (`#d9a441`) for warnings/diff-removed — never use as general syntax accents.
- **Comments are intentionally italic** (`"fontStyle": "italic"`) — do not remove.
- **Terminal ANSI values are identical** across all variants — keep them in sync.
- **`.vsix` files are committed** to the repo root as release artifacts.
- **Version bumps** require both `package.json` and `CHANGELOG.md` before packaging.
- All token colors must be WCAG AA verified (≥4.5:1) against their variant's background. See palette in `README.md` and rationale in `prd.md`.

## Icon theme constraints

- **File icon themes** — use SVG `iconPath` in `iconDefinitions`. Do **not** include a `fonts` key (not even `"fonts": []`); VS Code crashes if the array is empty.
- **File icon exclusivity** — VS Code allows only one file icon theme. Must include generic fallbacks (`_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`).
- **Product icon themes** — require font-based icons (`fontCharacter` + `fontId`), not SVG. Keep `great-white-product-icons.json` as a minimal stub until a webfont is set up.

## Documentation grammar

The TextMate grammar in `syntaxes/agents-md.tmLanguage.json` injects into Markdown and highlights callout prefixes:
- **Error Red**: `CRITICAL:` / `IMPORTANT:` / `NEVER:` / `DO NOT:`
- **Warning Amber**: `WARNING:` / `CAUTION:` / `DEPRECATED:`
- **Info Blue**: `NOTE:` / `TIP:` / `INFO:` / `SEE ALSO:`
- **Constant**: `TODO:` / `FIXME:` / `HACK:`

## Self-improvement

The `.learnings/` directory logs mistakes, patterns, and feature requests. Consult it at the start of each session. Log new entries before closing a session — see `AGENTS.md` for the full protocol and ID format (`LRN-YYYYMMDD-XXX`, `ERR-YYYYMMDD-XXX`, `FEAT-YYYYMMDD-XXX`).

## Custom agents

Four specialist agents in `.github/agents/` can be invoked via `@agent-name`:
- **`@theme-editor`** — color/token changes across all six variants
- **`@theme-auditor`** — audit all six variants for contrast, coverage, and symmetry
- **`@learnings-clerk`** — manage `.learnings/` entries and promotions
- **`@release-manager`** — walk the release checklist and validate packaging
