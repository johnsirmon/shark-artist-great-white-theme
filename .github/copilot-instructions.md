# Copilot Instructions

This repository is a VS Code theme extension with:
- six color theme variants,
- one file icon theme,
- one product icon theme,
- one injected Markdown grammar for agent/instruction files.

There is no generated source and no shared theme base; JSON files under `themes/` are the source of truth and are maintained directly.

## Build, test, and lint commands

There are no npm scripts (`package.json` has no `scripts` block), so use direct commands:

```bash
npm install -g @vscode/vsce          # one-time tool install
vsce package                         # primary build/validation; produces .vsix
node .scripts/audit.js               # audit (human-readable), exits 1 on high severity
node .scripts/audit.js --json        # audit (machine-readable JSON)
```

Targeted/“single-check” validation commands:

```bash
vsce package --no-git-tag-version    # validate package without tagging behavior
node .scripts/improve-loop.js --dry-run --report audit-report.json
```

CI details:
- `.github/workflows/ci.yml` runs `vsce package` on every PR and push to `main`.
- `.github/workflows/self-improve.yml` runs monthly/on-demand audits and only writes `.learnings/` entries (draft PR flow, no publish).

## High-level architecture

### 1) Extension manifest and registrations
- `package.json` registers all extension contributions:
  - `contributes.themes` (6 variants),
  - `contributes.iconThemes` (`themes/great-white-agent-file-icons.json`),
  - `contributes.productIconThemes` (`themes/great-white-product-icons.json`),
  - `contributes.grammars` (Markdown injection from `syntaxes/agents-md.tmLanguage.json`).

### 2) Theme variant model
- Six independent theme JSON files live in `themes/`:
  - Dark / Light are canonical references.
  - Storm / Frost are alternate dark/light palettes.
  - HC Dark / HC Light target accessibility (`hc-black` / `hc-light`).
- Each theme file is intentionally self-contained (no inheritance).
- Each theme JSON keeps three top-level sections in order:
  1. `colors`
  2. `tokenColors`
  3. `semanticTokenColors`

### 3) Validation and automation layer
- `.scripts/audit.js` is the policy checker:
  - required workbench keys,
  - required semantic token keys,
  - required TextMate scopes,
  - contrast checks,
  - dark/light symmetry and terminal ANSI parity.
- `.scripts/improve-loop.js` is a safe automation loop:
  - consumes audit output,
  - applies only limited auto-fix logic,
  - validates with `vsce package`,
  - logs outcomes to `.learnings/`.

### 4) Icon and grammar subsystems
- `themes/great-white-agent-file-icons.json` maps SVG icons in `icons/` to file/folder names and extensions.
- `themes/great-white-product-icons.json` is font-based (Codicon TTF in `icons/codicon.ttf`).
- `syntaxes/agents-md.tmLanguage.json` injects into Markdown (`text.html.markdown`) and highlights instruction callout prefixes used in agent docs.

## Key conventions

### Cross-variant editing rules
- Any token/scope change must be applied across all six theme variants (no shared base).
- For any token family change, keep `tokenColors` and `semanticTokenColors` aligned; semantic rules override TextMate when language servers provide semantic tokens.
- Workbench-only tweaks may be variant-specific, but keep intentional variant relationships consistent (Dark/Light reference pair; Storm/Frost alternate pair; HC pair for strict contrast).

### Color and accessibility constraints
- Coral `#c44f5f` is reserved for errors/diagnostics.
- Amber `#d9a441` is reserved for warnings and diff-removed contexts.
- Do not reuse reserved warm colors as general syntax accents.
- Comments are intentionally italic; preserve `fontStyle: "italic"` on comment scopes.
- Terminal ANSI keys should stay identical across all six variants.
- Token colors should remain WCAG AA (>= 4.5:1) against each variant background.

### Icon schema constraints
- File icon themes must use SVG `iconPath` definitions.
- Do not add a `fonts` key to file icon themes (including empty arrays).
- Because VS Code supports only one active file icon theme, keep generic fallbacks:
  - `_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`.
- Product icon themes are font-glyph based (`fontCharacter` + `fontId`), not SVG path-based.

### Release and artifact conventions
- Version bumps require both:
  - `package.json` version update, and
  - matching `CHANGELOG.md` entry.
- `vsce package` is required before release and generated `.vsix` artifacts are committed at repo root.
- Use `docs/release-checklist.md` for publish steps (`vsce login shark-labs`, `vsce publish`).

### Learning log protocol
- Read `.learnings/ERRORS.md`, `.learnings/LEARNINGS.md`, and `.learnings/FEATURE_REQUESTS.md` at session start.
- When adding entries, follow template/ID/status rules in `AGENTS.md`.
- If a pattern recurs or rises to high/critical priority, promote the rule into this file or `AGENTS.md`.

## Custom agents

Use repository-specific agents from `.github/agents/` when applicable:
- `@theme-editor` — multi-variant token/color edits with rule enforcement.
- `@theme-auditor` — cross-variant contrast/coverage/symmetry audits.
- `@learnings-clerk` — `.learnings/` logging and dedup/promotion workflow.
- `@release-manager` — release checklist and packaging/publish readiness.
