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
ID:                       FEAT-20260227-002
Logged:                   2026-02-27
Status:                   in-progress
Requested Capability:     Agentic workflow visibility — theme all AI/Copilot surfaces and add visual identity for agent instruction files.
User Context:             >
  User wants Great White variants to feel intentional and on-brand when using Copilot ghost text,
  inline chat, chat panel, and when working with AGENTS.md / copilot-instructions.md files.
  Currently these surfaces fall back to VS Code defaults and break the ocean aesthetic.
Complexity:               large (4 tiers)
Suggested Implementation: >
  Tier 1 (v0.4.1): Add editorGhostText.*, editor.inlineSuggest.*, inlineChat.*, chat.* workbench
  color keys to all 6 theme JSONs. Use muted teal for ghost text (not keyword blue). Also add
  terminal command decoration and editorOverviewRuler.inlineChatInserted.
  Tier 2 (v0.6.0): File icon theme (full coverage or document as user overrides — sparse icon
  themes look broken since fileIconTheme is mutually exclusive with other icon themes).
  Tier 3 (v0.5.0): Opt-in product icon theme (≤10 overrides, generic ocean aesthetics only —
  no Copilot logos). Register as named contribution, never default.
  Tier 4 (v1.0.0): Companion extension `great-white-agent-tools` — FileDecorationProvider,
  status bar indicator, "Reveal Agentic Files" command, AGENTS.md TextMate grammar.
  Full plan at session-state/fca61a24-e940-48a8-a762-519d7e42111d/plan.md.

Metadata:
  Related Files:  ["themes/great-white-dark-color-theme.json", "themes/great-white-light-color-theme.json", "themes/great-white-storm-color-theme.json", "themes/great-white-frost-color-theme.json", "themes/great-white-hc-dark-color-theme.json", "themes/great-white-hc-light-color-theme.json", "package.json"]
  See Also:       []
  Tags:           ["copilot", "agentic", "ghost-text", "inline-chat", "file-icons", "product-icons", "companion-extension"]
-->

<!--
ID:                       FEAT-20260227-001
Logged:                   2026-02-27
Status:                   resolved
Requested Capability:     Add more Great White variants with gray-red-white-blue contrast plus high-contrast accessibility options.
User Context:             >
  User wanted the original light/dark pair expanded into a broader family with pleasant complementary palettes and explicit accessibility-oriented options.
Complexity:               medium
Suggested Implementation: >
  Add four theme JSON files (`Storm`, `Frost`, `High Contrast Dark`, `High Contrast Light`) by cloning the base dark/light themes, then retune key workbench anchors plus `tokenColors` and `semanticTokenColors` in each file. Register all variants in `package.json`, document palette and accessibility rationale in `README.md`, and package with `vsce package`.

Metadata:
  Related Files:  ["themes/great-white-storm-color-theme.json", "themes/great-white-frost-color-theme.json", "themes/great-white-hc-dark-color-theme.json", "themes/great-white-hc-light-color-theme.json", "package.json", "README.md", "CHANGELOG.md"]
  See Also:       []
  Tags:           ["palette", "accessibility", "high-contrast", "variants"]
-->

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
