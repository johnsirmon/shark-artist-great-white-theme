# Changelog

All notable changes to this project are documented in this file.

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
