# Errors

Append an entry whenever a mistake is made while editing the theme: wrong color used, invalid JSON,
violated palette rule, missed file, broken scope, etc.

---

## Template

<!--
ID:               ERR-YYYYMMDD-001
Logged:           YYYY-MM-DD
Summary:          One line describing the mistake.
Error:            >
  Exact wrong output, invalid value, or violated rule.
Context:          >
  What was being changed, which file and key, what the intended result was.
Suggested Fix:    >
  The correct value or approach. Reference the palette table or convention by name if relevant.

Metadata:
  Reproducible:   yes | no | sometimes
  Related Files:  []
  See Also:       []
-->

---

## Entries

<!--
ID:               ERR-20260302-001
Logged:           2026-03-02
Summary:          Product icon theme used file-icon-theme format (iconPath + fontCharacter with definition keys), causing VS Code to reject it with "Invalid format for product icons theme file: Must contain iconDefinitions and fonts."
Error:            >
  iconDefinitions used `iconPath` (valid only in file icon themes) and `icons[x].default.fontCharacter`
  was set to definition keys (e.g. "gw-copilot") instead of Unicode characters. VS Code's product icon
  theme parser rejected the file entirely.
Context:          >
  themes/great-white-product-icons.json — introduced SVG-based product icon overrides that mixed up the
  file icon theme schema with the product icon theme schema.
Suggested Fix:    >
  Product icon themes require font-based icons: `fonts` array with webfont entries and `iconDefinitions`
  with `fontCharacter` (Unicode) + `fontId`. SVG files cannot be referenced via `iconPath` in product
  icon themes. Fixed by stripping the broken definitions to a valid minimal stub (empty iconDefinitions
  and icons) until a proper webfont is set up.

Metadata:
  Reproducible:   yes
  Related Files:  [themes/great-white-product-icons.json]
  See Also:       [ERR-20260302-002]
  Status:         promoted → .github/copilot-instructions.md "Icon theme schema constraints"
-->

<!--
ID:               ERR-20260302-002
Logged:           2026-03-02
Summary:          File icon theme had empty `fonts: []` array which caused VS Code to crash with "Cannot read properties of undefined (reading 'size')" when setting the file icon theme.
Error:            >
  VS Code's file icon theme loader reads fonts[0].size; with an empty array fonts[0] is undefined,
  causing an unhandled crash.
Context:          >
  themes/great-white-agent-file-icons.json — a `"fonts": []` field was present even though all icons
  use SVG `iconPath` and no font-based icons exist.
Suggested Fix:    >
  Remove the `fonts` field entirely from file icon themes that only use SVG `iconPath` definitions.
  The `fonts` key is only needed when using font-glyph-based icon definitions.

Metadata:
  Reproducible:   yes
  Related Files:  [themes/great-white-agent-file-icons.json]
  See Also:       [ERR-20260302-001]
  Status:         promoted → .github/copilot-instructions.md "Icon theme schema constraints"
-->


<!--
ID:               ERR-20260302-001
Logged:           2026-03-02
Summary:          Product icon theme used file-icon-theme format (iconPath + fontCharacter with definition keys), causing VS Code to reject it with "Invalid format for product icons theme file: Must contain iconDefinitions and fonts."
Error:            >
  iconDefinitions used `iconPath` (valid only in file icon themes) and `icons[x].default.fontCharacter`
  was set to definition keys (e.g. "gw-copilot") instead of Unicode characters. VS Code's product icon
  theme parser rejected the file entirely.
Context:          >
  themes/great-white-product-icons.json — introduced SVG-based product icon overrides that mixed up the
  file icon theme schema with the product icon theme schema.
Suggested Fix:    >
  Product icon themes require font-based icons: `fonts` array with webfont entries and `iconDefinitions`
  with `fontCharacter` (Unicode) + `fontId`. SVG files cannot be referenced via `iconPath` in product
  icon themes. Fixed by stripping the broken definitions to a valid minimal stub (empty iconDefinitions
  and icons) until a proper webfont is set up. See FEATURE_REQUESTS for font-based icon follow-up.

Metadata:
  Reproducible:   yes
  Related Files:  [themes/great-white-product-icons.json]
  See Also:       []
-->


<!-- Add new entries below this line, newest first. -->

<!--
ID:               ERR-20260301-001
Logged:           2026-03-01
Summary:          .gitignore only excluded midjourney workspace subdirectories, not the root folder — main had no guard at all.
Error:            >
  .midjourney-workspace/ working dirs (incoming/, output-svg/, logs/, bin/) were gitignored
  on the feature branch, but the root folder was not. Main's .gitignore had zero coverage for
  the workspace. A merge to main would have committed scripts, prompts, README, and icon-reference.
Context:          >
  Discovered during icon process audit on feature/agentic-icon-workflow. The workspace is
  explicitly intended as local-only and experimental — never to be in main.
Suggested Fix:    >
  Add the root `.midjourney-workspace/` to .gitignore with a comment. Done in this session.
  Rule: always gitignore experimental workspace roots, not just their working subdirectories.

Metadata:
  Reproducible:   yes
  Related Files:  [".gitignore", "AGENTS.md"]
  See Also:       [LRN-20260301-001]
-->


Logged:           2026-02-28
Summary:          PowerShell pipeline scripts assumed filtered results always expose .Count.
Error:            >
  Initial run of the new icon pipeline failed with: "The property 'Count' cannot be found on this object"
  because filtered results can be scalar or null in PowerShell.
Context:          >
  During implementation of `.midjourney-workspace` conversion/validation scripts, failure checks used
  `$filtered.Count` directly after `Where-Object`, which breaks for scalar/null outputs.
Suggested Fix:    >
  Wrap filtered results with array subexpression before counting, e.g.
  `$failed = @($results | Where-Object { ... })` and then check `$failed.Count`.

Metadata:
  Reproducible:   yes
  Related Files:  [".midjourney-workspace/scripts/Convert-IconsToSvg.ps1", ".midjourney-workspace/scripts/Validate-SvgIcons.ps1"]
  See Also:       []
-->

<!--
ID:               ERR-20260227-002
Logged:           2026-02-27
Summary:          VSIX package accidentally included local backup/work files.
Error:            >
  `vsce package` included `icon.bak`, `icon.png~`, and `.local-image-work/**`, increasing
  package size and leaking local workspace artifacts into the release package.
Context:          >
  During the 0.3.4 icon release, local image-editing backups existed in the repo root and
  image-work folder. `.vscodeignore` did not exclude them, so they were bundled automatically.
Suggested Fix:    >
  Maintain explicit exclusions in `.vscodeignore` for local/backup artifacts used during icon
  editing (`.local-image-work/**`, `icon.bak`, `icon.png~`) and re-run `vsce package` to verify
  final bundle contents before commit.

Metadata:
  Reproducible:   yes
  Related Files:  [".vscodeignore"]
  See Also:       []
-->

<!--
ID:               ERR-20260227-001
Logged:           2026-02-27
Summary:          Release metadata and publish docs referenced the old publisher.
Error:            >
  `package.json` used `publisher: thesharkartist`, and publish instructions referenced
  `vsce login thesharkartist` even though release was prepared under `shark-labs`.
Context:          >
  During first Marketplace publish setup, authentication succeeded for `shark-labs` but
  extension metadata and operator docs were still tied to the previous publisher identity.
Suggested Fix:    >
  Keep `package.json` publisher aligned with active Marketplace publisher and update all
  publish runbooks (`README.md`, `docs/release-checklist.md`) in the same change set.

Metadata:
  Reproducible:   yes
  Related Files:  ["package.json", "README.md", "docs/release-checklist.md"]
  See Also:       []
-->
