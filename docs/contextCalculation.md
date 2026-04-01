# Context Window Popup & Chat Debug Log — How They Work

> **Scope**: Everything documented here lives in the **GitHub Copilot Chat extension** source code (`microsoft/vscode-copilot-chat`). The extension produces and sends data; VS Code's core renders the UI. Both features described below — the Context Window popup and the Chat Debug Log — are implemented entirely within this extension, using proposed VS Code APIs as the hand-off contract.

---

# Prerequisite: Three Things Called "Copilot" in VS Code

If you have a VS Code window open with a **Copilot Chat panel** and a **terminal running `copilot`**, you are looking at outputs from completely separate systems. This section explains what each is and how they relate.

## The Three Components/

| Component | What It Is | Where It Runs | Repo |
|---|---|---|---|
| **GitHub Copilot Chat** (this extension) | VS Code extension providing the chat panel, inline chat, agent mode, edit mode | VS Code extension host process | `microsoft/vscode-copilot-chat` |
| **Copilot CLI** | Standalone agentic coding assistant binary | Its own process (terminal or server mode) | Separate (GitHub internal) |
| **Copilot SDK** | Multi-language library for embedding Copilot agents in your own apps | Your application process | `github/copilot-sdk` |

## How They Connect

```
┌─────────────────────────────────────────────────────────┐
│                   VS Code Window                         │
│                                                          │
│  ┌────────────────────────────┐  ┌────────────────────┐ │
│  │    Chat Panel (this doc)   │  │  Terminal: copilot  │ │
│  │                            │  │                     │ │
│  │  Copilot Chat extension    │  │  Copilot CLI binary │ │
│  │  vendor: "copilot"         │  │  (standalone agent) │ │
│  │                            │  │                     │ │
│  │  ► Context Window popup    │  │  Own context window │ │
│  │  ► Chat Debug Log          │  │  Own tool set       │ │
│  │  ► Token usage tracking    │  │  Own session files  │ │
│  └────────────┬───────────────┘  └──────────┬─────────┘ │
│               │                              │           │
│       GitHub LM API                  GitHub LM API       │
│      (separate requests)           (separate requests)   │
└───────────────┼──────────────────────────────┼───────────┘
                │                              │
                ▼                              ▼
         GitHub's model                 GitHub's model
         routing service                routing service
        (independent quotas per session)
```

## What Is Shared and What Is Not

| Aspect | Shared? | Details |
|---|---|---|
| **LLM model access** | Same backend, separate sessions | Both talk to GitHub's model API, but each sends independent requests with its own context |
| **Session history** | **No** | Chat panel history and CLI conversation history are completely separate |
| **Context window** | **No** | Each maintains its own token budget. The "103.1K / 400K" popup described below is Chat-only |
| **Debug log** | **No** | The Chat Debug Log (Part 2 below) only shows events from Chat sessions, not CLI sessions |
| **Tool set** | **Overlapping but separate** | Chat has VS Code-aware tools (semantic_search, read_file, replace_string_in_file). CLI has its own tools (Bash, Read, Edit, Write). Names may look similar but implementations differ |
| **File edits** | **Visible to both, but uncoordinated** | If CLI writes a file, Chat's next turn will see the changed file on disk (and vice versa), but neither actively monitors the other's edits |
| **GitHub authentication** | **Yes** | Both use the same GitHub account/token from VS Code's auth |
| **Workspace files** | **Yes** | Both can read/write the same workspace files on disk |
| **Premium request quota** | **Yes** | Both count against the same Copilot subscription quota |

## The Copilot CLI Agent (Inside This Extension)

Confusingly, this extension also contains a **Copilot CLI agent** (`src/extension/agents/copilotcli/`) — this is an integration layer that lets VS Code Chat drive a Copilot CLI process as one of its backends (alongside the default agent and the Claude agent). When active, it registers as vendor `"copilotcli"` and creates a completely isolated service tree:

| Agent (inside this extension) | Vendor | Session isolation |
|---|---|---|
| Default (built-in) | `copilot` | Own instantiation service, own token pipeline |
| Claude Agent SDK | `anthropic` | Own instantiation service, own SDK connection |
| Copilot CLI Agent | `copilotcli` | Own instantiation service, own JSON-RPC connection to CLI binary |

Each agent gets a **dedicated child instantiation service** (`chatSessions.ts`), meaning services like models, sessions, and SDK connections are fully isolated. A Chat session using the default agent and a Chat session using the CLI agent **cannot see each other's context, tokens, or debug events** — even though they're both inside the same extension.

> **Bottom line**: If you see a Chat panel and a terminal `copilot` session side by side, they are as independent as two browser tabs on different websites. They share the filesystem and your GitHub login. Everything else — context, history, token budgets, debug logs — is separate. The features documented below (Context Window popup, Chat Debug Log) apply **only** to sessions running through the Copilot Chat extension's agents, not to a standalone CLI in the terminal.

---

# Part 1: Context Window Popup

The Context Window popup (shown when clicking the token counter in chat) has two sides:

- **VS Code** renders the popup UI (progress bar, rows, Compact Conversation button)
- **The Copilot Chat extension** calculates and sends the data via `stream.usage()`

---

## What the Popup Shows

```
┌──────────────────────────────────────────┐
│ Context Window                           │
│ 103.1K / 400K tokens            26%      │  ← Header: used / max
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← Progress bar
│ ░░░ Reserved for response                │  ← Lighter bar section
│                                          │
│ System                                   │
│   System Instructions            5.7%    │  ← Row
│   Tool Definitions               2.8%    │  ← Row
│                                          │
│ User Context                             │
│   Messages                       1.8%    │  ← Row
│   Tool Results                  15.7%    │  ← Row
│                                          │
│       [Compact Conversation]             │  ← Button (VS Code UI)
└──────────────────────────────────────────┘
```

---

## Key Files

| File | Role |
|------|------|
| `src/platform/tokenizer/node/promptTokenDetails.ts` | Core: categorizes tokens and computes percentages |
| `src/extension/intents/node/toolCallingLoop.ts` | Calls `computePromptTokenDetails()` and sends via `stream.usage()` |
| `src/extension/conversation/vscode-node/languageModelAccess.ts` | Defines `maxInputTokens` / `maxOutputTokens` for the model |
| `src/extension/intents/node/agentIntent.ts` | Handles Compact Conversation / `/compact` and re-reports usage |
| `src/extension/prompts/node/agent/summarizedConversationHistory.tsx` | Compaction prompt rendering; passes model-reported `totalPromptTokens` to recalculate breakdown |

---

## Data Flow

```
User sends message in chat
        │
        ▼
toolCallingLoop.ts (line ~917)
  1. Builds prompt → messages[]
  2. Calls computePromptTokenDetails({ messages, tokenizer, tools, maxOutputTokens })
  3. Gets model response with usage.prompt_tokens / completion_tokens
        │
        ▼
promptTokenDetails.ts
  - Walks every message
  - Classifies tokens into categories by message role + XML tags
  - Counts tool definition tokens separately
  - Adds maxOutputTokens as "Reserved for response"
  - Calculates total denominator, converts to percentages
  - Returns ChatResultPromptTokenDetail[]
        │
        ▼
toolCallingLoop.ts (line 929)
  stream.usage({
    promptTokens:      fetchResult.usage.prompt_tokens,      // from model response
    completionTokens:  fetchResult.usage.completion_tokens,  // from model response
    promptTokenDetails,                                       // the % breakdown
  })
        │
        ▼
VS Code renders the popup
```

---

## Header: "103.1K / 400K tokens  26%"

### Used tokens (numerator: 103.1K)
Comes directly from the model's response: `fetchResult.usage.prompt_tokens`
Reported at `toolCallingLoop.ts:929` via `stream.usage({ promptTokens: ... })`.

### Max tokens (denominator: 400K)
Set when the model is registered with VS Code at `languageModelAccess.ts:279`:

```typescript
maxInputTokens: endpoint.modelMaxPromptTokens - baseCount - BaseTokensPerCompletion,
maxOutputTokens: endpoint.maxOutputTokens,
```

- `endpoint.modelMaxPromptTokens` — raw model limit (e.g. 200K for Claude)
- `baseCount` — token count of the base prompt template. Computed by rendering `LanguageModelAccessPrompt` with the tokenizer, then cached in VS Code's `globalState` keyed by `lmBaseCount/<model>` + extension version. Persists across VS Code sessions until the extension is updated.
- `BaseTokensPerCompletion` — static overhead (3 tokens), defined in `src/platform/tokenizer/node/tokenizer.ts`. Represents the `<|im_start|>assistant<|message|>` priming tokens.

The value VS Code shows as "400K" is `maxInputTokens` (the effective available window).

### Percentage (26%)
Computed by VS Code: `used / max × 100`.

---

## Row Breakdown: How Each Category Is Calculated

All row logic lives in `computePromptTokenDetails()` in `promptTokenDetails.ts`.

### Step 1 — Walk every message and classify tokens

| Message Role | Classification Logic |
|---|---|
| **System** (`Raw.ChatRole.System`) | All tokens → **System Instructions** |
| **User** (`Raw.ChatRole.User`) | Text parts are parsed for XML tags. Each tag maps to a category via `tagToLabelMapping`. Untagged/leftover tokens → **Messages** . Image parts → **Files** |
| **Tool** (`Raw.ChatRole.Tool`) | All tokens → **Tool Results** |
| **Assistant** (`Raw.ChatRole.Assistant`) | All tokens → **Messages** (conversation history) |

### Step 2 — XML tag parsing (User messages only)

User message text is scanned for XML tags like `<instructions>`, `<attachment>`, `<error>`, etc. The parser uses a regex (`/<([a-zA-Z_][\w.\-]*)[^>]*>[\s\S]*?<\/\1>/g`) to match opening/closing tag pairs. To prevent double-counting nested tags, it maintains a `processedRanges` array — if a match falls inside a range already processed by an outer tag, it is skipped. Each matched top-level tag maps to one of these labels:

| Label | Tag Count | Example Tags |
|---|---|---|
| **System Instructions** | 56 tags | `<instructions>`, `<toolUseInstructions>`, `<modeInstructions>`, `<outputFormatting>`, `<coding_agent_instructions>`, `<communicationStyle>`, `<reminderInstructions>`, `<notebookInstructions>`, `<editFileInstructions>`, `<replaceStringInstructions>`, `<applyPatchInstructions>`, `<codebaseToolInstructions>`, `<codeSearchInstructions>`, `<grounding>`, `<workflowGuidance>`, `<planning>`, `<high_risk_self_check>`, `<patchFormat>`, `<responseTemplate>`, `<importantReminders>`, and more |
| **Files** | 22 tags | `<attachment>`, `<file>`, `<editorContext>`, `<selection>`, `<cell>`, `<readme>`, `<code-changes>`, `<workspaceFolder>`, `<documentFragment>`, `<languageServerContext>`, `<symbolDefinitions>`, `<projectLabels>`, etc. |
| **Tool Results** | 15 tags | `<error>`, `<compileError>`, `<testFailure>`, `<suggestedFix>`, `<stackFrame>`, `<feedback>`, `<invalidPatch>`, `<correctedEdit>`, `<analysis>`, `<criteria>`, `<actualOutput>`, `<expectedOutput>`, etc. |
| **Messages** | 36 tags | `<userRequest>`, `<context>`, `<environment_info>`, `<workspace_info>`, `<todoList>`, `<conversation-summary>`, `<example>`, `<instruction>`, `<response>`, `<settings>`, `<command>`, `<releaseNotes>`, etc. |

Tags not in the mapping fall through to an explicit `defaultTagMapping` constant → **User Context / Messages**.

Full tag map: `promptTokenDetails.ts` lines 42–208 (`tagToLabelMapping`).

### Step 3 — Add tool definition and reserved output tokens

```typescript
// Tool definitions (e.g., 2.8%)
if (tools && tools.length > 0) {
    const toolTokens = await tokenizer.countToolTokens(tools);
    counts[System][Tools] = toolTokens;
}

// Reserved for response (the lighter bar section)
if (options.maxOutputTokens > 0) {
    counts[System][ReservedOutput] = options.maxOutputTokens;
}
```

### Step 4 — Calculate the total denominator

```typescript
let totalTokens = options.totalPromptTokens;  // from model response if available
if (totalTokens === undefined) {
    totalTokens = await tokenizer.countMessagesTokens(messages);
    if (tools?.length > 0) {
        totalTokens += await tokenizer.countToolTokens(tools);
    }
}
// KEY: reserved output tokens ARE included in the denominator
if (options.maxOutputTokens > 0) {
    totalTokens += options.maxOutputTokens;
}
```

**Important**: `totalPromptTokens` is an optional parameter. In the **main chat flow** (`toolCallingLoop.ts`), it is **not passed** — the denominator is always recomputed from the actual messages and tools. In the **compaction flow** (`summarizedConversationHistory.tsx`), it **is passed** as `summaryResponse.usage.prompt_tokens` from the summarization model response, so the row percentages align with the model's own count.

**Total = (totalPromptTokens ∥ counted_message_tokens + tool_definition_tokens) + maxOutputTokens**

### Step 5 — Convert to percentages

```typescript
const percentage = Math.round((tokenCount / totalTokens) * 100);
// Only rows with percentage > 0 are included
```

---

## Concrete Example (from screenshot)

| Row | Calculation |
|---|---|
| **System Instructions 5.7%** | System-role messages + all `<instructions>`-family XML tags in user messages |
| **Tool Definitions 2.8%** | `tokenizer.countToolTokens(tools)` — the JSON schemas of all available tools |
| **Messages 1.8%** | Assistant messages (history) + untagged user message tokens + `<userRequest>` etc. |
| **Tool Results 15.7%** | All Tool-role messages + `<error>`/`<testFailure>`-family XML tags in user messages |
| **Reserved for response** | `endpoint.maxOutputTokens` — shown as lighter section in progress bar |

Note: percentages may not sum to 26% because they each round independently, and "Reserved for response" is shown visually but may not have a labeled percentage row.

---

## Compact Conversation

The button is rendered by VS Code. When clicked, it triggers the `/compact` command, which the extension handles in `agentIntent.ts`:

1. **Entry**: `handleSummarizeCommand()` (line 224) receives the request when `request.command === 'compact'`
2. **Guard rails**: Returns early if conversation is empty, or if the model already uses Responses API compaction (line 237)
3. **Summarize**: Renders `SummarizedConversationHistory` via `PromptRenderer.create()` with `triggerSummarize: true`
4. **Token breakdown**: Inside `summarizedConversationHistory.tsx`, the summarization calls `computePromptTokenDetails()` — notably passing `totalPromptTokens: summaryResponse.usage.prompt_tokens` from the model response, so the row percentages use the model's own count as the denominator base
5. **Report**: The resulting `promptTokenDetails` and usage are reported via `stream.usage()` at `agentIntent.ts:274`
6. **Persist**: The summary metadata is stored on the conversation turn via `lastTurn.setMetadata()` so subsequent turns see the compacted history
7. VS Code re-renders the popup with the updated (lower) numbers

---

## How VS Code Renders the Popup (the other side of the wall)

The extension only sends data. VS Code owns the entire UI rendering. Here's the contract and what VS Code does with it.

### The API Contract

Defined in `vscode.proposed.chatParticipantAdditions.d.ts` (lines 811–860):

```typescript
interface ChatResultPromptTokenDetail {
    readonly category: string;        // Group header ("System", "User Context")
    readonly label: string;           // Row name ("System Instructions", "Tool Results")
    readonly percentageOfPrompt: number; // 0–100, shown as the row's percentage
}

interface ChatResultUsage {
    readonly promptTokens: number;     // Used tokens (the numerator in "103.1K / 400K")
    readonly completionTokens: number; // Tokens generated in the response
    readonly promptTokenDetails?: readonly ChatResultPromptTokenDetail[];
}
```

The extension calls `stream.usage(usage: ChatResultUsage)` — that's the only hand-off.

### What VS Code Does With the Data

| Popup element | Where the data comes from | How VS Code computes it |
|---|---|---|
| **"103.1K"** (used) | `usage.promptTokens` | Displayed directly (formatted as K/M) |
| **"400K"** (max) | `model.maxInputTokens` | Set at model registration time by the extension (`languageModelAccess.ts:279`). VS Code stores it when the model provider registers. |
| **"26%"** (header %) | — | VS Code computes: `promptTokens / maxInputTokens × 100` |
| **Progress bar fill** | — | Visual width = header percentage |
| **Lighter bar section** | `"Reserved Output"` row | VS Code recognizes the `ReservedOutput` label and renders it as part of the bar (not a separate row) |
| **Category headers** | `detail.category` | `"System"` and `"User Context"` become section headers |
| **Row labels + %** | `detail.label` + `detail.percentageOfPrompt` | Each `ChatResultPromptTokenDetail` becomes one row |
| **[Compact Conversation]** | — | VS Code renders this button when context is high. Clicking triggers `/compact` which the extension handles |

### VS Code's Rendering Rules

1. **Grouping**: Rows are grouped by `category` string. Same category = same section header.
2. **Ordering**: Rows appear in the order the extension provides them (system first, then user context).
3. **Filtering**: Only rows where `percentageOfPrompt > 0` are shown (the extension pre-filters these).
4. **Uncategorized**: If the percentages in `promptTokenDetails` don't sum to 100%, VS Code shows the remainder as "Uncategorized".
5. **Re-rendering**: Calling `stream.usage()` again (e.g., after compact) replaces the previous data and VS Code re-renders.

### The Two Token Denominators (Important!)

There are **two different denominators** and they serve different purposes:

| Value | Set by | Used for |
|---|---|---|
| `maxInputTokens` | Extension → registered on the model | VS Code header: "X / **400K** tokens" and the header percentage |
| `totalTokens` (inside `computePromptTokenDetails`) | Extension-internal only | The row percentage calculation. Equals `prompt_tokens + tool_tokens + maxOutputTokens` |

This means the **header percentage** and the **sum of row percentages** won't match — they use different denominators. The row percentages include reserved output tokens in their denominator; the header percentage does not.

### Model Registration → maxInputTokens

When the extension registers models with VS Code (`languageModelAccess.ts:279`):

```typescript
maxInputTokens: endpoint.modelMaxPromptTokens - baseCount - BaseTokensPerCompletion
```

- `endpoint.modelMaxPromptTokens` — raw model context window (e.g. 200K for Claude 3.5)
- `baseCount` — token count of the base prompt template (cached in `globalState` per model per extension version — see above)
- `BaseTokensPerCompletion` — static 3-token overhead

VS Code stores this per-model and uses it as the "400K" denominator whenever showing the popup for that model.

### Sequence: What Happens When You Click the Token Counter

```
User clicks token counter in chat
        │
        ▼
VS Code looks up the latest ChatResultUsage
(stored from the most recent stream.usage() call for this session)
        │
        ▼
VS Code reads model.maxInputTokens
(from the model registration)
        │
        ▼
Renders popup:
  - Header: promptTokens / maxInputTokens
  - Bar:    promptTokens / maxInputTokens width
  - Rows:   each ChatResultPromptTokenDetail as category → label: percentageOfPrompt%
  - Button: [Compact Conversation] if applicable
```

### What the Extension Controls vs. What VS Code Controls

| Responsibility | Owner |
|---|---|
| Calculate token counts and percentages | **Extension** (`promptTokenDetails.ts`) |
| Decide category names and labels | **Extension** (constants in `promptTokenDetails.ts`) |
| Decide which XML tags map to which rows | **Extension** (`tagToLabelMapping`) |
| Call `stream.usage()` at the right time | **Extension** (`toolCallingLoop.ts`, `agentIntent.ts`) |
| Pass model-reported `totalPromptTokens` during compaction | **Extension** (`summarizedConversationHistory.tsx`) |
| Set `maxInputTokens` / `maxOutputTokens` per model | **Extension** (`languageModelAccess.ts`) |
| Render the popup UI (progress bar, rows, button) | **VS Code** |
| Compute header percentage | **VS Code** (`promptTokens / maxInputTokens`) |
| Group rows by category | **VS Code** |
| Show "Uncategorized" for remainder | **VS Code** |
| Show/handle "Compact Conversation" button | **VS Code** (button) + **Extension** (handler) |
| Format token numbers as "103.1K" | **VS Code** |

---

# Part 2: Chat Debug Log

The Chat Debug log (the debug panel for a chat session) has two sides:

- **VS Code** renders the debug tree UI, persists events to JSONL in workspace storage, handles expand/resolve
- **The Copilot Chat extension** provides a streaming event feed via a proposed API (`vscode.chat.registerChatDebugLogProvider`)

Events flow in a pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Sources (4 inputs)                      │
│  IRequestLogger:            Tool calls, LLM requests, errors     │
│  ITrajectoryLogger:         Loop start/iteration/stop, steps     │
│  ICustomInstructionsService: Instruction/skill discovery          │
│  RedundancyDetector:        Duplicate/oscillation/retry errors    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               AgentDebugEventCollector                           │
│  Subscribes to data sources, normalizes into IAgentDebugEvent    │
│  File: src/extension/agentDebug/node/agentDebugEventCollector.ts │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│          AgentDebugEventServiceImpl (RingBuffer, max 5000)       │
│  In-memory storage with per-session + per-ID indexes             │
│  File: src/extension/agentDebug/node/agentDebugEventServiceImpl.ts│
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│           ChatDebugLogProviderContribution                       │
│  Maps IAgentDebugEvent → ChatDebugEvent (VS Code proposed API)   │
│  Provides initial events + live streaming via progress callback  │
│  File: src/extension/trajectory/vscode-node/chatDebugLogProvider.ts│
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Debug UI                             │
│  Renders event tree, persists to debug-logs/<sessionId>/ JSONL   │
│  Calls resolveChatDebugLogEvent() when user expands an event     │
└─────────────────────────────────────────────────────────────────┘
```

---

## The VS Code Proposed API

Defined in `src/extension/vscode.proposed.chatDebug.d.ts`.

### Event Types (extension → VS Code)

| Class | Key Properties | Used For |
|---|---|---|
| `ChatDebugToolCallEvent` | toolName, toolCallId?, input?, output?, result? (`Success`/`Error`), durationInMillis? | Tool invocations |
| `ChatDebugModelTurnEvent` | model?, inputTokens?, outputTokens?, totalTokens?, durationInMillis? | LLM requests |
| `ChatDebugGenericEvent` | name, details?, level (`Trace`/`Info`/`Warning`/`Error`), category? | Catch-all: discovery, loop control, errors |
| `ChatDebugSubagentInvocationEvent` | agentName, description?, status? (`Running`/`Completed`/`Failed`), durationInMillis?, toolCallCount?, modelTurnCount? | Subagent spawns |
| `ChatDebugUserMessageEvent` | message, sections: `ChatDebugMessageSection[]` | User prompts with structured sections (collapsible XML tag breakdown) |
| `ChatDebugAgentResponseEvent` | message, sections: `ChatDebugMessageSection[]` | Agent responses with structured sections |

`ChatDebugMessageSection` has `name` (section header) and `content` (section body).

### Resolved Content Types (on expand)

The `ChatDebugResolvedEventContent` union type defines what `resolveChatDebugLogEvent` can return:

| Class | When Returned |
|---|---|
| `ChatDebugEventTextContent` | Plain text detail for generic events (`value: string`) |
| `ChatDebugEventMessageContent` | Structured sections with message type (`User`/`Agent`), message string, and sections array |
| `ChatDebugUserMessageEvent` | User message with collapsible sections (one per XML tag) — auto-converted to structured content |
| `ChatDebugAgentResponseEvent` | Agent response with collapsible sections — auto-converted to structured content |

### Provider Interface

```typescript
interface ChatDebugLogProvider {
    // Called when debug view opens for a session. Returns initial events,
    // streams new events via progress callback.
    provideChatDebugLog(
        sessionResource: Uri,       // vscode-chat-session://local/<base64SessionId>
        progress: Progress<ChatDebugEvent>,
        token: CancellationToken
    ): ProviderResult<ChatDebugEvent[]>;

    // Called when user expands an event row. Defers expensive detail loading.
    resolveChatDebugLogEvent?(
        eventId: string,
        token: CancellationToken
    ): ProviderResult<ChatDebugResolvedEventContent>;
}
```

### Shared Event Properties

Every event has:
- `id` — unique identifier
- `created` — timestamp
- `parentEventId` — for building hierarchical trees (tool calls nest under model turns, subagent children nest under SubAgent started)
- `sessionResource` — optional session attribution override

---

## Data Sources

### 1. IRequestLogger (`src/platform/requestLogger/node/requestLogger.ts`)

Central log that captures all LLM interactions and tool calls during a chat session. The collector subscribes via `onDidChangeRequests()`.

| LoggedInfoKind | What It Captures | Debug Event Produced |
|---|---|---|
| `ToolCall` | Tool name, args, response, timestamp, subagent metadata | `IToolCallEvent` (category: ToolCall) |
| `Request` (ChatMLSuccess/Failure) | LLM request/response, token usage, timing, debug name | `ILLMRequestEvent` (category: LLMRequest) |
| `Request` (ChatMLFailure) | Error reason from failed LLM call | `IErrorEvent` (category: Error) |

**Session ID resolution**: The collector reads `entry.token.chatSessionId` from the `CapturingToken`. The resolution hierarchy is:

1. `rawSessionId` = `entry.token?.chatSessionId` (highest priority — direct session attribution)
2. `subAgentSession` = look up `token.subAgentInvocationId` in `_subAgentSessionId` map → mapped parent session
3. `this._lastKnownSessionId` (fallback — last session seen)
4. `'unknown'` (last resort)

A session ID is considered "definitive" if it comes from path 1 or 2. LLM request and error events are **only** emitted when a definitive session ID exists, preventing non-conversation requests (e.g., background tokenization) from leaking into wrong sessions.

**Memory management**: The collector subscribes to an event-clearing listener that resets all subagent tracking maps (`_subAgentEventId`, `_subAgentSessionId`, `_subAgentNames`, `_subAgentStarted`, `_loopStartEventId`) to prevent unbounded growth.

### 2. ITrajectoryLogger (`src/platform/trajectory/common/trajectoryLogger.ts`)

Builds the ATIF (Agent Trajectory Interchange Format) for each session. The collector subscribes via `onDidUpdateTrajectory()`.

| Trajectory Data | Debug Event Produced |
|---|---|
| First step in a trajectory | `ILoopControlEvent` (action: start, summary: "Loop started: \<agent\>") |
| Step with `source: 'user'` | `ILoopControlEvent` (action: iteration, summary: "User message") |
| Step with `source: 'system'` | `ILoopControlEvent` (action: iteration, summary: "System message") |
| Step with `source: 'agent'` | `ILoopControlEvent` (action: iteration, summary: "Agent response (model) → N tool calls: names") |
| `trajectory.final_metrics` present | `ILoopControlEvent` (action: stop, summary: "Loop stopped: N steps, M tokens") |

### 3. ICustomInstructionsService

On startup, the collector calls `getAgentInstructions()` and emits one `IDiscoveryEvent` per known instruction/skill file. Additional discovery events are emitted when the agent reads a skill or instruction file via `read_file` tool (detected by the `_emitSkillOrInstructionReadEvent` method).

| Discovery Data | Details |
|---|---|
| `resourceType` | `'instruction'` or `'skill'` (determined by `isSkillFile()`) |
| `source` | `'workspace'` |
| `matched` | Always `true` for discovered files |
| `resourcePath` | `fsPath` of the instruction/skill URI |

**Startup discovery** events use `sessionId: 'global'` since they occur before any chat session is active. Runtime discovery events (when a skill/instruction file is read via `read_file` tool during a session) use the actual session ID and are parented to the `read_file` tool call event via `_emitSkillOrInstructionReadEvent()`. This method determines whether a file is a skill or instruction by checking the file extension and calling `getSkillInfo()` for skills.

### 4. RedundancyDetector (`src/extension/agentDebug/common/redundancyDetector.ts`)

Analyzes tool call events inline and emits `IErrorEvent` (type: `'redundancy'`) when it detects:

| Pattern | Detection Logic | Threshold | Fires |
|---|---|---|---|
| **Duplicate** | Same `toolName + argsSummary` (exact `callKey`) seen again | 2nd occurrence | Once per unique callKey (at the threshold crossing only) |
| **Excessive retry** | Same `callKey` (tool + identical args) called consecutively | `MAX_RETRY_THRESHOLD` = 3 consecutive | Every call at or above threshold |
| **Oscillation** | A→B→A→B pattern in last 4 entries of an 8-element sliding window; A ≠ B required | Exactly 2 complete half-cycles (4 calls) | Once when the pattern first appears |

> **Note on excessive retry**: The doc originally said "same tool called consecutively" — in the code, the check is `callKey === this._lastToolKey` where `callKey = toolName|argsSummary`, so it detects the same tool with **identical arguments** called back-to-back, not just the same tool name with different arguments.

---

## Internal Event Categories

Defined in `src/extension/agentDebug/common/agentDebugTypes.ts`:

```typescript
const enum AgentDebugEventCategory {
    Discovery    = 'discovery',     // Instruction/skill/agent/prompt matching
    ToolCall     = 'toolCall',      // Tool invocations
    LLMRequest   = 'llmRequest',    // Language model request/response
    Error        = 'error',         // Failures, rate limits, redundancy
    LoopControl  = 'loopControl',   // Agent lifecycle (start/iteration/stop)
}
```

### Event Interfaces

| Interface | Key Fields |
|---|---|
| `IDiscoveryEvent` | resourceType (`'instruction'` / `'skill'` / `'agent'` / `'prompt'`), source (`'workspace'` / `'user'` / `'org'` / `'extension'`), resourcePath, matched, applyToPattern, discoveryDurationMs |
| `IToolCallEvent` | toolName, argsSummary, status (`'pending'` / `'success'` / `'failure'`), durationMs, resultSummary, errorMessage, isSubAgent, childCount, subAgentName |
| `ILLMRequestEvent` | requestName, durationMs, promptTokens, completionTokens, cachedTokens, totalTokens, status (`'success'` / `'failure'` / `'canceled'`), errorMessage |
| `IErrorEvent` | errorType (`'toolFailure'` / `'rateLimit'` / `'contextOverflow'` / `'timeout'` / `'networkError'` / `'redundancy'`), originalError, toolName |
| `ILoopControlEvent` | loopAction (`'start'` / `'iteration'` / `'yield'` / `'stop'`), iterationIndex, reason |

All events share: `id`, `timestamp`, `category`, `sessionId`, `summary`, `details` (Record<string, unknown>), `parentEventId?`.

### Supporting Types

```typescript
// Filter interface for querying events
interface IAgentDebugEventFilter {
    readonly categories?: readonly AgentDebugEventCategory[];
    readonly sessionId?: string;
    readonly timeRange?: { readonly start: number; readonly end: number };
    readonly statusFilter?: string;  // Matches ToolCallEvent.status or LLMRequestEvent.status
}

// Session-level aggregation
interface ISessionSummary {
    readonly toolCount: number;
    readonly totalTokens: number;
    readonly durationMs: number;
    readonly errorCount: number;
    readonly cachedTokenRatio: number;
}
```

---

## In-Memory Storage: AgentDebugEventServiceImpl

File: `src/extension/agentDebug/node/agentDebugEventServiceImpl.ts`

Uses a **RingBuffer** (fixed-capacity circular buffer) with `DEFAULT_MAX_EVENTS = 5000`. The ring buffer uses O(1) insertion — when at capacity, the oldest item is overwritten. Provides:

| Index | Purpose |
|---|---|
| `_events` (RingBuffer) | All events in insertion order; oldest auto-evicted at capacity. Iterates from oldest → newest. |
| `_sessionEvents` (Map<string, IAgentDebugEvent[]>) | Per-session lists for fast session lookups |
| `_eventById` (Map<string, IAgentDebugEvent>) | O(1) lookup by event ID |

When an event is evicted from the ring buffer, it's also removed from both secondary indexes (and the session entry is deleted if its list becomes empty). Fires `onDidAddEvent` for live streaming and `onDidClearEvents` for cleanup. Supports `clearEvents(sessionId?)` to clear all events or a single session's events.

**Filtering**: `getEvents(filter?)` supports filtering by `categories[]`, `sessionId`, `timeRange`, and `statusFilter` (matches `IToolCallEvent.status` or `ILLMRequestEvent.status`).

**Query methods**: `hasSessionData(sessionId)` for boolean existence check, `getSessionIds()` for listing all sessions with data.

---

## How Events Become VS Code ChatDebugEvents

The `ChatDebugLogProviderContribution` (`src/extension/trajectory/vscode-node/chatDebugLogProvider.ts`) bridges internal events to the VS Code API. It uses two parallel sources:

### Source 1: Trajectory Steps (primary)

Trajectory steps come directly from `ITrajectoryLogger.getAllTrajectories()`. These provide the full conversation flow:

- **User steps** → `ChatDebugGenericEvent` with category `'trajectory'` (resolves to `ChatDebugUserMessageEvent` on expand)
- **System steps** → `ChatDebugGenericEvent`
- **Agent steps without tool calls** → `ChatDebugGenericEvent` (resolves to `ChatDebugAgentResponseEvent` on expand)
- **Agent steps with tool calls** → **Skipped** (already represented by enriched ToolCall events from source 2)

### Source 2: Agent Debug Events (supplementary)

Enriched events from `IAgentDebugEventService.getEvents({ sessionId })`:

| Internal Category | VS Code Event Class | Log Level |
|---|---|---|
| `ToolCall` (non-subagent) | `ChatDebugToolCallEvent` with 🛠 prefix | Info (success) / Warning (failure) |
| `ToolCall` (isSubAgent=true) | `ChatDebugSubagentInvocationEvent` | Info |
| `LLMRequest` | `ChatDebugModelTurnEvent` | Info (success) / Error (failure) |
| `Discovery` | `ChatDebugGenericEvent` with 📖 (skill) / 📋 (instruction) icon | Info |
| `Error` | `ChatDebugGenericEvent` with Error level | Error |
| `LoopControl` | **Skipped** (duplicates trajectory steps) | — |

Log level mapping is handled by `eventCategoryToLogLevel()` which maps `ChatDebugLogLevel` (`Trace`, `Info`, `Warning`, `Error`) based on category and individual event status.

### Merging and Sorting

1. Collect all trajectory step events (source 1)
2. Collect all non-LoopControl events from debug service (source 2)
3. Sort combined list by `created` timestamp
4. Return as initial batch

### Live Streaming

After returning initial events, the provider registers two listeners:

- `_trajectoryLogger.onDidUpdateTrajectory()` → streams new trajectory steps via `progress.report()`
- `_debugEventService.onDidAddEvent()` → streams new tool/LLM/discovery/error events

Both listeners are disposed on cancellation. A `reportedEventIds` set prevents duplicate emission.

---

## Event Hierarchy (Parent-Child Relationships)

Events form a tree via `parentEventId`:

```
Loop started: copilot-agent           ← ILoopControlEvent (action: start)
├── User message                      ← Trajectory step (from source 1)
├── 🛠 semantic_search                ← IToolCallEvent (parentEventId → loop start)
├── ChatDebugModelTurnEvent           ← ILLMRequestEvent (parentEventId → loop start)
├── Agent response (gpt-4o)           ← Trajectory step (from source 1)
├── SubAgent started: Explore         ← IToolCallEvent (isSubAgent, parentEventId → loop start)
│   ├── 🛠 grep_search               ← IToolCallEvent (parentEventId → SubAgent started)
│   ├── 🛠 read_file                 ← IToolCallEvent (parentEventId → SubAgent started)
│   │   └── 📖 Skill read: foo       ← IDiscoveryEvent (parentEventId → read_file)
│   └── SubAgent completed            ← IToolCallEvent (parentEventId → loop start)
├── 🛠 replace_string_in_file        ← IToolCallEvent (parentEventId → loop start)
└── Loop stopped: 5 steps, 12K tokens ← ILoopControlEvent (action: stop)
```

The `_loopStartEventId` map tracks the loop-start event per session so all top-level events can reference it.

**SubAgent hierarchy**: The collector tracks `_subAgentEventId`, `_subAgentSessionId`, and `_subAgentNames` maps. When a child tool call has `token.subAgentInvocationId`, it's parented to the "SubAgent started" event. The first child triggers the "SubAgent started" marker emission. All children share the parent's session ID.

---

## Session ID Resolution

The session URI from VS Code is `vscode-chat-session://local/<base64EncodedSessionId>`. The provider decodes it:

```typescript
const pathSegment = sessionResource.path.replace(/^\//, '').split('/').pop() || '';
const sessionId = pathSegment ? Buffer.from(pathSegment, 'base64').toString('utf-8') : sessionResource.toString();
```

This decoded UUID matches the `sessionId` field on all internal events.

---

## Resolve: What Happens When You Expand an Event

When the user clicks an event row, VS Code calls `resolveChatDebugLogEvent(eventId)`:

1. **Check trajectory step map first** (the provider caches steps in `_trajectoryStepMap`):
   - **User step** → `ChatDebugUserMessageEvent` with sections built from XML tags in the message (`buildUserMessageSections` parses `<userRequest>`, `<context>`, `<instructions>`, etc. into collapsible `ChatDebugMessageSection` items)
   - **Agent step** → `ChatDebugAgentResponseEvent` with sections: Response, Reasoning, Tool Calls, Tool Results
   - **Other** → `ChatDebugEventTextContent` with full step contents

2. **Check debug event service** (`getEventById`):
   - **LoopControl** → Rich text with message, reasoning, tool calls, observations, metrics
   - **ToolCall** → Tool name, Status, SubAgent, Arguments, Duration, Result, Error
   - **LLMRequest** → Request name, Status, Duration, Prompt/Completion/Cached/Total tokens
   - **Error** → Error type, original error, tool name
   - **Discovery** → Key-value details from event

### User Message Section Parsing

`buildUserMessageSections()` scans the raw user message text for top-level XML tags and splits them into named sections:

```
<userRequest>fix the bug</userRequest>
<context>...</context>
<instructions>...</instructions>
```

Each tag becomes a `ChatDebugMessageSection(tagName, content)` rendered as a collapsible section in the UI. The parser uses regex with **nesting depth tracking** — a `<instructions>` tag containing `<instructions>` inside won't split incorrectly. Unclosed or mismatched tags are skipped gracefully. Any trailing text after the last matched tag is included as an "Other" section.

### Agent Response Section Parsing

`buildAgentResponseSections()` extracts structured sections from agent trajectory steps:

| Section | Content |
|---|---|
| **Response** | The agent's text message content |
| **Reasoning** | The model's reasoning/thinking (if present) |
| **Tool Calls** | JSON-formatted tool call names and arguments |
| **Tool Results** | Tool result content and subagent references |

---

## View Logic (Pure, Framework-Agnostic)

File: `src/extension/agentDebug/common/agentDebugViewLogic.ts`

Contains zero `vscode.*` imports — designed to work in both extension host and webview:

| Function | Purpose |
|---|---|
| `buildEventTree(events)` | Builds parent→children tree from flat event list using `parentEventId`. Two-pass algorithm: creates nodes, then wires parents. Returns top-level `IEventTreeNode[]`. |
| `groupEventsBySession(events)` | Groups events into `Map<sessionId, events[]>` |
| `filterEvents(events, filter)` | Applies category/session/timeRange filters |
| `getEventIcon(event)` | Returns codicon name: `search` / `tools` / `cloud` / `error` / `sync` |
| `getEventStatusClass(event)` | Returns CSS class: `status-success` / `status-error` / `status-warning` / `status-info` |
| `formatEventDetail(event)` | Returns `Record<string, string>` of key-value pairs for display |
| `sortEventsChronologically(events)` | Sorts events by timestamp ascending, returns new sorted array |
| `computeSessionSummary(events)` | Aggregates: toolCount, totalTokens, cachedTokens, errorCount, durationMs, cachedTokenRatio → `ISessionSummary` |
| `formatCategoryLabel(category)` | Maps category enum → human-readable string: `'Discovery'`, `'Tool Call'`, `'LLM Request'`, `'Error'`, `'Loop Control'` |
| `formatDuration(ms)` | Formats milliseconds as human-readable: `"500ms"`, `"1.5s"`, `"2:30"` |
| `formatTimestamp(timestamp)` | Formats `Date.getTime()` number as `HH:MM:SS.mmm` |

---

## What the Extension Controls vs. What VS Code Controls

| Responsibility | Owner |
|---|---|
| Subscribe to data sources (RequestLogger, TrajectoryLogger, CustomInstructions) | **Extension** (`AgentDebugEventCollector`) |
| Normalize events into `IAgentDebugEvent` with categories | **Extension** (`AgentDebugEventCollector`) |
| Store events in RingBuffer with indexes | **Extension** (`AgentDebugEventServiceImpl`) |
| Detect redundancy patterns (duplicate, oscillation, retry) | **Extension** (`RedundancyDetector`) |
| Map internal events to `ChatDebugEvent` classes | **Extension** (`ChatDebugLogProviderContribution`) |
| Build parent-child hierarchy via `parentEventId` | **Extension** (collector sets parent IDs) |
| Provide structured sections for user/agent messages | **Extension** (`buildUserMessageSections`, `buildAgentResponseSections`) |
| Register provider via `vscode.chat.registerChatDebugLogProvider()` | **Extension** |
| Render the debug tree UI | **VS Code** |
| Persist events to `debug-logs/<sessionId>/` JSONL files | **VS Code** |
| Call `provideChatDebugLog()` when debug view opens | **VS Code** |
| Call `resolveChatDebugLogEvent()` when user expands a row | **VS Code** |
| Display collapsible sections from `ChatDebugMessageSection` | **VS Code** |
| Handle session URI scheme (`vscode-chat-session://`) | **VS Code** |

---

## Quick Reference: Start Here

### Context Window Popup

| Goal | File |
|---|---|
| Change how tokens are categorized | `src/platform/tokenizer/node/promptTokenDetails.ts` (tag map at lines 42–208, `computePromptTokenDetails` at line 290+) |
| Change what gets reported to VS Code | `src/extension/intents/node/toolCallingLoop.ts` (lines 917–935) |
| Change model max token limits | `src/extension/conversation/vscode-node/languageModelAccess.ts` (line 279) |
| Debug compaction behavior | `src/extension/intents/node/agentIntent.ts` (line 224+), `src/extension/prompts/node/agent/summarizedConversationHistory.tsx` |
| Understand the VS Code API contract | `src/extension/vscode.proposed.chatParticipantAdditions.d.ts` (lines 811–860) |
| Change the base prompt token overhead | `src/platform/tokenizer/node/tokenizer.ts` (line 37, `BaseTokensPerCompletion`) |

### Chat Debug Log

| Goal | File |
|---|---|
| Change how events are collected from data sources | `src/extension/agentDebug/node/agentDebugEventCollector.ts` |
| Change internal event types or add new categories | `src/extension/agentDebug/common/agentDebugTypes.ts` |
| Change in-memory storage behavior or capacity | `src/extension/agentDebug/node/agentDebugEventServiceImpl.ts` |
| Change how internal events map to VS Code debug events | `src/extension/trajectory/vscode-node/chatDebugLogProvider.ts` |
| Change redundancy detection thresholds or patterns | `src/extension/agentDebug/common/redundancyDetector.ts` |
| Change view-logic helpers (tree building, icons, formatting) | `src/extension/agentDebug/common/agentDebugViewLogic.ts` |
| Understand the VS Code proposed API contract | `src/extension/vscode.proposed.chatDebug.d.ts` |

---

> **Note on line numbers**: Line numbers referenced throughout this document were verified against the codebase as of April 2026. They may drift as the codebase evolves — use the function/constant names as the primary locators.
