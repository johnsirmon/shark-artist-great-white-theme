# Copilot Instructions

A VS Code color theme extension — two variants, no application code. All work happens in the two JSON theme files and `package.json`.

## Commands

No npm scripts exist. Use `vsce` directly:

```bash
npm install -g @vscode/vsce   # one-time
vsce package                  # produces a .vsix, same as CI
vsce login thesharkartist
vsce publish
```

CI runs `vsce package` on every push to `main` and every PR.

## Making changes

**Token or color change:**
1. Edit both `themes/great-white-dark-color-theme.json` and `themes/great-white-light-color-theme.json`.
2. For any token type, update it in **both** `tokenColors` (TextMate) **and** `semanticTokenColors` — semantic rules take priority in language-server-supported files and will override TextMate silently if they disagree.
3. Press **F5** → Extension Development Host → `Preferences: Color Theme` to preview.
4. Spot-check in TypeScript, Python, JSON, and Markdown. Also check the diff editor and terminal for the affected color role.

**Release:**
1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Run `vsce package` — commit the generated `.vsix` to the repo root.
3. See `docs/release-checklist.md` before `vsce publish`.

## Theme file structure

Each file has exactly three top-level sections, in this order:

| Section | Covers |
|---|---|
| `colors` | Workbench UI: editor surfaces, sidebar, activity bar, tabs, status bar, terminal ANSI, diff, diagnostics |
| `tokenColors` | TextMate grammar scopes (all languages) |
| `semanticTokenColors` | Semantic token overrides (language-server languages; wins over TextMate) |

### Scopes currently defined

**`tokenColors`** — TextMate scopes in use:
- `comment`, `punctuation.definition.comment`
- `string`, `string.quoted`
- `constant.numeric`, `constant.language`
- `keyword`, `storage`, `keyword.operator`
- `entity.name.function`, `support.function`
- `entity.name.type`, `support.type`, `entity.name.class`
- `variable`, `meta.definition.variable`
- `constant`, `variable.other.constant`

**`semanticTokenColors`** — keys in use:
`variable`, `parameter`, `property`, `function`, `method`, `class`, `type`, `enumMember`, `keyword`, `string`, `number`

## Palette

Accents and diagnostics are identical between variants. Only surfaces (background/foreground) differ.

| Role | Dark | Light |
|---|---|---|
| Editor background | `#0e1a22` | `#f4f5f2` |
| Editor foreground | `#e6ecef` | `#1f2b33` |
| Comment | `#6d8290` | `#73848f` |
| Keyword / ocean blue | `#2f6f8a` | `#2f6f8a` |
| Function / spray highlight | `#8dc5de` | `#2f7fa1` |
| String / sea teal | `#7fb7a6` | `#3e8875` |
| Type / class | `#7aa1b8` | `#7aa1b8` |
| Variable | `#e6ecef` | `#1f2b33` |
| Number | `#d4b078` | `#b1842f` |
| Constant / enum member | `#d9a441` | `#b5745e` |
| Error / coral ⚠ | `#c44f5f` | `#c44f5f` |
| Warning / amber ⚠ | `#d9a441` | `#d9a441` |
| Info | `#2f6f8a` | `#2f6f8a` |

⚠ Coral (`#c44f5f`) and amber (`#d9a441`) are **reserved for diagnostics and diff-removed only** — do not use them as syntax accents.

## Key conventions

- **Edit both theme files** for every change — there is no shared base file.
- **Token changes require both `tokenColors` and `semanticTokenColors`** to stay in sync.
- **Comments are intentionally italic** (`"fontStyle": "italic"`) — do not remove.
- **Terminal ANSI values are identical** in both variants — keep them in sync.
- **`.vsix` files are committed** to the repo root as release artifacts.
- For palette and design rationale, see `prd.md`.

## Self-Improvement

The `.learnings/` directory is a living log of mistakes, patterns, and requests specific to building this theme. Use it every session.

### When to write an entry

| Situation | File |
|---|---|
| A wrong color was used, a scope was broken, a file was missed, or a convention was violated | `.learnings/ERRORS.md` |
| A non-obvious pattern, rule, or insight is confirmed (e.g., a scope that behaves unexpectedly across languages) | `.learnings/LEARNINGS.md` |
| The user asks for a look or capability that does not exist yet | `.learnings/FEATURE_REQUESTS.md` |

### How to write an entry

1. Copy the Template block from the top of the matching file.
2. Assign the next ID for today: `LRN-YYYYMMDD-XXX`, `ERR-YYYYMMDD-XXX`, or `FEAT-YYYYMMDD-XXX` (zero-padded, sequential per day).
3. Fill every field. Leave no field blank; write `n/a` if genuinely not applicable.
4. Use **See Also** to cross-link related entries in any `.learnings/` file.
5. If the same `Pattern-Key` already exists in LEARNINGS.md, do not add a duplicate -- find the existing entry, increment `Recurrence-Count`, and raise `Priority` one level.

### When to promote

If an entry is `Priority: high` or `Priority: critical`, or `Recurrence-Count` reaches 3 or more:
- Add the rule or fix directly to this file or to `AGENTS.md` where it will be seen every session.
- Set `Status: promoted` on the source entry.
- Note the promotion target in `See Also`.
