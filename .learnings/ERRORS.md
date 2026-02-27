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

<!-- Add new entries below this line, newest first. -->

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
