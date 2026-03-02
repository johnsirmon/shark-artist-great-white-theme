# Copilot Instructions

A VS Code color theme extension — six variants plus a file icon theme, product icon theme, and an agents-markdown grammar. All work happens in the theme JSON files under `themes/` and `package.json`. There is no shared base file; each variant is fully self-contained.

## Commands

No npm scripts exist. Use `vsce` directly:

```bash
npm install -g @vscode/vsce   # one-time
vsce package                  # produces a .vsix, same as CI
vsce login shark-labs
vsce publish
```

CI runs `vsce package` on every push to `main` and every PR.

## Making changes

**Token or color change:**
1. Identify which variants are affected. Universal token changes (syntax colors) must be applied to **all six** theme files:
   - `great-white-dark-color-theme.json` · `great-white-light-color-theme.json`
   - `great-white-storm-color-theme.json` · `great-white-frost-color-theme.json`
   - `great-white-hc-dark-color-theme.json` · `great-white-hc-light-color-theme.json`
2. For any token type, update it in **both** `tokenColors` (TextMate) **and** `semanticTokenColors` — semantic rules take priority in language-server-supported files and will override TextMate silently if they disagree.
3. Press **F5** → Extension Development Host → `Preferences: Color Theme` to preview.
4. Spot-check in TypeScript, Python, JSON, and Markdown. Also check the diff editor and terminal for the affected color role.

**Variant relationships:**
- **Dark / Light**: the reference pair; establishes canonical token colors.
- **Storm**: a cooler, higher-contrast dark variant (editor bg `#111820`).
- **Frost**: a colder, slightly muted light variant.
- **HC Dark / HC Light**: high-contrast accessibility variants registered as `hc-black` / `hc-light` — push contrast further, no decorative accents.
- Each file is fully self-contained — no inheritance, no shared base. When adding a new workbench key, add it to all applicable files.

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
- `string`, `string.quoted`, `string.template`
- `constant.character.escape`, `string.regexp`
- `constant.numeric`, `constant.language`
- `keyword`, `storage` (control flow and declarations)
- `keyword.operator` (operators — separate color from keyword)
- `punctuation.separator`, `punctuation.terminator`, `punctuation.accessor`
- `entity.name.function`, `support.function`
- `entity.name.type`, `entity.name.class`, `entity.name.namespace`, `entity.name.enum`, `support.class`, `support.type`
- `variable`, `meta.definition.variable`
- `variable.language` (this, self, super)
- `constant`, `variable.other.constant`, `support.constant`
- `meta.decorator`, `punctuation.decorator`, `storage.type.decorator`, `entity.name.function.decorator`
- `entity.name.tag`, `entity.other.attribute-name`
- `punctuation.definition.tag.begin`, `punctuation.definition.tag.end`
- `support.type.property-name.css`
- `markup.heading`, `entity.name.section`, `markup.bold`, `markup.italic`
- `markup.inline.raw`, `markup.fenced_code`, `markup.raw.block`
- `markup.underline.link`, `string.other.link`, `markup.quote`
- `invalid`, `invalid.illegal`

**`semanticTokenColors`** — keys in use:
`variable`, `variable.readonly`, `parameter`, `property`, `property.readonly`,
`function`, `method`, `class`, `interface`, `enum`, `enumMember`,
`type`, `typeParameter`, `namespace`, `keyword`, `modifier`,
`operator`, `decorator`, `string`, `number`, `regexp`

## Additional contributions

Beyond color themes, the extension contributes:

| Contribution | File | Notes |
|---|---|---|
| File icon theme | `themes/great-white-agent-file-icons.json` | Sparse — only overrides agent/config files |
| Product icon theme | `themes/great-white-product-icons.json` | ≤10 overrides; generic ocean aesthetics only |
| TextMate grammar (agents markdown) | `syntaxes/agents-md.tmLanguage.json` | Injected into `text.html.markdown`; highlights AGENTS.md / copilot-instructions.md structure |

The file icon and product icon themes are registered contributions in `package.json`. Any new icon override file must also be listed in `.vscodeignore` exclusion rules to avoid packaging unrelated workspace artifacts.

**Icon theme schema constraints** (violations crash VS Code or cause silent rejection):

- **File icon themes** — use SVG `iconPath` in `iconDefinitions`. Do **not** include a `fonts` key at all (not even `"fonts": []`); VS Code reads `fonts[0].size` unconditionally and crashes if the array is empty.
- **Product icon themes** — cannot reference SVG files via `iconPath`. They require font-based icons: a `fonts` array with a webfont entry and `iconDefinitions` using `fontCharacter` (Unicode codepoint) + `fontId`. Until a proper webfont is set up, keep `great-white-product-icons.json` as the minimal stub (`fonts: [], iconDefinitions: {}, icons: {}`).

## Packaging note

Before `vsce package`, confirm `.vscodeignore` excludes all local-work artifacts (`.local-image-work/**`, `icon.bak`, etc.). Run `vsce package --no-dependencies` and inspect the output file list to catch accidental inclusions.

## Audit and self-improvement loop

```bash
node .scripts/audit.js              # contrast + coverage check, exits 1 if high-severity
node .scripts/audit.js --json       # machine-readable output
node .scripts/improve-loop.js --dry-run   # report only, no writes
node .scripts/improve-loop.js             # apply auto-fixes, validate, log to .learnings/
```

The GitHub Actions workflow `.github/workflows/self-improve.yml` runs monthly (and on demand) with `dry-run=true` by default. It creates a draft PR with any `.learnings/` updates but never touches theme files or publishes.

## Palette

Accents and diagnostics are identical between variants. Only surfaces (background/foreground) differ. All token colors are WCAG AA verified (>=4.5:1) against their backgrounds.

| Role | Dark | Light |
|---|---|---|
| Editor background | `#0e1a22` | `#f4f5f2` |
| Editor foreground | `#d8e8ef` | `#182830` |
| Comment | `#728fa0` | `#4e6b78` |
| Keyword | `#4a9ec0` | `#2f6f8a` |
| Operator | `#5b98b0` | `#3b7d9a` |
| Function | `#8dd4f0` | `#1b6b8e` |
| Type / Class | `#78b0c8` | `#2c5470` |
| String | `#6ec4ac` | `#1e7860` |
| Variable | `#d8e8ef` | `#182830` |
| Number | `#d4a843` | `#7d5c18` |
| Constant / enum member | `#d9a441` | `#7d4a38` |
| Error / coral (diag only) | `#c44f5f` | `#c44f5f` |
| Warning / amber (diag only) | `#d9a441` | `#d9a441` |
| Info | `#4a9ec0` | `#2f6f8a` |

## Key conventions

- **Edit all affected theme files** for every change — there is no shared base file. Token changes usually require all six files; workbench-only changes may target specific variants.
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
