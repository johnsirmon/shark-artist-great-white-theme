# Feature Requests

Append an entry when a user asks for a capability or look that is not yet in the theme.
Note what VS Code supports and what it does not before estimating complexity.

---

## Template

<!--
ID:                       FEAT-YYYYMMDD-001
Logged:                   YYYY-MM-DD
Status:                   open | in-progress | resolved | declined | promoted
Requested Capability:     One line.
User Context:             >
  What the user was trying to achieve and why it matters to them.
Complexity:               trivial | small | medium | large | not-possible
Suggested Implementation: >
  Which files to change, which keys or scopes to add or modify, and any VS Code
  API or theming limits that apply.

Metadata:
  Related Files:  []
  See Also:       []
  Tags:           []
-->

---

## Entries

<!-- Add new entries below this line, newest first. -->

<!--
ID:                       FEAT-20260225-001
Logged:                   2026-02-25
Status:                   resolved
Requested Capability:     Shift theme palette closer to great white shark photo tones.
User Context:             >
  User shared a shark reference image and asked for the active theme to feel closer to the photo's steel-blue, wet-slate, and icy-white look while retaining readability.
Complexity:               small
Suggested Implementation: >
  Update both theme JSON files with subtle accent desaturation and cooler blue-gray substitutions across workbench colors, tokenColors, and semanticTokenColors. Keep diagnostic coral/amber unchanged and ensure terminal ANSI values remain identical across dark and light variants.

Metadata:
  Related Files:  ["themes/great-white-dark-color-theme.json", "themes/great-white-light-color-theme.json"]
  See Also:       []
  Tags:           ["palette", "reference-image", "readability"]
-->
