# Great White Shark Theme PRD

## 1. Product Overview

Create a polished VS Code color theme inspired by great white sharks and ocean depth: dorsal slate grays, ventral off-whites, deep ocean blues, and disciplined highlights for readability.

This extension will be published to:
- GitHub (source and release artifacts)
- VS Code Marketplace (public install)

## 2. Naming and Packaging

### Repository Naming (best practice)
Use lowercase kebab-case, concise, descriptive, no spaces.
Pattern should be: `<brandable-name>-theme`.

Popular-theme naming pattern observed in market leaders:
- Short, memorable brand phrase in display name (for example: `Night Owl`, `Tokyo Night`, `One Dark Pro`)
- Machine/package name in lowercase kebab-case
- Include `theme` in package name and description for discoverability

Brand rule note:
- Do not include `Visual Studio Code` or `VS Code` in your product/repo name.

Creator-brand note:
- Since your artist identity is `thesharkartist`, naming should preserve shark signal and optionally add an artist signature layer (for example, prefix/suffix in repo and publisher branding).

Recommended repo name:
- `shark-artist-great-white-theme`

Acceptable alternatives:
- `great-white-theme`
- `great-white-shark-theme`

### Extension Identity (package.json)
- `name`: `thesharkartist-great-white-theme`
- `displayName`: `Shark Artist: Great White Theme`
- `publisher`: `thesharkartist` (or nearest available variant if unavailable)
- `categories`: `Themes`
- `description`: include keyword `theme` for discoverability
- `keywords`: up to 30, focused on search intent

## 3. Goals

### Primary Goals
- Ship a readable, production-quality theme for daily coding.
- Cover both workbench UI colors and syntax token colors.
- Provide semantic token support for modern language servers.
- Prepare complete Marketplace metadata for strong presentation.

### Non-Goals (v1)
- No icon theme or product icon theme.
- No custom language grammar.
- No separate light variant in first release unless scope is confirmed.

## 4. Users and Use Cases

### Target Users
- Developers who prefer oceanic dark themes.
- Users who want strong contrast without neon overload.
- Users coding in TypeScript/JavaScript, Python, JSON, Markdown.
- Users who want both dark and light variants from the same extension.

### Core Use Cases
- Long coding sessions with low eye strain.
- Fast visual parsing of comments, strings, functions, and types.
- Clear diagnostics (errors/warnings/info), diffs, and terminal readability.

## 5. Design Direction

### Visual Theme Language
- Mood: cold, sharp, ocean predator, clean and confident.
- Base: realistic shark-and-ocean palette (muted): dorsal slate (#0e1a22), ventral off-white (#f4f5f2), deep sea navy (#0b2533).
- Foregrounds: tooth white (#e6ecef) on dark, charcoal (#1f2b33) on light for hierarchy.
- Accent: ocean blue (#2f6f8a) and spray highlight (#8dc5de) for interaction; coral (#c44f5f) and amber (#d9a441) reserved for diagnostics.

### Accessibility and Readability
- Maintain strong foreground/background contrast for core text.
- Keep comments readable (not too dim).
- Keep error/warning colors distinct and quickly scannable.

## 6. Functional Requirements

### Theme File Requirements
- Define `colors` for core workbench surfaces.
- Define `tokenColors` for TextMate scopes.
- Enable `semanticHighlighting`.
- Define `semanticTokenColors` for key semantic selectors.

### Minimum UI Coverage
- Editor background/foreground
- Activity bar / sidebar / panel / status bar
- Tabs and title states
- Selection, cursor, line highlight
- Diff and diagnostics colors
- Terminal ANSI core colors

### Minimum Token Coverage
- Comments
- Strings
- Numbers
- Keywords
- Functions and methods
- Types and classes
- Constants
- Operators and punctuation

## 7. Quality Bar and Success Metrics

### Acceptance Criteria (Release Gate)
- Theme installs and loads in Extension Development Host.
- No unreadable default text states in tested languages.
- Distinct visual states for error/warning/info and diff added/removed.
- Marketplace assets present: icon, README screenshots, changelog, license.
- Package passes `vsce package` without blocking errors.

### Testing Matrix (manual)
- Languages: TypeScript, JavaScript, Python, JSON, Markdown
- File states: normal editor, diff editor, terminal output
- UI states: active/inactive tabs, focused/unfocused groups, selection

## 8. Delivery Plan (Order of Work)

1. Finalize naming and product decisions from this PRD.
2. Scaffold extension (`yo code` -> New Color Theme).
3. Implement v1 palette and token mappings.
4. Run Extension Development Host and iterate color tuning.
5. Add semantic token color rules.
6. Prepare Marketplace metadata and assets.
7. Validate packaging with `vsce package`.
8. Publish source to GitHub.
9. Publish extension to Marketplace.

Confirmed release scope:
- Publish targets (v1): GitHub + VS Code Marketplace
- Variant naming (v1): `Great White (Dark)` and `Great White (Light)`

## 9. Risks and Mitigations

- Risk: Theme looks good in one language but weak in others.
  - Mitigation: test matrix across at least 5 language samples.
- Risk: Marketplace discoverability is low.
  - Mitigation: strong display name, description, keywords, screenshots.
- Risk: contrast issues for comments or diagnostics.
  - Mitigation: enforce minimum readability checks before release.

## 10. Open Decisions (Need User Input)

1. Final repo name choice:
   - Resolved: `shark-artist-great-white-theme` (brand-forward)
2. Final extension display name:
   - Resolved: `Shark Artist: Great White Theme`
3. Final publisher identifier:
   - Resolved target: `thesharkartist` (fall back only if already taken)
4. Final package name slug:
   - Resolved: `thesharkartist-great-white-theme`
5. Theme type for v1:
   - Dark + light variant together. (Confirmed)
6. Tone preference:
   - More realistic ocean (muted). (Confirmed)
7. Comment style:
   - Neutral gray, cool blue-gray, or sea-green tint?
8. Accent intensity:
   - Conservative accents or bold accents for active/focus states?
9. Initial language priority beyond defaults:
   - Any extra languages you want explicitly optimized first?
10. Publishing scope:
   - GitHub + VS Code Marketplace in v1. (Confirmed)

## 11. Post-PRD Next Artifact

After your answers, next file should be:
- `README.md` (user-facing positioning, screenshots, install instructions)

Then:
- `CHANGELOG.md`
- `LICENSE`
- extension scaffold files
