# Shark Artist: Great White Theme — Extension Demo

This document demonstrates the features of the **Shark Artist: Great White Theme** VS Code extension
(`shark-labs.shark-labs-great-white-theme` v0.6.3) as defined in
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md) and [`AGENTS.md`](../AGENTS.md).

---

## Quick validation

Run these two commands before and after any theme change to confirm everything is healthy:

```bash
# Audit the dark/light reference themes for WCAG contrast, required keys, and ANSI parity
node .scripts/audit.js

# Same output as machine-readable JSON (useful for CI scripting)
node .scripts/audit.js --json

# Validate the extension package (required before any release)
vsce package
```

**Current audit result** (`v0.6.3`):

```
=== Theme Audit ===
No issues found.

Total:0  High:0  Medium:0  Autofix:0
```

> The audit only checks `great-white-dark-color-theme.json` and
> `great-white-light-color-theme.json`. Storm, Frost, and high-contrast
> variants need manual symmetry review when you change shared tokens.

---

## 1 — Theme variants

Seven theme entries are registered in `package.json`. Six are the synchronized standard set; one is
the runtime alarm theme.

| Theme label | `editor.background` | `editor.foreground` | Accent / keyword |
|---|---|---|---|
| Great White (Dark) | `#0e1a22` | `#d8e8ef` | `#5d8fa8` |
| Great White (Light) | `#f1f4f5` | `#182830` | `#3d667c` |
| Great White (Storm) | `#111820` | `#e7edf2` | `#4f7ea8` |
| Great White (Frost) | `#f7f8f7` | `#1a2630` | `#2f5f84` |
| Great White (High Contrast Dark) | `#0b0f12` | `#f6fbff` | `#6eb8ff` |
| Great White (High Contrast Light) | `#ffffff` | `#12202a` | `#0f5f93` |
| Great White (Bloodloss) *(alarm)* | `#1a0505` | `#e7edf2` | `#c44f5f` |

### How to switch

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Preferences: Color Theme**
3. Select any variant from the list above

> **Bloodloss** is switched to automatically by the extension runtime — it should not be set
> manually during normal use.

### Palette conventions (enforced)

- **Coral `#c44f5f`** — reserved for diagnostics, diff-removed, and Bloodloss accents only.
- **Amber `#d9a441`** — reserved for warnings and diff-removed; not used as a syntax accent.
- Comments are **italic** across all variants (`"fontStyle": "italic"` in every theme JSON).
- Terminal ANSI entries are **identical** across all seven themes. Changing one requires updating all.

---

## 2 — Token highlighting

Every theme file has the same top-level shape: `colors → tokenColors → semanticTokenColors`.
Semantic rules override TextMate scopes in language-server-backed files, so both sections must
be kept in sync for every change.

### Dark theme sample tokens

| Token type | Scope | Color |
|---|---|---|
| Comment | `comment`, `punctuation.definition.comment` | `#7d92a0` *(italic)* |
| String | `string`, `string.quoted`, `string.template` | `#7ab6ad` |
| Number / Boolean | `constant.numeric`, `constant.language` | `#d4a843` |
| Keyword | `keyword`, `keyword.control` | `#5d8fa8` |
| Function | `entity.name.function` | `#7ab6ad` |

### Try it

Open a `.ts`, `.json`, `.py`, or `.md` file and switch between the dark and light variants to
observe the ocean-palette token colors. The `tokenColors` and `semanticTokenColors` sections
in each theme JSON control what you see.

---

## 3 — Bloodloss alarm

The Bloodloss feature tracks **document size** and **typing velocity** in real time. When the
combined severity score crosses the trigger threshold the workspace theme switches automatically
to the deep-red Bloodloss variant as a visual alert.

### Severity formula

```
bloatScore    = min(50, (fileChars  / sizeThreshold)     × 50)
velocityScore = min(50, (chars/sec  / velocityThreshold) × 50)
severity      = min(100, bloatScore + velocityScore)
```

### Configurable thresholds

| Setting | Default | Description |
|---|---|---|
| `greatWhite.bloodloss.sizeThreshold` | `500000` | Chars that contribute max bloat score |
| `greatWhite.bloodloss.velocityThreshold` | `5000` | Chars/sec that contribute max velocity score |
| `greatWhite.bloodloss.triggerSeverity` | `75` | Score that triggers Bloodloss theme switch |
| `greatWhite.bloodloss.warningSeverity` | `50` | Score that fires the one-time warning toast |
| `greatWhite.statusBar.enabled` | `true` | Master kill switch for the status bar indicator |
| `greatWhite.statusBar.alwaysShow` | `true` | Show indicator even when score is healthy |

### Status bar indicator states

```
🦈  0 →   — Healthy (green)
🦈 45 ↑   — Building (default text color)
🦈 60 ↑   — High (yellow), warning toast fires on first cross above 50
🩸 80 ↑   — Bloodloss active (warning background), theme has switched
```

### Commands

| Command | Description |
|---|---|
| `Great White: Cleanse Bloodloss (Reset Context Bloat)` | Resets severity to 0 and restores the previous theme |
| `Great White: Snooze Context Alert` | Hides the status bar until severity rises another 10 points |
| `Great White: Disable Context Tracking` | Permanently hides the indicator (persisted to global settings) |
| `Great White: Enable Context Tracking` | Re-enables tracking after it was disabled |
| `Great White: Reset Explorer Decorations to Defaults` | Clears decoration overrides |
| `Great White: Reset File Nesting Patterns to Defaults` | Clears file nesting workspace overrides |

### Demo walkthrough

1. Open a large file (> 100 KB) or paste many lines rapidly into a new document.
2. Watch the status bar indicator change from `🦈 0 →` toward `🦈 60 ↑`.
3. When severity crosses 75 the workspace theme switches to `Great White (Bloodloss)`.
4. Open the Command Palette and run **Great White: Cleanse Bloodloss** — the original theme
   is restored and the score resets to 0.

---

## 4 — File icon theme: Great White Agent File Icons

Activate via **Preferences: File Icon Theme → Great White: Agent File Icons**.

Because VS Code only allows one active file icon theme at a time, this theme ships **generic
fallback icons** for all standard file types so nothing loses its icon when the theme is active.

### Special agent-file mappings

| File / folder | Icon definition | Purpose |
|---|---|---|
| `AGENTS.md`, `agents.md` | `_agents_md` | Agent instruction files |
| `copilot-instructions.md` | `_copilot_instructions` | Copilot workspace instructions |
| `CLAUDE.md`, `claude.md` | `_claude_md` | Claude instruction files |
| `GEMINI.md`, `gemini.md` | `_gemini_md` | Gemini instruction files |
| `plan.md`, `PLAN.md` | `_plan_md` | Agent planning files |
| `.learnings/` folder | `_learnings_folder` | Learnings knowledge base |
| `.github/`, `.copilot/` folders | `_copilot_folder` | GitHub / Copilot config folders |

### Generic fallback mappings (partial)

| Extension / name | Icon |
|---|---|
| `.md` | `_markdown` |
| `.json`, `package.json` | `_json` / `_package` |
| `.svg`, `.png`, `.jpg` | `_image` |
| `.yml`, `.yaml` | `_yaml` |
| `_file` | Generic file fallback |
| `_folder` / `_folder_open` | Generic folder fallbacks |
| `_root_folder` / `_root_folder_open` | Root folder fallbacks |

> **Rule**: file icon themes use SVG `iconPath` entries only — the `fonts` key must **not** be
> present. An empty `"fonts": []` crashes VS Code with
> *"Cannot read properties of undefined (reading 'size')"*.

---

## 5 — Markdown callout grammar (`.agents.md` files)

The grammar in `syntaxes/agents-md.tmLanguage.json` is injected into Markdown files that match
the `agents-md` pattern. It highlights callout prefixes used in agent instruction documents.

### Syntax patterns

| Prefix(es) | TextMate scope | Visual result |
|---|---|---|
| `CRITICAL:` `IMPORTANT:` `DANGER:` `NEVER:` `DO NOT:` | `invalid.illegal.agents.keyword` | Error red |
| `WARNING:` `CAUTION:` `DEPRECATED:` `AVOID:` | `variable.other.agents.warning` | Amber / warning |
| `NOTE:` `TIP:` `INFO:` `SEE ALSO:` | `comment.line.agents.note` | Muted blue |
| `TODO:` `FIXME:` `HACK:` | `constant.language.agents.todo` | Constant color |
| `## Section heading` | `entity.name.section.agents` | Distinct heading color |
| `` `inline code` `` | `markup.inline.raw.agents` | Raw markup |
| `src/foo.ts`, `./file.json` | `markup.underline.link.agents` | Underline link |

### Example file (`AGENTS.md` or any `.agents.md` file)

```markdown
# Agent Instructions

CRITICAL: Never commit secrets or credentials to source control.
WARNING: Changing a token scope requires updating all six theme files.
NOTE: Run `node .scripts/audit.js` after every palette change.
TODO: Add HC variants to the automated audit baseline.

## Theme rules

All six theme files must be kept in sync.
```

When this grammar is active, `CRITICAL:` renders in error-red, `WARNING:` in amber,
and `NOTE:` in muted blue — making priority distinctions scannable at a glance.

---

## 6 — Custom agents

Four specialist agents live in `.github/agents/`. Invoke them with `@agent-name` in Copilot Chat.

| Agent | File | When to use |
|---|---|---|
| `@theme-editor` | `theme-editor.agent.md` | Any color or token change — enforces 6-file sync, reserved color guard, WCAG contrast checks |
| `@theme-auditor` | `theme-auditor.agent.md` | Audit all six variants for contrast, coverage, and symmetry beyond what `audit.js` checks |
| `@learnings-clerk` | `learnings-clerk.agent.md` | Log to `.learnings/` or review entries for promotion to `copilot-instructions.md` |
| `@release-manager` | `release-manager.agent.md` | Prepare a release — walks the checklist, validates the package, bumps version |

### Learnings logging format

Any mistake or new pattern discovered during a session is logged to `.learnings/ERRORS.md`,
`.learnings/LEARNINGS.md`, or `.learnings/FEATURE_REQUESTS.md` using this ID convention:

```
ERR-YYYYMMDD-001   ← error entries
LRN-YYYYMMDD-001   ← learning/pattern entries
FEAT-YYYYMMDD-001  ← feature request entries
```

If the same `Pattern-Key` appears for the third time (`Recurrence-Count: 3`) the rule is
promoted directly into `.github/copilot-instructions.md` or `AGENTS.md`.

---

## 7 — Extension architecture

```
package.json                  ← composition root: themes, commands, config, grammar injection
src/
  extension.ts                ← activation, status bar, command wiring
  tracker.ts                  ← GenerationTracker: bloat score + velocity calculation
  themeSwitcher.ts            ← saves/restores active theme; switches to Bloodloss
  decorationProvider.ts       ← Explorer badges for entry-point and config files
themes/
  great-white-*-color-theme.json   ← seven theme JSON files (self-contained, no shared base)
  great-white-agent-file-icons.json
  great-white-product-icons.json
syntaxes/
  agents-md.tmLanguage.json   ← Markdown grammar injection for agent instruction files
icons/                        ← SVG icon assets referenced by the file icon theme
.scripts/
  audit.js                    ← WCAG contrast + key coverage audit for dark/light pair
.learnings/                   ← Errors, learnings, feature requests (append-only log)
docs/                         ← Release checklist, icon process, best practices, screenshots
```

---

## 8 — Screenshots

Existing reference screenshots in `docs/screenshots/`:

| File | Theme |
|---|---|
| `great-white-dark.png` | Great White (Dark) |
| `great-white-light.png` | Great White (Light) |
| `great-white-storm.png` | Great White (Storm) |
| `great-white-frost.png` | Great White (Frost) |
| `great-white-hc-dark.png` | Great White (High Contrast Dark) |
| `great-white-hc-light.png` | Great White (High Contrast Light) |

---

*Generated by the QA demonstration agent — see PR [#9](https://github.com/johnsirmon/shark-artist-great-white-theme/pull/9).*
