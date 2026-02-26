# Shark Artist: Great White Theme

> A VS Code color theme built on the great white shark's world: cold ocean depth, sharp contrast, and the clean menace of something perfectly evolved.

Two variants: **Great White (Dark)** and **Great White (Light)**.

---

## Color Palette

All syntax token colors meet WCAG AA contrast (4.5:1 minimum) against their respective backgrounds.

| Role | Dark | Light | Source |
|---|---|---|---|
| Background | `#0e1a22` | `#f4f5f2` | Deep water / shark belly |
| Foreground | `#d8e8ef` | `#182830` | Diffused light / ocean floor |
| Keyword | `#4a9ec0` | `#2f6f8a` | Surface water blue |
| Operator | `#5b98b0` | `#3b7d9a` | Mid-depth blue |
| Function | `#8dd4f0` | `#1b6b8e` | Ocean spray |
| Type / Class | `#78b0c8` | `#2c5470` | Depth blue |
| String | `#6ec4ac` | `#1e7860` | Sea teal |
| Number | `#d4a843` | `#7d5c18` | Warm amber |
| Constant | `#d9a441` | `#7d4a38` | Amber / deep coral |
| Comment | `#728fa0` | `#4e6b78` | Dorsal slate |
| Error | `#c44f5f` | `#c44f5f` | Blood / danger |
| Warning | `#d9a441` | `#d9a441` | Caution amber |

> Coral (`#c44f5f`) and amber (`#d9a441`) appear **only** in diagnostics, diff-removed, and warnings. They are not used as general syntax accents.

---

## Features

- **Contrast-verified** -- all token colors computed against WCAG AA (4.5:1) before release.
- **Two variants** -- Dark for deep-ocean focus sessions; Light for the clean, pale belly.
- **Semantic highlighting** -- semantic token rules take priority over TextMate for TypeScript, Python, Rust, Go, and other language-server-supported files.
- **Bracket pair colorization** -- six distinct ocean-derived colors for nested brackets.
- **Full workbench coverage** -- 173 color keys: editor, sidebar, activity bar, tabs, status bar, title bar, input fields, buttons, lists, breadcrumbs, diff, peek view, minimap, git decorations, scrollbar, notifications, terminal.
- **HTML / JSX / CSS** -- tag names, attributes, and CSS properties explicitly styled.
- **Markdown** -- headings (bold), italic, inline code, fenced blocks, links, blockquotes.
- **Terminal ANSI** -- consistent 16-color ANSI palette shared across both variants.
- **Self-improving** -- includes an audit script and monthly GitHub Actions loop that checks contrast, key coverage, and symmetry between variants.

---

## Install

### VS Code Marketplace

1. Open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search **Shark Artist: Great White Theme**.
3. Click **Install**.
4. Press `Ctrl+K Ctrl+T` / `Cmd+K Cmd+T` and select **Great White (Dark)** or **Great White (Light)**.

### From a .vsix file

```bash
code --install-extension thesharkartist-great-white-theme-x.x.x.vsix
```

---

## Local Development

```bash
git clone https://github.com/thesharkartist/shark-artist-great-white-theme.git
cd shark-artist-great-white-theme
code .
# Press F5 -> Extension Development Host opens
# Run: Preferences: Color Theme -> Great White (Dark) or Great White (Light)
```

**Test across:** TypeScript, Python, JSON, Markdown, HTML/JSX -- and check the diff editor and terminal too.

---

## Design Philosophy

**1. Contrast from depth, not color count.**
The palette is narrow on purpose. Visual hierarchy comes from luminance contrast between token types, not from using many distinct hues. Every color in the palette earns its place.

**2. Danger is the only warmth.**
Coral and amber are reserved exclusively for errors, warnings, and diff-removed highlights. When you see warm color in the editor, something needs your attention. Strings, functions, and types stay cool.

**3. Dark is the ocean floor; Light is shark belly.**
The dark background evokes pressure and depth -- light barely reaches here, so every lit token stands out sharply. The light background is the pale, smooth underside: cold, clean, and high-contrast in a different direction. Both variants use the same accent hues so switching feels like surfacing, not theme-switching.

---

## Packaging and Publishing

```bash
npm install -g @vscode/vsce
vsce package          # creates .vsix, also runs in CI on every push to main
vsce login thesharkartist
vsce publish
```

Before publishing, work through `docs/release-checklist.md`.

---

## Feedback and Issues

Found a token that looks wrong in your language?
[Open an issue](https://github.com/thesharkartist/shark-artist-great-white-theme/issues) with:
- The language and file type
- The token type that looks wrong (e.g., "parameter color is same as foreground in Rust")
- A short code snippet that reproduces it

---

## License

MIT. See [LICENSE](LICENSE).
