# Changelog

All notable changes to this project are documented in this file.

## [0.6.0] - 2026-03-07

### Explorer Enhancements

**File Nesting Patterns**
- Contributed `explorer.fileNesting.enabled: true` and `explorer.fileNesting.patterns` defaults so the Explorer automatically collapses noisy sibling files under their logical parent
- Patterns cover: `package.json` lockfiles/rc files, `tsconfig.json` variants, `*.ts` test/declaration siblings, `vite.config.*` + `vitest.config.*`, `.env` variants, and `README.md` companion docs
- Users can override or disable nesting per workspace/user settings as normal

**Entry Point & Config FileDecorationProvider**
- Added `EntryPointDecorationProvider` (new `src/decorationProvider.ts`) that badges files in the Explorer:
  - `E` badge + amber tint (`greatWhite.entryPointForeground` `#FFB347` dark / `#CC7700` light) on entry point files; `propagate: true` so parent folders also tint
  - `C` badge + sky-blue tint (`greatWhite.configFileForeground` `#87CEEB` dark / `#2980B9` light) on config/build files; `propagate: false`
- Entry points are resolved from `package.json` `main`, `module`, `exports`, and `bin` fields (all string leaf values extracted recursively) and cached per workspace folder
- Fallback heuristics: well-known filenames (`index.ts`, `index.js`, `main.ts`, `app.ts`, `server.ts`, `cli.ts`) within 2 directory levels of the workspace root receive the `E` badge even without a `package.json` match
- Config file heuristic: filenames matching `*.config.ts/js/mjs`, `*.rc.js`, `.eslintrc*`, `jest.config*`, `vitest.config*`, `next.config*`, `vite.config*` receive the `C` badge
- Cache is invalidated when any `package.json` in the workspace changes, is created, or is deleted
- New `package.json` contributions: `colors` (`greatWhite.entryPointForeground`, `greatWhite.configFileForeground` with dark/light/HC/HC-light defaults), `configuration` (`greatWhite.showEntryPointDecorations` boolean, default `true`)
- Decorations can be disabled entirely via `greatWhite.showEntryPointDecorations: false`; change is reflected immediately with no reload required

## [0.5.0] - 2026-02-28

### Agentic Workflow Visibility

**Tier 1 — AI Surface Colors (all 6 variants)**
- Added `editorGhostText.*` colors: Copilot ghost text now renders in muted teal (`#4daaaa90` dark / `#3b8a8090` light) clearly distinct from syntax keywords
- Added `editor.inlineSuggest.*` colors: inline suggestion background, highlight, and selection states are fully on-palette
- Added full `inlineChat.*` color group: background, border, focus, shadow, region highlight, and selected state — the Ctrl+I edit panel is now branded ocean-blue across all variants
- Added `inlineChatDiff.*` and `inlineChatDiffLine.*`: AI-generated diffs use teal for insertions and coral for removals (consistent with diff editor)
- Added `chat.*` colors: chat panel request background, borders, slash command styling, and avatar colors
- Added `terminalCommandDecoration.*` colors: terminal command success/error/default decorations use ocean palette

**Tier 2 — Agent File Icons (opt-in)**
- Added `Great White: Agent File Icons` icon theme (opt-in via `Preferences: File Icon Theme`)
- Custom SVG icons for: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `COPILOT.md`, `plan.md`, `.learnings/` folder, `.copilot/` folder
- All icons use the ocean-blue/teal/amber palette; note this icon theme is standalone (VS Code icon themes are mutually exclusive)

**Tier 3 — Agent Product Icons (opt-in, foundation)**
- Added `Great White: Agent Product Icons` product icon theme (opt-in via `Preferences: Product Icon Theme`)
- Initial implementation using Codicon font with a `git-merge` icon override as proof-of-concept
- Custom shark-ocean product icons planned for a future release (requires webfont generation)

**Tier 4a — AGENTS.md Syntax Grammar (auto)**
- Added TextMate grammar (`text.agents.markdown`) injected into Markdown
- `CRITICAL:` / `IMPORTANT:` / `NEVER:` prefixes highlighted in error-red
- `WARNING:` / `CAUTION:` in amber
- `NOTE:` / `TIP:` in comment blue
- `TODO:` / `FIXME:` as constants
- Section headings get `entity.name.section` styling
- Inline code and file paths get distinct colors

## [0.4.0] - 2026-02-27

- Added four new theme variants: `Great White (Storm)`, `Great White (Frost)`, `Great White (High Contrast Dark)`, and `Great White (High Contrast Light)`
- Updated `package.json` theme contributions to register all six available Great White variants
- Introduced gray-red-white-blue complementary palette options while preserving semantic/token scope parity
- Added dedicated high-contrast dark and light accessibility variants with stronger focus and boundary visibility
- Expanded README documentation with color-theory guidance and VS Code theme best-practice rationale

## [0.3.4] - 2026-02-27

- Re-exported Marketplace icon as optimized `256x256` PNG (`icon.png`) to reduce package size while preserving visual quality

## [0.3.3] - 2026-02-27

- Switched publisher metadata from `thesharkartist` to `shark-labs` for first Marketplace publish under the new publisher account
- Renamed extension package ID from `thesharkartist-great-white-theme` to `shark-labs-great-white-theme` for cleaner Marketplace branding
- Updated publishing documentation and checklist to use `vsce login shark-labs`

## [0.3.2] - 2026-02-25

- Updated extension icon to use original shark artwork (`icon.png`) for Marketplace branding
- Added author website link (`https://thesharkartist.com`) in extension metadata and README intro

## [0.3.1] - 2026-02-26

- Fixed `workflow_dispatch` not registering in GitHub Actions — invalid YAML in `self-improve.yml` (unindented `run: |` block scalar content) prevented GitHub from parsing the file (#1, #2)
- Fixed repository, bugs, and homepage URLs in `package.json` and `README.md` pointing to non-existent `thesharkartist` org (#3)

## [0.3.0] - 2026-02-25

- Fixed WCAG AA contrast failures: dark keyword (3.16 -> 5.9:1), dark comment (4.41 -> 5.2:1), light string (3.85 -> 6.3:1), light number (3.09 -> 6.7:1), light function (4.11 -> 5.8:1), light comment (3.54 -> 6.4:1), light constant (3.41 -> 8.0:1)
- Separated operator color from keyword in both variants for clearer visual hierarchy
- Expanded workbench coverage to 173 color keys per variant (added focusBorder, titleBar, inputs, buttons, lists, breadcrumbs, bracket pair colorization, peek view, minimap, git decorations, scrollbar, notifications, overview ruler)
- Added semantic token types: interface, enum, typeParameter, namespace, modifier, regexp, variable.readonly, property.readonly, operator, decorator
- Added token rules: language variables (this/self), decorators, HTML tag punctuation, CSS properties, string escapes/regexp, all Markdown constructs, invalid/illegal
- Cursor changed to accent color for better visibility
- Improved light theme parameter and property colors for readability
- Added .scripts/audit.js (contrast + coverage checks) and .scripts/improve-loop.js (safe agentic loop)
- Added .github/workflows/self-improve.yml (monthly audit workflow with draft PR output)
- Improved README with palette table, design philosophy, and feature list



- Refreshed dark and light palettes using great white dorsal slate, ventral off-white, and ocean blue accents
- Updated diagnostics, diff, terminal ANSI, and token colors for readability
- Documented palette story in README and PRD

## [0.1.0] - 2026-02-25

- Initial scaffold for `Shark Artist: Great White Theme`
- Added dark and light theme variants
- Added semantic token color mappings
- Added extension launch configuration for local theme testing
