# Copilot Instructions

This repository is a VS Code theme extension with six color variants plus a companion file icon theme, product icon theme, Markdown injection grammar, and a small runtime extension for a Copilot chat participant + pentatonic chime.

## Build, test, and validation commands

There are no npm scripts. Use the repo tools directly:

```bash
npm install -g @vscode/vsce   # one-time
node .scripts/audit.js        # audits the reference dark/light pair for required keys, scopes, ANSI parity, and WCAG token contrast
node .scripts/audit.js --json # same audit in machine-readable form
vsce package                  # packages the extension and validates manifest/theme JSON; same gate CI runs
```

Manual validation is part of normal development:

```bash
code .
# Press F5 in VS Code to open an Extension Development Host
```

In the Extension Development Host, switch across all six variants and spot-check TypeScript, Python, JSON, Markdown, the diff editor, and the integrated terminal. There is no automated single-test or per-file test command; targeted checks are manual in the Extension Development Host.

CI in `.github/workflows/ci.yml` only runs `vsce package`. The monthly/on-demand self-improve workflow runs `node .scripts/audit.js --json`, then `node .scripts/improve-loop.js`, and finishes with `vsce package`.

## High-level architecture

- `package.json` is the extension manifest and routing layer. It registers six theme contributions, one file icon theme, one product icon theme, the Markdown injection grammar, two commands, and the `great-white.shark` chat participant. Activation is `onStartupFinished`, and `main` points to `extension.js`.
- `extension.js` is the only runtime code. It restores `great-white.chimeEnabled` from `globalState`, adds a status bar toggle, registers `great-white.toggleChime` and `great-white.playNote`, creates the `great-white.shark` participant, forwards chat prompts to the first available Copilot `gpt-4o` model, then plays audio after each response.
- Audio playback is handled through a retained `WebviewPanel` created in `extension.js`. The extension posts `{ type: 'play', frequency, duration, volume }` messages into the webview; the webview uses the Web Audio API to synthesize the note. Changes to commands, chat behavior, command IDs, or participant IDs must stay aligned between `package.json` and `extension.js`.
- `themes/*.json` are the source of truth for all visual styling. Each of the six theme files is fully self-contained and keeps the same structure: `semanticHighlighting`, `colors`, `tokenColors`, `semanticTokenColors`. Dark and Light are the canonical reference pair; Storm, Frost, and the two HC variants are hand-maintained sibling variants, not derived from a shared base.
- `themes/great-white-agent-file-icons.json` maps SVG assets in `icons/`, while `themes/great-white-product-icons.json` maps font glyphs from `icons/codicon.ttf`. `syntaxes/agents-md.tmLanguage.json` injects into Markdown to style callout prefixes like `CRITICAL:`, `WARNING:`, and `TODO:`.
- `.scripts/audit.js` only reads the dark and light theme JSON files. It checks required workbench keys, required TextMate scopes, required semantic token entries, WCAG token contrast, and identical terminal ANSI values between those reference themes. `.scripts/improve-loop.js` can auto-fix `semanticHighlighting` for that pair, validates with `vsce package`, and logs findings to `.learnings/`; the GitHub workflow is intentionally limited to `.learnings/` writebacks.

## Theme and release conventions

- **All six theme files must be edited for token/color changes** — there is no shared base file:
  - `great-white-dark-color-theme.json` / `great-white-light-color-theme.json`
  - `great-white-storm-color-theme.json` / `great-white-frost-color-theme.json`
  - `great-white-hc-dark-color-theme.json` / `great-white-hc-light-color-theme.json`
- **Keep `tokenColors` and `semanticTokenColors` in sync** for every token family. Semantic rules override TextMate in language-server-backed files.
- **Keep `semanticHighlighting` enabled** in every theme. The audit/improve scripts assume this.
- **Variant relationships matter**:
  - **Dark / Light**: canonical token hierarchy and palette anchors.
  - **Storm**: cooler, higher-contrast dark (`editor.background` `#111820`).
  - **Frost**: colder, slightly muted light.
  - **HC Dark / HC Light**: accessibility-first variants (`hc-black` / `hc-light`) with stronger contrast and fewer decorative accents.
- **Reserved colors**: coral (`#c44f5f`) is for errors/diagnostics, amber (`#d9a441`) is for warnings and diff-removed. Do not reuse them as general syntax accents.
- **Comments are intentionally italic** (`fontStyle: "italic"`). Do not remove that styling.
- **Terminal ANSI values stay identical across all variants**. The audit enforces parity for the dark/light reference pair; keep the other four aligned manually too.
- **Release changes are coupled**: bump `package.json` version, add the matching `CHANGELOG.md` entry, run `vsce package`, and commit the generated `.vsix` in the repo root. Follow `docs/release-checklist.md` before `vsce publish`.
- **Token colors are contrast-verified**: keep syntax colors at WCAG AA (4.5:1 or better) against each variant's editor background. Use the palette in `README.md` and rationale in `prd.md`.

## Icon and grammar conventions

- **File icon themes use SVG `iconPath` definitions** and must include generic fallbacks (`_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`) because VS Code only allows one active file icon theme.
- **Do not add a `fonts` key to the file icon theme**. An empty `fonts: []` crashes VS Code's file icon theme loader.
- **Product icon themes are font-based only**. Use `fontCharacter` + `fontId`; do not try to point product icons at SVG files.
- **Icon updates are two-part changes**: add or replace the SVG in `icons\`, then wire it in `themes/great-white-agent-file-icons.json`. Preview through the Extension Development Host.
- The Markdown grammar in `syntaxes/agents-md.tmLanguage.json` injects into standard Markdown and adds dedicated scopes for critical/warning/info/todo callout prefixes; theme changes that affect those scopes should be tested in Markdown files.

## Repository-specific workflow conventions

- Read `.learnings/ERRORS.md`, `.learnings/LEARNINGS.md`, and `.learnings/FEATURE_REQUESTS.md` at the start of a session. Log new entries before closing the session, and promote repeated or high-priority rules into `AGENTS.md` or this file.
- `.midjourney-workspace/` is experimental and local-only. Do not merge it to `main`.
- Use the custom agents in `.github/agents/` when they match the work:
  - `@theme-editor` — token/color edits across all six variants
  - `@theme-auditor` — contrast, coverage, and symmetry audits across all variants
  - `@learnings-clerk` — `.learnings/` updates and promotion checks
  - `@release-manager` — release checklist and packaging flow
