# Copilot Instructions

## What this repo is

A VS Code color theme extension with two variants — **Great White (Dark)** and **Great White (Light)** — inspired by great white shark and ocean depth imagery. There is no application code; all work happens in JSON theme files and extension metadata.

## Build and package

```bash
# Install the packaging tool (one-time)
npm install -g @vscode/vsce

# Package the extension into a .vsix
vsce package

# Publish to Marketplace
vsce login thesharkartist
vsce publish
```

CI (`ci.yml`) runs `vsce package` on every push to `main` and every pull request to validate the extension packages without errors.

## Local testing

Press **F5** in VS Code to launch an Extension Development Host, then run `Preferences: Color Theme` and select `Great White (Dark)` or `Great White (Light)`.

## Architecture

Both theme variants live entirely in:
- `themes/great-white-dark-color-theme.json`
- `themes/great-white-light-color-theme.json`

Each file has three sections in this order:
1. `colors` — workbench UI (editor, sidebar, activity bar, tabs, status bar, terminal ANSI, diff, diagnostics)
2. `tokenColors` — TextMate grammar scopes
3. `semanticTokenColors` — semantic token overrides (takes priority over `tokenColors` in supported languages)

`package.json` is the extension manifest; it declares both theme paths under `contributes.themes`.

## Palette

Both variants share the same accent and diagnostic hues. Only background/foreground surfaces differ between dark and light.

| Role | Dark | Light |
|---|---|---|
| Editor background | `#0e1a22` | `#f4f5f2` |
| Editor foreground | `#e6ecef` | `#1f2b33` |
| Keyword / ocean blue | `#2f6f8a` | `#2f6f8a` |
| Function / spray highlight | `#8dc5de` | `#2f7fa1` |
| String / sea teal | `#7fb7a6` | `#3e8875` |
| Number / amber | `#d4b078` | `#b1842f` |
| Constant / amber | `#d9a441` | `#b5745e` |
| Error / coral | `#c44f5f` | `#c44f5f` |
| Warning / amber | `#d9a441` | `#d9a441` |
| Info / ocean blue | `#2f6f8a` | `#2f6f8a` |

## Key conventions

- **Coral and amber are reserved for diagnostics** (`editorError`, `editorWarning`, diff removed). Do not use them as general-purpose syntax accents.
- **`semanticHighlighting` is `true` in both files.** Semantic token rules override TextMate for supported language servers, so changes to a token type must be made in **both** `tokenColors` and `semanticTokenColors` to be consistent.
- **Comments are italic** (`"fontStyle": "italic"`) in both variants — intentional, do not remove.
- **The terminal ANSI palette is shared** between dark and light variants (same hex values) to keep a consistent terminal experience across both.
- Version bumps go in both `package.json` (`version`) and `CHANGELOG.md` before packaging.
- Generated `.vsix` files are committed to the repo root as release artifacts.

## Pre-release checklist

See `docs/release-checklist.md` for the full gate before running `vsce publish`.
