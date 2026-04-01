# Copilot Instructions

VS Code extension repo for the Great White theme family: six standard variants, a special `Bloodloss` overflow theme, an agent-focused file icon theme, a product icon theme stub, and a Markdown injection grammar for agent instruction files.

## Build and validation commands

```bash
npm run build             # bundle src/extension.ts -> dist/extension.js with sourcemaps
npm run watch             # rebuild on change while working on extension/runtime code
npm run vscode:prepublish # minified bundle used before packaging/publishing
node .scripts/audit.js        # dark/light theme audit: required keys, token coverage, WCAG checks, ANSI parity
node .scripts/audit.js --json # same audit as machine-readable JSON
vsce package                  # CI/release gate; creates the .vsix
```

There is no automated unit-test or lint task in this repo. For a focused manual check, press `F5` to open an Extension Development Host, then inspect only the surface you changed (theme picker, mapped file icons, Markdown callouts, diff editor, or terminal).

## High-level architecture

- `package.json` is the composition root. It defines the esbuild-based extension bundle, registers four commands (`greatWhite.switchTheme`, `greatWhite.openContextDetails`, `greatWhite.resetDecorations`, `greatWhite.resetFileNesting`), contributes all theme variants, the file icon theme, the product icon theme, the Markdown grammar injection, custom Explorer colors, and file-nesting defaults.
- `src/extension.ts`, `src/sessionWatcher.ts`, `src/contextGauge.ts`, `src/themeSwitcher.ts`, and `src/decorationProvider.ts` are the runtime layer:
  - `ThemeSwitcher` shows a persistent left-side status bar button (`🌊 Dark`, `🌩️ Storm`, etc.) and opens a Quick Pick for instant variant switching.
  - `SessionWatcher` reads real Copilot CLI session files from `~/.copilot/session-state/` (workspace.yaml, events.jsonl, inuse.*.lock) on a configurable poll interval.
  - `ContextGauge` consumes `SessionWatcher` and renders a right-side status bar item showing CLI context % + trend arrow and Chat context %, with three severity zones (healthy/warning/critical). There is **no automatic theme switching** — Bloodloss is a manual-only choice.
  - `EntryPointDecorationProvider` badges entry-point files `E` (amber) and config/build files `C` (sky-blue) in the Explorer, with propagation to parent folders for entry points.
- `themes/*.json` hold the visual system. Every theme file is self-contained and keeps the same top-level shape: `colors`, `tokenColors`, then `semanticTokenColors`. There is no shared base or token generator.
- The dark/light pair is the audit baseline. `.scripts/audit.js` only checks `great-white-dark-color-theme.json` and `great-white-light-color-theme.json`, while Storm/Frost/high-contrast variants still need manual symmetry/contrast review when you change shared tokens.
- `themes/great-white-agent-file-icons.json`, `themes/great-white-product-icons.json`, and `syntaxes/agents-md.tmLanguage.json` extend the core theme into agent workflows: custom file/folder icons, product icon plumbing, and Markdown highlighting for callout-style prefixes like `CRITICAL:` and `TODO:`.
- `.scripts/improve-loop.js` and `.github/workflows/self-improve.yml` form the self-improvement loop. They run the audit on a schedule, optionally append findings to `.learnings/`, validate with `vsce package`, and intentionally avoid changing theme files directly.
- `Great White (Bloodloss)` is a **manual-only** theme variant. The automatic heuristic switching system (tracker.ts / GenerationTracker) was removed in v0.7.0. The Context Gauge never auto-applies any theme.

## Key conventions

- Treat the six standard themes as the synchronized set for token/scope work: `dark`, `light`, `storm`, `frost`, `hc-dark`, and `hc-light`. `Bloodloss` is a standalone manual-selection variant and is not auto-applied by any runtime logic.
- For any syntax token change, update both `tokenColors` and `semanticTokenColors`; semantic rules override TextMate scopes in language-server-backed files.
- Comments are intentionally italic across the theme family. Do not remove the `fontStyle: "italic"` convention unless the user explicitly asks for that behavior change.
- Coral (`#c44f5f`) and amber (`#d9a441`) are reserved for diagnostics, warnings, and diff-removed styling, not general syntax accents.
- Terminal ANSI entries are kept identical across every theme JSON. If you touch one variant's ANSI palette, update the rest to match.
- File icon themes must use SVG `iconPath` entries and must not include a `fonts` key at all; they also need generic fallbacks (`_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`) because VS Code only allows one active file icon theme.
- Product icon themes use font glyphs (`fontCharacter` + `fontId`), not SVG paths. The current product icon theme is intentionally minimal until a real icon font is available.
- Release changes require a version bump in `package.json`, a matching `CHANGELOG.md` entry, and a newly generated `.vsix` committed at the repo root. Follow `docs/release-checklist.md` before `vsce publish`.
- Read `.learnings/ERRORS.md`, `.learnings/LEARNINGS.md`, and `.learnings/FEATURE_REQUESTS.md` at the start of a session, and log new mistakes/patterns/features before closing if you discover them.

## Custom agents

- `@theme-editor` — make coordinated theme/icon/token changes while enforcing repo rules
- `@theme-auditor` — audit all standard variants for contrast, coverage, and symmetry
- `@learnings-clerk` — add or promote `.learnings/` entries
- `@release-manager` — walk release packaging/publish steps
