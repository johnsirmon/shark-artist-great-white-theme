# Learnings

Append an entry whenever a non-obvious pattern, rule, or insight is discovered while building this theme.
If the same Pattern-Key appears again, bump Recurrence-Count and raise Priority.

---

## Template

<!--
ID:               LRN-YYYYMMDD-001
Logged:           YYYY-MM-DD
Priority:         low | medium | high | critical
Status:           open | in-progress | resolved | promoted
Area:             palette | scopes | workbench | consistency | release | conventions
Summary:          One line.
Details:          >
  What happened, what was wrong or surprising, what was learned.
Suggested Action: >
  Concrete change: which file, which key, what value, what rule to remember.

Metadata:
  Source:           file or session reference
  Related Files:    []
  Tags:             []
  See Also:         []
  Pattern-Key:      unique-slug
  Recurrence-Count: 1
-->

---

## Entries

<!-- Add new entries below this line, newest first. -->

<!--
ID:               LRN-20260302-001
Logged:           2026-03-02
Priority:         high
Status:           resolved
Area:             conventions
Summary:          VS Code file icon themes are mutually exclusive and must provide generic fallbacks.
Details:          >
  The "Agent File Icons" theme was initially "sparse" (only defining icons for agent files).
  Because VS Code only allows one file icon theme at a time, enabling this theme caused all other
  files (js, ts, standard folders) to lose their icons entirely. "Partial" or "extension" icon themes
  are not supported.
Suggested Action: >
  Always include generic fallback icons (`_file`, `_folder`, `_folder_open`, `_root_folder`, `_root_folder_open`)
  in any custom file icon theme, even if it is specialized.

Metadata:
  Source:           Session 2026-03-02
  Related Files:    ["themes/great-white-agent-file-icons.json"]
  Tags:             ["file-icons", "exclusivity", "fallback"]
  See Also:         []
  Pattern-Key:      file-icon-theme-exclusivity
  Recurrence-Count: 1
-->

<!--
ID:               LRN-20260301-001
Logged:           2026-03-01
Priority:         medium
Status:           open
Area:             conventions
Summary:          Experimental local workspaces must be fully gitignored on main, not just partially excluded.
Details:          >
  .midjourney-workspace/ was added to .gitignore on the feature branch only for its working
  subdirectories (incoming/, output-svg/, logs/, bin/). The scripts, prompts, and README were
  tracked in git on the feature branch. Main had no gitignore guard at all, so a merge would
  have silently pulled the entire workspace into main.
Suggested Action: >
  Any local experimental workspace folder must have its root path added to .gitignore (e.g.,
  `.midjourney-workspace/`) so the entire folder is excluded from all branches. Partial exclusions
  of only subdirectories are insufficient. Document the folder's local-only status in AGENTS.md.

Metadata:
  Source:           Session 2026-03-01
  Related Files:    [".gitignore", "AGENTS.md", "docs/icon-update-process.md"]
  Tags:             ["gitignore", "experimental", "workspace", "merge-guard"]
  See Also:         []
  Pattern-Key:      experimental-workspace-gitignore-guard
  Recurrence-Count: 1
-->
