# Icon Update Process

## Active icons

All seven icons below are referenced in `themes/great-white-agent-file-icons.json` and must exist as valid SVG files in `icons/`.

| File | Mapped to |
|---|---|
| `icons/agents-md.svg` | `AGENTS.md`, `agents.md` |
| `icons/claude-md.svg` | `CLAUDE.md`, `claude.md` |
| `icons/copilot-instructions.svg` | `COPILOT.md`, `copilot.md`, `copilot-instructions.md` |
| `icons/gemini-md.svg` | `GEMINI.md`, `gemini.md` |
| `icons/plan-md.svg` | `plan.md`, `PLAN.md` |
| `icons/learnings-folder.svg` | `.learnings/` folder |
| `icons/copilot-folder.svg` | `.copilot/`, `.github/` folders |

## Updating an existing icon

1. Author or obtain a replacement SVG (16×16 viewBox, no raster embeds, vector paths only).
2. Replace the file at `icons/<name>.svg`.
3. Press **F5** in VS Code → Extension Development Host → open a file that maps to the icon to preview.
4. Verify at both 16px and 32px scale (explorer and tab sizes).
5. Commit with a message like `fix: redraw learnings-folder.svg for clarity`.

## Adding a new icon

1. Create `icons/<new-name>.svg` (16×16, clean vector paths).
2. Add an `iconDefinitions` entry to `themes/great-white-agent-file-icons.json`:
   ```json
   "_new_icon": { "iconPath": "../icons/<new-name>.svg" }
   ```
3. Add the mapping under `fileNames`, `folderNames`, and/or `folderNamesExpanded` as appropriate.
4. Preview via **F5** as above.
5. Bump `version` in `package.json`, add a `CHANGELOG.md` entry, run `vsce package`.

## SVG authoring guidelines

- ViewBox must be `0 0 16 16` (or scale to that).
- Palette: steel-blue (`#4a9ec0`), teal (`#6ec4ac`), icy white (`#d8e8ef`), dark ocean (`#0e1a22`). Amber (`#d9a441`) as an optional accent only.
- No embedded rasters, no `<image>` tags, no external `href`.
- Keep path count low — 3–6 paths is ideal for readability at 16px.
- Use `fill` not `stroke` for main shapes at tiny sizes; strokes disappear below 1px.

## What NOT to merge to main

`.midjourney-workspace/` is an experimental local-only working area on `feature/agentic-icon-workflow`.  
It is excluded from packaging (`.vscodeignore`) and from version control on `main` (`.gitignore`).  
**Do not include it in any merge or cherry-pick targeting `main`.**

## Related agents

Use `@theme-editor` in Copilot when making changes to `themes/great-white-agent-file-icons.json` — it enforces the icon theme constraints (no `fonts` key, generic fallbacks required) alongside the standard 6-file sync rules.
