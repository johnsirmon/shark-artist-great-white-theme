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
ID:               LRN-20260401-002
Logged:           2026-04-01
Priority:         high
Status:           resolved
Area:             conventions
Summary:          CLI events.jsonl field map — session.shutdown is the authoritative token source; session.start has no selectedModel; tool results are in data.result not data.content.
Details:          >
  Deep review of real events.jsonl files revealed three bugs in the original SessionWatcher:
  1. session.start has NO selectedModel field — model must come from tool.execution_complete.data.model
     or session.shutdown.data.currentModel.
  2. tool.execution_complete carries data.result (object), NOT data.content (string).
  3. session.shutdown is the only event with authoritative token data: currentTokens, systemTokens,
     conversationTokens, toolDefinitionsTokens, currentModel. All fields are camelCase.
  Additionally: outputTokens (completion tokens) must NOT be included in the contextPercent
  numerator — they do not consume input context window space. The correct formula is
  promptTokens / maxInputTokens. For active sessions, SYSTEM_OVERHEAD_TOKENS = 46_000
  (12K system prompt + 34K tool definitions) is a realistic base overhead constant.
Suggested Action: >
  When reading events.jsonl, always check session.shutdown for authoritative data first.
  Never add outputTokens to context fill calculations. When session.shutdown is absent
  (active session), use SYSTEM_OVERHEAD_TOKENS + conversationInputEstimate + toolResultTokensEstimate
  as the heuristic, divided by getContextWindowSize(model).
  Derive isEstimated AFTER the two-track branch (not from the shutdown event directly) to
  prevent flag/track mismatch when shutdown fires but currentTokens=0.

Metadata:
  Source:           Session 2026-04-01 context gauge accuracy fix
  Related Files:    [src/sessionWatcher.ts, docs/context_calculation_reviewed.md]
  Tags:             [context-gauge, events-jsonl, token-calculation]
  See Also:         []
  Pattern-Key:      cli-events-jsonl-field-map
  Recurrence-Count: 1
-->

<!--
ID:               LRN-20260401-001
Logged:           2026-04-01
Priority:         high
Status:           resolved
Area:             release
Summary:          Never paste a PAT into chat; env var is named VSCE (not VSCE_PAT); pull from User scope before publishing.
Details:          >
  A Marketplace PAT was accidentally pasted into the Copilot chat window. The token was immediately
  revoked. Chat input is transmitted to remote servers, written to local debug log files
  (VSCODE_TARGET_SESSION_LOG), and visible in conversation history — any of these can be
  compromised.
  The User-scope env var holding the Marketplace PAT is named VSCE (not VSCE_PAT).
  User-scope env vars are NOT automatically loaded into already-open terminal sessions —
  you must pull them in manually with GetEnvironmentVariable before use.
Suggested Action: >
  Exact publish command (one-liner, works in any terminal session):
    $env:VSCE_PAT = [System.Environment]::GetEnvironmentVariable("VSCE","User"); vsce publish --pat $env:VSCE_PAT
  To save a new token to the User env var:
    [System.Environment]::SetEnvironmentVariable("VSCE", (Read-Host "Paste PAT"), "User")
  Revoke and regenerate any PAT that was exposed in chat, logs, or docs immediately.

Metadata:
  Source:           Session 2026-04-01
  Related Files:    ["docs/release-checklist.md"]
  Tags:             ["release", "publish", "PAT", "security", "vsce"]
  See Also:         [LRN-20260307-001]
  Pattern-Key:      pat-never-paste-in-chat
  Recurrence-Count: 1
-->

<!--
ID:               LRN-20260307-001
Logged:           2026-03-07
Priority:         medium
Status:           open
Area:             release
Summary:          vsce Marketplace PAT is separate from AZDO_PAT and must be renewed independently; use VSCE_PAT env var, not AZDO_PAT.
Details:          >
  The repo's AZDO_PAT environment variable is a general Azure DevOps PAT used for other tooling.
  It is not the same as the Marketplace publish credential. When it expires, `vsce publish --pat $env:AZDO_PAT`
  fails. The correct Marketplace PAT must be scoped to Marketplace → Manage and stored either via
  `vsce login shark-labs` (updates Windows Credential Manager: vscode-vsce/shark-labs) or as $env:VSCE_PAT.
  vsce 3.7.1 also offers `--azure-credential` (Entra ID) but requires explicit Marketplace Manage permissions
  on the identity, which a standard work account may not have.
Suggested Action: >
  Update `docs/release-checklist.md` Publish section to note:
  - Use `vsce login shark-labs` with a Marketplace-scoped PAT (not AZDO_PAT)
  - PAT scope required: Marketplace → Manage
  - PAT is created at https://aex.dev.azure.com/me (profile avatar → Personal access tokens) — NOT at marketplace.visualstudio.com or the Azure Portal
  - Organization must be set to 'All accessible organizations' (not a specific org)
  - Recommended expiry: 1 year, calendar reminder to renew
  - Fallback: `vsce publish --pat <token>` with a fresh token pasted inline

Metadata:
  Source:           Session 2026-03-07
  Related Files:    ["docs/release-checklist.md"]
  Tags:             ["release", "publish", "PAT", "vsce"]
  See Also:         [ERR-20260307-001]
  Pattern-Key:      vsce-marketplace-pat-separate-from-azdo-pat
  Recurrence-Count: 1
-->

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
