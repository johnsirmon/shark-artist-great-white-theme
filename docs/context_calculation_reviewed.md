# Context Window Popup & Chat Debug Log — How They Work (Reviewed and Updated)

> **Scope**: This document describes how these features currently work in the **GitHub Copilot Chat extension** source tree (`microsoft/vscode-copilot-chat`) and how they connect to VS Code proposed APIs. The extension computes and reports the data; VS Code renders the UI.

> **Important**: The original draft mixed current behavior with some older implementation details. This version updates the token-usage and debug-log sections to match the current architecture more closely.

---

# Prerequisite: Three Different Things Called "Copilot" in VS Code

If you have a VS Code window open with a **Copilot Chat panel** and a **terminal running `copilot`**, you are looking at outputs from different systems.

| Component | What It Is | Where It Runs | Repo |
|---|---|---|---|
| **GitHub Copilot Chat** | VS Code extension providing the chat panel, inline chat, edit mode, and agent mode | VS Code extension host | `microsoft/vscode-copilot-chat` |
| **Copilot CLI** | Standalone agentic coding assistant process | Terminal / separate process | Separate repo / product |
| **Copilot SDK** | Library for embedding Copilot agents in apps | Your app process | `github/copilot-sdk` |

## What Is Shared vs Not Shared

| Aspect | Shared? | Notes |
|---|---|---|
| GitHub auth | Yes | Same signed-in GitHub identity can back multiple surfaces |
| Workspace files | Yes | Both can read/write the same files on disk |
| Model backend | Same provider family, separate requests | They may hit the same backend service, but requests and contexts are separate |
| Session history | No | Chat panel history and CLI history are independent |
| Context window accounting | No | The chat panel’s token widget reflects the chat session only |
| Debug log | No | Chat debug log is for chat sessions, not arbitrary terminal CLI sessions |
| Tool execution pipeline | Overlapping concepts, separate implementations | Tool names may overlap, but the stacks are separate |

## Copilot CLI Agent Inside This Extension

This extension also contains an integration path for a Copilot CLI-backed agent. Even when that path is used, session state and usage reporting are isolated at the chat-session level. The important practical point is:

> A Chat session using one agent backend should be treated as isolated from other backends for context, usage, and debugging purposes.

---

# Part 1: Context Window Popup

The Context Window popup is a cooperation between:

- **The Copilot Chat extension**, which calculates and reports usage data
- **VS Code**, which renders the popup UI

---

## What the Popup Shows

The popup can show:

- Current prompt usage
- Maximum input window for the selected model
- A category breakdown of prompt composition
- Reserved output capacity as a separate visual/input to the widget
- A **Compact Conversation** action when applicable

Conceptually it looks like this:

```text
┌──────────────────────────────────────────┐
│ Context Window                           │
│ 103.1K / 400K tokens            26%      │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                          │
│ System                                   │
│   System Instructions            6%      │
│   Tool Definitions               3%      │
│                                          │
│ User Context                             │
│   Messages                       2%      │
│   Files                          8%      │
│   Tool Results                  16%      │
│                                          │
│       [Compact Conversation]             │
└──────────────────────────────────────────┘
```

---

## Key Files

| File | Role |
|---|---|
| `src/platform/tokenizer/node/promptTokenDetails.ts` | Computes category/label token percentages |
| `src/extension/intents/node/toolCallingLoop.ts` | Calls `computePromptTokenDetails()` and reports usage with `stream.usage(...)` |
| `src/extension/conversation/vscode-node/languageModelAccess.ts` | Registers models and defines `maxInputTokens` / `maxOutputTokens` |
| `src/extension/prompts/node/agent/summarizedConversationHistory.tsx` | Compaction and summarization flow, including recomputed prompt details |

---

## Current Data Flow

```text
User sends message in chat
        │
        ▼
ToolCallingLoop.runOne()
  1. Builds prompt → messages[]
  2. Computes promptTokenDetails from messages + tools
  3. Sends request to model
  4. Receives model usage.prompt_tokens / usage.completion_tokens
        │
        ▼
stream.usage({
  promptTokens,
  completionTokens,
  outputBuffer,
  promptTokenDetails
})
        │
        ▼
VS Code renders the popup
```

---

## Header: "103.1K / 400K tokens"

### Used tokens (numerator)

This comes from the model response usage returned by the request.

### Max tokens (denominator)

This comes from model registration in `languageModelAccess.ts`:

```ts
maxInputTokens: endpoint.modelMaxPromptTokens - baseCount - BaseTokensPerCompletion,
maxOutputTokens: endpoint.maxOutputTokens,
```

Where:

- `endpoint.modelMaxPromptTokens` = raw prompt limit for the model
- `baseCount` = cached token count of the base prompt template
- `BaseTokensPerCompletion` = static completion overhead

### Percentage

VS Code computes the header percentage from:

```text
promptTokens / maxInputTokens
```

---

## What `promptTokenDetails` Actually Contains Now

The current implementation produces only these labels:

### Category: `System`

- `System Instructions`
- `Tool Definitions`

### Category: `User Context`

- `Messages`
- `Files`
- `Tool Results`

That means:

> **Reserved response capacity is no longer represented as a `promptTokenDetails` row.**

Instead, reserved output capacity is reported separately as `outputBuffer` in `stream.usage(...)`.

---

## Current Token Classification Rules

All row logic is driven by `computePromptTokenDetails()`.

### System-role messages

All tokens in system-role messages count toward:

- `System / System Instructions`

### User-role messages

User content is scanned for top-level XML-style tags emitted by prompt-tsx.

Mapped tags are grouped into one of:

- `System Instructions`
- `Files`
- `Tool Results`
- `Messages`

Unknown tags default to:

- `User Context / Messages`

### Tool-role messages

All tool-role messages count toward:

- `User Context / Tool Results`

### Assistant-role messages

Assistant messages count toward:

- `User Context / Messages`

### Images and documents

Image and document parts in user messages count toward:

- `User Context / Files`

### Tool definitions

Available tools are counted separately and assigned to:

- `System / Tool Definitions`

---

## Important Correction: No Separate "Reserved for response" Row in `promptTokenDetails`

An older version of this explanation treated reserved output as:

- a separate prompt-details row, and
- part of the row-percentage denominator

That is no longer the right model.

### Current behavior

- `promptTokenDetails` percentages are computed from the prompt content plus tool definitions
- reserved output capacity is reported separately as `outputBuffer`
- VS Code may render output reservation in the widget, but it is **not** a label emitted by `computePromptTokenDetails()`

So the safest mental model is:

- **Header** = actual prompt usage vs effective model input limit
- **Rows** = breakdown of prompt composition only
- **Output buffer** = separately reported reserved output capacity

---

## `stream.usage(...)` Contract Used by the Extension

The extension currently reports usage like this conceptually:

```ts
stream.usage({
  promptTokens: fetchResult.usage.prompt_tokens,
  completionTokens: fetchResult.usage.completion_tokens,
  outputBuffer: endpoint.maxOutputTokens,
  promptTokenDetails,
})
```

This is the hand-off to VS Code.

---

## XML Tag Mapping Notes

The current `tagToLabelMapping` is extensive and includes categories such as:

- instruction-oriented tags like `instructions`, `toolUseInstructions`, `workflowGuidance`, `progress_updates`
- file/context tags like `attachment`, `file`, `editorContext`, `selection`, `documentFragment`
- tool-result tags like `error`, `testFailure`, `stackFrame`, `actualOutput`, `expectedOutput`
- message/history tags like `userRequest`, `context`, `conversation-summary`, `response`, `settings`

The broad idea is stable even though the exact tag list can evolve over time.

---

## Subagent Usage Isolation

One subtle but important behavior in `ToolCallingLoop` is that the context widget is intended to represent the **parent request only**.

Subagent requests do not report their usage into the parent widget. This avoids inflating the top-level context display with child-agent work.

This is a useful design pattern for any custom extension that fans out work to helper agents.

---

## Compact Conversation

The **Compact Conversation** action still routes through the summarization machinery, but the modern flow has more moving parts than a simple “summarize and replace history.”

### What happens conceptually

1. A summarization prompt is rendered from the current conversation state
2. A summarization request is sent to the model
3. The summary is attached to a tool-call round / turn as metadata
4. Subsequent prompts include the summary instead of all prior raw history
5. Prompt-token details for the summarization request are also recomputed

### Important current additions

The current summarization flow also supports:

- **PreCompact hooks** before summarization
- **Transcript-backed recovery**, where the session transcript can be flushed to disk before compaction
- A post-compaction hint telling the model it can use `read_file` on the transcript when exact historical details are needed
- A **cache-friendly summarization prompt** path to improve cache reuse
- **Gemini-specific orphaned-tool-call cleanup** so the summarization request remains valid for stricter function-call models

### Why this matters

Compaction is no longer just a lossy “history summary” feature. It is closer to:

> summarize aggressively, but preserve an exact transcript escape hatch for later retrieval.

That is a strong pattern to reuse in a custom extension.

---

## How VS Code Renders the Popup

VS Code owns the widget rendering. The extension only provides data.

Conceptually:

- `promptTokens` → used token count in the header
- `maxInputTokens` → model denominator shown in the header
- `promptTokenDetails` → grouped category rows
- `outputBuffer` → output reservation information for the widget

VS Code decides how to group and display the rows and when to show the compact action.

---

# Part 2: Chat Debug Log

## Important Update

The older explanation of the debug log described a collector/service/ring-buffer pipeline centered on request logging, trajectory logging, and a dedicated event service.

That is no longer the best description of the current architecture.

### Current architecture direction

The debug log is now **OTel-first**:

- spans are collected from the OpenTelemetry-oriented instrumentation layer
- those spans are converted into VS Code chat debug events
- export/import support is built around OTLP-style serialized data

So this section should describe the modern model, and the older event-collector model should be treated as historical context only.

---

## Current High-Level Architecture

```text
┌────────────────────────────────────────────────────────────┐
│              OTel / span-producing instrumentation         │
│  - agent spans                                             │
│  - model-turn spans                                         │
│  - tool-call spans                                          │
│  - subagent spans                                           │
│  - hook spans                                               │
│  - span events such as user_message                         │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│           OTelChatDebugLogProviderContribution             │
│  - stores completed spans                                  │
│  - buckets spans by chat session                           │
│  - streams events to an active debug view                  │
│  - resolves detail content on expand                       │
│  - supports export/import                                  │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                       VS Code Debug UI                     │
│  - requests initial events                                 │
│  - receives streamed events                                │
│  - asks for resolved content on expansion                  │
│  - supports export/import flows                            │
└────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Role |
|---|---|
| `src/extension/trajectory/vscode-node/otelChatDebugLogProvider.ts` | Main provider implementation |
| `src/extension/trajectory/vscode-node/otelSpanToChatDebugEvent.ts` | Maps spans to VS Code debug event types |
| `src/extension/trajectory/vscode-node/otlpFormatConversion.ts` | Export/import conversion to OTLP-like JSON |

---

## Current Proposed API Shape

The modern debug provider uses the proposed chat debug API and can provide:

- initial debug log events
- live-streamed events
- event resolution on expand
- export of debug sessions
- import of previously exported debug sessions

That means the current model is richer than a simple “provide events + resolve event” interface.

---

## Current Event Sources

The provider primarily works from completed spans and span events.

Examples of things represented in spans:

- model turns
- tool executions
- subagent invocations
- hook executions
- user message events
- agent response events

The provider converts those spans into VS Code-level debug objects.

---

## Current Event Types Exposed to VS Code

The current mapping supports rich event types such as:

- `ChatDebugToolCallEvent`
- `ChatDebugModelTurnEvent`
- `ChatDebugSubagentInvocationEvent`
- `ChatDebugUserMessageEvent`
- `ChatDebugAgentResponseEvent`
- `ChatDebugGenericEvent`

There is also explicit support for hook-related detail content in the current stack.

---

## What a Model-Turn Event Can Carry Now

Current model-turn debug content is richer than a simple request/response record.

It can include:

- model name
- status
- duration
- time to first token
- input tokens
- output tokens
- cached tokens
- total tokens
- max input tokens
- max output tokens
- request name
- structured sections for system/input/output content

This is useful because it turns the debug log into a practical diagnostics surface rather than just a chronological trace.

---

## Hook Events

The current debug mapping also includes hook execution visibility.

That means hook work can show up in the debug panel as first-class events rather than being buried only in generic logs. This is important if your extension uses policy hooks, preflight hooks, or stop hooks.

---

## User and Agent Messages

User messages and agent responses are extracted from span content and span events.

### User messages

User messages can be streamed early from span events such as `user_message`, which allows the panel to show activity before the entire parent span completes.

### Agent responses

Agent responses are extracted from completed chat spans and can expose structured sections such as:

- response text
- reasoning
- tool calls
- other output sections

---

## Session Attribution

The provider groups spans by chat session ID so the debug view can open a single session and stream only the events that belong to that session.

This is important because a global debug stream would otherwise mix unrelated chat sessions together.

---

## Storage Model

The current provider keeps spans in memory, indexes them by session, and evicts/compacts when limits are exceeded.

The important design takeaway is not the exact container type but the strategy:

- keep enough span history for active debugging
- index by session for fast retrieval
- compact/evict under memory pressure
- preserve export/import paths for offline analysis

---

## Export / Import

The modern debug stack supports export and import of chat debug logs.

The conversion layer wraps span data into an OTLP-like JSON structure and can later parse it back.

That means the debug system now supports a workflow like this:

1. capture live debug data
2. export it to a portable format
3. import it later for replay / inspection

This is a strong capability to emulate in a custom extension if you care about reproducible troubleshooting.

---

## What the Extension Controls vs What VS Code Controls

| Responsibility | Owner |
|---|---|
| Create spans and span events | Extension |
| Convert spans to debug events | Extension |
| Group by session | Extension |
| Stream live events | Extension |
| Resolve detailed content on expand | Extension |
| Export/import serialized session data | Extension |
| Render the debug UI | VS Code |
| Decide how expanded content is displayed | VS Code |

---

# Practical Takeaways for a Custom VS Code Extension

If you want to build a custom extension that borrows the strongest parts of this design, the most useful patterns are these:

## 1. Report usage with a stable schema

Use the same conceptual split:

- `promptTokens`
- `completionTokens`
- `outputBuffer`
- `promptTokenDetails`

Keep prompt composition separate from reserved output.

## 2. Isolate parent and child agent usage

If your extension has helper agents or subagents, do not blindly roll their usage into the parent context widget.

## 3. Use summaries plus transcript fallback

When compacting conversation history:

- summarize aggressively
- keep a real transcript
- tell the model how to retrieve exact details later

## 4. Instrument first, debug second

Use spans or a span-like internal model as the source of truth, then project that into a debug UI.

This is better than inventing a debug-only event model that cannot be reused.

## 5. Expose rich model-turn metrics

Include metrics like:

- time to first token
- cached tokens
- max prompt / output limits
- request name
- structured input/output sections

## 6. Make export/import a first-class feature

Treat debug logs as portable artifacts, not just ephemeral UI state.

## 7. Treat hooks as part of the control plane

If your extension uses lifecycle hooks, surface them in debug views as first-class events.

---

# Quick Reference

## Context Window Popup

| Goal | File |
|---|---|
| Change token categorization | `src/platform/tokenizer/node/promptTokenDetails.ts` |
| Change what gets reported to VS Code | `src/extension/intents/node/toolCallingLoop.ts` |
| Change model max token limits | `src/extension/conversation/vscode-node/languageModelAccess.ts` |
| Change summarization / compaction behavior | `src/extension/prompts/node/agent/summarizedConversationHistory.tsx` |

## Chat Debug Log

| Goal | File |
|---|---|
| Change debug provider behavior | `src/extension/trajectory/vscode-node/otelChatDebugLogProvider.ts` |
| Change span → debug event mapping | `src/extension/trajectory/vscode-node/otelSpanToChatDebugEvent.ts` |
| Change export/import format | `src/extension/trajectory/vscode-node/otlpFormatConversion.ts` |

---

# Bottom Line

The key updates from the earlier draft are:

1. `promptTokenDetails` no longer models reserved output as its own row
2. reserved output is reported separately as `outputBuffer`
3. compaction now includes transcript-aware recovery and more sophisticated summarization behavior
4. the debug-log architecture is now best understood as **OTel-first**, with export/import support and richer event content

For extension authors, the most reusable ideas are:

- separate prompt composition from reserved output
- isolate subagent accounting
- compact with transcript fallback
- build debugging on top of spans/telemetry, not an ad hoc log format
- support portable debug artifacts

