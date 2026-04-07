"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode5 = __toESM(require("vscode"));

// src/sessionWatcher.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var SYSTEM_OVERHEAD_TOKENS = 46e3;
function getContextWindowSize(model) {
  if (!model) {
    return 2e5;
  }
  const m = model.toLowerCase();
  if (m.includes("claude")) {
    return 2e5;
  }
  if (m.startsWith("gpt-4.1")) {
    return 1e6;
  }
  if (m.startsWith("gpt-5")) {
    return 2e5;
  }
  if (m.startsWith("gpt-4")) {
    return 128e3;
  }
  if (m.includes("o1") || m.includes("o3")) {
    return 2e5;
  }
  return 2e5;
}
function parseSimpleYaml(text) {
  const result = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) {
      result[key] = value;
    }
  }
  return result;
}
function normalizePath(p) {
  let normalized = path.resolve(p);
  if (process.platform === "win32") {
    normalized = normalized.toLowerCase();
  }
  if (normalized.endsWith(path.sep)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function fileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
var SessionWatcher = class extends vscode.Disposable {
  _onDidChange = new vscode.EventEmitter();
  onDidChange = this._onDidChange.event;
  _sessionDir;
  _cache = /* @__PURE__ */ new Map();
  _sessions = [];
  _pollTimer;
  _watchers = [];
  _disposed = false;
  constructor() {
    super(() => this._dispose());
    this._sessionDir = path.join(os.homedir(), ".copilot", "session-state");
  }
  start(pollIntervalMs = 1e4) {
    this._scan();
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(this._sessionDir),
      "**/*"
    );
    const watcher2 = vscode.workspace.createFileSystemWatcher(pattern);
    watcher2.onDidChange(() => this._scan());
    watcher2.onDidCreate(() => this._scan());
    watcher2.onDidDelete(() => this._scan());
    this._watchers.push(watcher2);
    this._pollTimer = setInterval(() => this._scan(), pollIntervalMs);
  }
  getWorkspaceSessions() {
    return this._sessions;
  }
  getPeakCliPercent() {
    if (this._sessions.length === 0) {
      return 0;
    }
    return Math.max(...this._sessions.map((s) => s.contextPercent));
  }
  _scan() {
    if (this._disposed) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      if (this._sessions.length > 0) {
        this._sessions = [];
        this._onDidChange.fire();
      }
      return;
    }
    const normalizedFolders = folders.map((f) => normalizePath(f.uri.fsPath));
    let sessionDirs;
    try {
      sessionDirs = fs.readdirSync(this._sessionDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      if (this._sessions.length > 0) {
        this._sessions = [];
        this._onDidChange.fire();
      }
      return;
    }
    const newSessions = [];
    const activeCacheKeys = /* @__PURE__ */ new Set();
    for (const dirName of sessionDirs) {
      const dirPath = path.join(this._sessionDir, dirName);
      const info = this._parseSession(dirName, dirPath);
      if (!info) {
        continue;
      }
      const normalizedCwd = normalizePath(info.cwd);
      const matches = normalizedFolders.some(
        (folder) => normalizedCwd === folder || normalizedCwd.startsWith(folder + path.sep)
      );
      if (matches) {
        newSessions.push(info);
        activeCacheKeys.add(dirName);
      }
    }
    for (const key of this._cache.keys()) {
      if (!activeCacheKeys.has(key)) {
        this._cache.delete(key);
      }
    }
    if (this._hasChanged(newSessions)) {
      this._sessions = newSessions;
      this._onDidChange.fire();
    }
  }
  _parseSession(id, dirPath) {
    const workspacePath = path.join(dirPath, "workspace.yaml");
    const eventsPath = path.join(dirPath, "events.jsonl");
    const wsMtime = fileMtime(workspacePath);
    if (wsMtime === 0) {
      return void 0;
    }
    const evMtime = fileMtime(eventsPath);
    const cached = this._cache.get(id);
    if (cached && cached.workspaceMtime === wsMtime && cached.eventsMtime === evMtime) {
      cached.info.isActive = this._isActive(dirPath);
      return cached.info;
    }
    let wsText;
    try {
      wsText = fs.readFileSync(workspacePath, "utf-8");
    } catch {
      return void 0;
    }
    const yaml = parseSimpleYaml(wsText);
    const cwd = yaml["cwd"] || "";
    if (!cwd) {
      return void 0;
    }
    let model = "";
    let branch = "";
    let outputTokens = 0;
    let conversationInputEstimate = 0;
    let toolResultTokensEstimate = 0;
    let turnCount = 0;
    let currentTokens = 0;
    let systemTokens = 0;
    let conversationTokens = 0;
    let toolDefinitionsTokens = 0;
    let isEstimated = true;
    try {
      const evText = fs.readFileSync(eventsPath, "utf-8");
      const lines = evText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const type = event.type || "";
        const data = event.data;
        if (!data) {
          continue;
        }
        switch (type) {
          case "session.start":
            if (data.context?.branch) {
              branch = data.context.branch;
            }
            break;
          case "assistant.message":
            if (typeof data.outputTokens === "number") {
              outputTokens += data.outputTokens;
            }
            break;
          case "assistant.turn_end":
            turnCount++;
            break;
          case "user.message":
            if (typeof data.content === "string") {
              conversationInputEstimate += Math.ceil(data.content.length / 4);
            }
            break;
          case "tool.execution_complete":
            if (data.model && typeof data.model === "string" && !model) {
              model = data.model;
            }
            if (data.result != null) {
              const text = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
              toolResultTokensEstimate += Math.ceil(text.length / 4);
            }
            break;
          case "session.shutdown":
            if (typeof data.currentModel === "string") {
              model = data.currentModel;
            }
            if (typeof data.currentTokens === "number") {
              currentTokens = data.currentTokens;
            }
            if (typeof data.systemTokens === "number") {
              systemTokens = data.systemTokens;
            }
            if (typeof data.conversationTokens === "number") {
              conversationTokens = data.conversationTokens;
            }
            if (typeof data.toolDefinitionsTokens === "number") {
              toolDefinitionsTokens = data.toolDefinitionsTokens;
            }
            break;
        }
      }
    } catch {
    }
    const inputTokensEstimate = conversationInputEstimate + toolResultTokensEstimate;
    let contextPercent;
    if (currentTokens > 0) {
      contextPercent = Math.min(100, Math.round(
        currentTokens / getContextWindowSize(model) * 100
      ));
      isEstimated = false;
    } else {
      const estimatedPromptTokens = SYSTEM_OVERHEAD_TOKENS + inputTokensEstimate;
      contextPercent = Math.min(100, Math.round(
        estimatedPromptTokens / getContextWindowSize(model) * 100
      ));
      isEstimated = true;
    }
    const info = {
      id: yaml["id"] || id,
      summary: yaml["summary"] || "",
      model,
      contextPercent,
      isEstimated,
      outputTokens,
      currentTokens,
      systemTokens,
      conversationTokens,
      toolDefinitionsTokens,
      inputTokensEstimate,
      turnCount,
      isActive: this._isActive(dirPath),
      startTime: yaml["created_at"] || "",
      cwd,
      branch
    };
    this._cache.set(id, { workspaceMtime: wsMtime, eventsMtime: evMtime, info });
    return info;
  }
  _isActive(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath);
      return entries.some((e) => e.startsWith("inuse.") && e.endsWith(".lock"));
    } catch {
      return false;
    }
  }
  _hasChanged(newSessions) {
    if (newSessions.length !== this._sessions.length) {
      return true;
    }
    for (let i = 0; i < newSessions.length; i++) {
      const a = newSessions[i];
      const b = this._sessions[i];
      if (a.id !== b.id || a.contextPercent !== b.contextPercent || a.outputTokens !== b.outputTokens || a.inputTokensEstimate !== b.inputTokensEstimate || a.turnCount !== b.turnCount || a.isActive !== b.isActive || a.summary !== b.summary || a.model !== b.model || a.isEstimated !== b.isEstimated || a.currentTokens !== b.currentTokens) {
        return true;
      }
    }
    return false;
  }
  _dispose() {
    this._disposed = true;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = void 0;
    }
    for (const w of this._watchers) {
      w.dispose();
    }
    this._watchers = [];
    this._onDidChange.dispose();
    this._cache.clear();
  }
};

// src/contextGauge.ts
var vscode2 = __toESM(require("vscode"));

// src/chatLogReader.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var ChatLogReader = class {
  _debugLogsDir;
  /**
   * Call once after activation with the extension context so we can
   * derive the sibling Copilot Chat storage path.
   */
  configure(context) {
    const storageUri = context.storageUri;
    if (!storageUri) {
      return;
    }
    const wsIdDir = path2.dirname(storageUri.fsPath);
    this._debugLogsDir = path2.join(wsIdDir, "GitHub.copilot-chat", "debug-logs");
  }
  /**
   * Returns usage data for the most-recently-modified chat session,
   * or undefined if no debug logs are available.
   */
  read() {
    if (!this._debugLogsDir || !fs2.existsSync(this._debugLogsDir)) {
      return void 0;
    }
    let sessionDirs;
    try {
      sessionDirs = fs2.readdirSync(this._debugLogsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      return void 0;
    }
    if (sessionDirs.length === 0) {
      return void 0;
    }
    let newest;
    for (const d of sessionDirs) {
      const mainJsonl = path2.join(this._debugLogsDir, d.name, "main.jsonl");
      try {
        const mt = fs2.statSync(mainJsonl).mtimeMs;
        if (!newest || mt > newest.mtime) {
          newest = { name: d.name, mtime: mt };
        }
      } catch {
      }
    }
    if (!newest) {
      return void 0;
    }
    const sessionDir = path2.join(this._debugLogsDir, newest.name);
    return this._parseSession(sessionDir);
  }
  _parseSession(sessionDir) {
    const mainPath = path2.join(sessionDir, "main.jsonl");
    const modelsPath = path2.join(sessionDir, "models.json");
    let lines;
    try {
      lines = fs2.readFileSync(mainPath, "utf-8").split("\n");
    } catch {
      return void 0;
    }
    let peakInputTokens = 0;
    let peakOutputTokens = 0;
    let latestModel = "";
    let llmTurns = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (event.type !== "llm_request") {
        continue;
      }
      const attrs = event.attrs;
      if (!attrs) {
        continue;
      }
      llmTurns++;
      const inputTokens = typeof attrs.inputTokens === "number" ? attrs.inputTokens : 0;
      const outputTokens = typeof attrs.outputTokens === "number" ? attrs.outputTokens : 0;
      if (typeof attrs.model === "string") {
        latestModel = attrs.model;
      }
      if (inputTokens > peakInputTokens) {
        peakInputTokens = inputTokens;
        peakOutputTokens = outputTokens;
      }
    }
    if (llmTurns === 0) {
      return void 0;
    }
    let maxPromptTokens = 0;
    try {
      const modelsText = fs2.readFileSync(modelsPath, "utf-8");
      const models = JSON.parse(modelsText);
      for (const m of models) {
        const family = m.capabilities?.family || m.id || "";
        if (latestModel.startsWith(family) || family.startsWith(latestModel) || latestModel === m.id) {
          maxPromptTokens = m.capabilities?.limits?.max_prompt_tokens ?? 0;
          break;
        }
      }
      if (maxPromptTokens === 0) {
        for (const m of models) {
          const mpt = m.capabilities?.limits?.max_prompt_tokens;
          if (typeof mpt === "number" && mpt > 0) {
            maxPromptTokens = mpt;
            break;
          }
        }
      }
    } catch {
    }
    if (maxPromptTokens === 0) {
      maxPromptTokens = this._guessContextWindow(latestModel);
    }
    const contextPercent = maxPromptTokens > 0 ? Math.min(100, Math.round(peakInputTokens / maxPromptTokens * 100)) : 0;
    return {
      inputTokens: peakInputTokens,
      outputTokens: peakOutputTokens,
      model: latestModel,
      maxPromptTokens,
      contextPercent,
      turnCount: llmTurns
    };
  }
  _guessContextWindow(model) {
    if (!model) {
      return 2e5;
    }
    const m = model.toLowerCase();
    if (m.includes("1m")) {
      return 935997;
    }
    if (m.includes("claude")) {
      return 2e5;
    }
    if (m.startsWith("gpt-4.1")) {
      return 1e6;
    }
    if (m.startsWith("gpt-4")) {
      return 128e3;
    }
    if (m.includes("o1") || m.includes("o3")) {
      return 2e5;
    }
    return 2e5;
  }
};

// src/contextGauge.ts
function formatDuration(isoStart) {
  const ms = Date.now() - new Date(isoStart).getTime();
  const minutes = Math.floor(ms / 6e4);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function getSeverity(percent) {
  if (percent >= 75) {
    return "critical";
  }
  if (percent >= 50) {
    return "warning";
  }
  return "healthy";
}
function trendArrow(prev, curr) {
  const delta = curr - prev;
  if (delta > 3) {
    return " \u2191";
  }
  if (delta < -3) {
    return " \u2193";
  }
  return " \u2192";
}
var ContextGauge = class {
  watcher;
  chatReader = new ChatLogReader();
  statusBar;
  previousCliPercent = 0;
  chatPercent;
  disposables = [];
  constructor(sessionWatcher) {
    this.watcher = sessionWatcher;
  }
  start(context) {
    this.chatReader.configure(context);
    this.statusBar = vscode2.window.createStatusBarItem(
      vscode2.StatusBarAlignment.Right,
      200
    );
    this.statusBar.command = "greatWhite.openContextDetails";
    this.disposables.push(this.statusBar);
    const sub = this.watcher.onDidChange(() => this.refresh());
    this.disposables.push(sub);
    this.refresh();
    this.statusBar.show();
  }
  refresh() {
    const sessions = this.watcher.getWorkspaceSessions();
    const reliable = sessions.filter((s) => s.isActive || !s.isEstimated);
    const peakSession = reliable.length > 0 ? reliable.reduce((a, b) => a.contextPercent >= b.contextPercent ? a : b) : null;
    const cliPercent = peakSession?.contextPercent ?? 0;
    const cliEstimated = peakSession?.isEstimated ?? true;
    const trend = trendArrow(this.previousCliPercent, cliPercent);
    this.previousCliPercent = cliPercent;
    this.pollChat();
    const peak = Math.max(cliPercent, this.chatPercent ?? 0);
    const severity = getSeverity(peak);
    const icon = severity === "critical" ? "\u{1FA78}" : "\u{1F988}";
    const cliLabel = peakSession ? `${cliEstimated ? "~" : ""}${cliPercent}%${trend}` : "\u2014";
    const chatLabel = this.chatPercent !== void 0 ? `${this.chatPercent}%` : "\u2014";
    this.statusBar.text = `${icon} CLI ${cliLabel} \u2502 \u{1F4AC} Chat ${chatLabel}`;
    switch (severity) {
      case "warning":
        this.statusBar.backgroundColor = new vscode2.ThemeColor(
          "statusBarItem.warningBackground"
        );
        break;
      case "critical":
        this.statusBar.backgroundColor = new vscode2.ThemeColor(
          "statusBarItem.errorBackground"
        );
        break;
      default:
        this.statusBar.backgroundColor = void 0;
        break;
    }
    this.statusBar.tooltip = this.buildTooltip(sessions);
  }
  getSessions() {
    return this.watcher.getWorkspaceSessions();
  }
  getChatPercent() {
    return this.chatPercent;
  }
  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
  buildTooltip(sessions) {
    const md = new vscode2.MarkdownString();
    md.supportThemeIcons = true;
    const lines = ["**Copilot Context Usage**", ""];
    if (sessions.length > 0) {
      lines.push("CLI Sessions (this workspace):");
      for (const s of sessions) {
        const dur = formatDuration(s.startTime);
        const pct = `${s.isEstimated ? "~" : ""}${s.contextPercent}%`;
        let bulletLine = `\u2022 ${s.summary} \u2014 ${s.model} \xB7 ${pct} \xB7 ${s.turnCount} turns \xB7 ${dur}`;
        if (!s.isEstimated && (s.systemTokens > 0 || s.conversationTokens > 0)) {
          const fmt = (n) => n < 1e3 ? `${n}` : `${Math.round(n / 1e3)}K`;
          bulletLine += `  
  \u21B3 system ${fmt(s.systemTokens)} \xB7 conversation ${fmt(s.conversationTokens)} \xB7 tools ${fmt(s.toolDefinitionsTokens)} \xB7 output ${fmt(s.outputTokens)}`;
        }
        lines.push(bulletLine);
      }
    } else {
      lines.push("CLI Sessions: none");
    }
    lines.push("");
    if (this.chatPercent !== void 0) {
      lines.push(`Chat: ~${this.chatPercent}% estimated`);
    } else {
      lines.push("Chat: \u2014");
    }
    lines.push("", "Click for details");
    md.appendMarkdown(lines.join("\n\n"));
    return md;
  }
  pollChat() {
    try {
      const usage = this.chatReader.read();
      this.chatPercent = usage?.contextPercent;
    } catch {
      this.chatPercent = void 0;
    }
  }
};
async function showContextDetails(sessions, chatPercent) {
  const folderName = vscode2.workspace.workspaceFolders?.[0]?.name ?? "Workspace";
  const items = [];
  items.push({
    label: `CLI Sessions \u2014 ${folderName}`,
    kind: vscode2.QuickPickItemKind.Separator
  });
  for (const s of sessions) {
    const marker = s.isActive ? "\u25CF" : "\u25CB";
    const dur = formatDuration(s.startTime);
    const pct = `${s.isEstimated ? "~" : ""}${s.contextPercent}%`;
    items.push({
      label: `${marker} ${s.summary}  \u2014  ${s.model} \xB7 ${pct} \xB7 ${s.turnCount} turns \xB7 ${dur}`,
      detail: `${s.outputTokens} output tokens \xB7 branch: ${s.branch}${s.isEstimated ? " \xB7 estimated" : " \xB7 actual"}`
    });
  }
  if (sessions.length === 0) {
    items.push({ label: "\u25CB No CLI sessions" });
  }
  items.push({
    label: "Copilot Chat",
    kind: vscode2.QuickPickItemKind.Separator
  });
  if (chatPercent !== void 0) {
    items.push({ label: `\u25CF Active Chat Session  \u2014  ~${chatPercent}%` });
  } else {
    items.push({ label: "\u25CB No chat data" });
  }
  items.push({
    label: "",
    kind: vscode2.QuickPickItemKind.Separator
  });
  items.push({
    label: "$(refresh) Refresh",
    _action: "refresh"
  });
  items.push({
    label: "$(gear) Context Gauge Settings",
    _action: "settings"
  });
  const picked = await vscode2.window.showQuickPick(items, {
    title: "Copilot Context Gauge",
    placeHolder: "Select an action"
  });
  if (!picked) {
    return;
  }
  if (picked._action === "refresh") {
    await vscode2.commands.executeCommand("greatWhite.openContextDetails");
  } else if (picked._action === "settings") {
    await vscode2.commands.executeCommand(
      "workbench.action.openSettings",
      "greatWhite.contextGauge"
    );
  }
}

// src/decorationProvider.ts
var vscode3 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));
var ENTRY_FILENAMES = /* @__PURE__ */ new Set([
  // JavaScript / TypeScript
  "index.ts",
  "index.js",
  "main.ts",
  "app.ts",
  "server.ts",
  "cli.ts",
  // C / C++
  "main.c",
  "main.cc",
  "main.cpp",
  // PowerShell
  "setup.ps1",
  "activate.ps1",
  "install.ps1",
  "main.ps1",
  // Shell
  "install.sh",
  "setup.sh",
  "bootstrap.sh",
  "entrypoint.sh",
  "run.sh",
  "start.sh",
  "main.sh",
  // Python
  "main.py",
  "__main__.py"
]);
var CONFIG_PATTERN = /^(.*\.config\.(ts|js|mjs)|.*\.rc\.js|\.eslintrc.*|jest\.config.*|vitest\.config.*|next\.config.*|vite\.config.*|CMakeLists\.txt|vcpkg\.json|Makefile|GNUmakefile|requirements\.txt|.*\.props|.*\.cmake|Directory\..+\.props|.*\.spec|.*\.ini|.*\.conf|.*\.service|.*\.timer|.*\.logrotate|.*\.init|.*\.default)$/i;
var EntryPointDecorationProvider = class {
  _onDidChangeFileDecorations = new vscode3.EventEmitter();
  onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  /** Keyed by workspace folder URI string → resolved absolute entry-point paths */
  _entryPointCache = /* @__PURE__ */ new Map();
  async provideFileDecoration(uri, _token) {
    const config = vscode3.workspace.getConfiguration("greatWhite");
    if (!config.get("showEntryPointDecorations", true)) {
      return void 0;
    }
    const showEntryBadges = config.get("showEntryPointBadges", true);
    const showConfigBadges = config.get("showConfigFileBadges", true);
    if (!showEntryBadges && !showConfigBadges) {
      return void 0;
    }
    const folder = vscode3.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return void 0;
    }
    const entryPoints = await this._getEntryPoints(folder);
    const basename2 = path3.basename(uri.fsPath);
    if (showEntryBadges && entryPoints.has(uri.fsPath)) {
      return {
        badge: "E",
        tooltip: "Entry Point",
        color: new vscode3.ThemeColor("greatWhite.entryPointForeground"),
        propagate: true
      };
    }
    if (showEntryBadges && ENTRY_FILENAMES.has(basename2)) {
      const relative2 = path3.relative(folder.uri.fsPath, uri.fsPath);
      const depth = relative2.split(path3.sep).length - 1;
      if (depth <= 2) {
        return {
          badge: "E",
          tooltip: "Entry Point",
          color: new vscode3.ThemeColor("greatWhite.entryPointForeground"),
          propagate: true
        };
      }
    }
    if (showConfigBadges && CONFIG_PATTERN.test(basename2)) {
      return {
        badge: "C",
        tooltip: "Config / Build File",
        color: new vscode3.ThemeColor("greatWhite.configFileForeground"),
        propagate: false
      };
    }
    return void 0;
  }
  async _getEntryPoints(folder) {
    const key = folder.uri.toString();
    const cached = this._entryPointCache.get(key);
    if (cached) {
      return cached;
    }
    const set = /* @__PURE__ */ new Set();
    const found = await vscode3.workspace.findFiles(
      new vscode3.RelativePattern(folder, "package.json"),
      "**/node_modules/**",
      1
    );
    if (found.length > 0) {
      try {
        const raw = await vscode3.workspace.fs.readFile(found[0]);
        const pkg = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const root = folder.uri.fsPath;
        if (pkg.main) {
          this._extractPath(pkg.main, root, set);
        }
        if (pkg.module) {
          this._extractPath(pkg.module, root, set);
        }
        if (pkg.exports) {
          this._extractAllValues(pkg.exports, root, set);
        }
        if (pkg.bin) {
          this._extractAllValues(pkg.bin, root, set);
        }
      } catch {
      }
    }
    this._entryPointCache.set(key, set);
    return set;
  }
  _extractPath(value, root, out) {
    if (typeof value === "string") {
      out.add(path3.resolve(root, value));
    }
  }
  _extractAllValues(obj, root, out) {
    if (typeof obj === "string") {
      this._extractPath(obj, root, out);
    } else if (obj !== null && typeof obj === "object") {
      for (const v of Object.values(obj)) {
        this._extractAllValues(v, root, out);
      }
    }
  }
  /** Invalidate cache for one folder (by its URI string) or all if omitted */
  invalidateCache(folderUri) {
    if (folderUri) {
      this._entryPointCache.delete(folderUri);
    } else {
      this._entryPointCache.clear();
    }
  }
  /** Fire a broad refresh so VS Code re-queries all visible file decorations */
  fireAll() {
    this._onDidChangeFileDecorations.fire(void 0);
  }
  dispose() {
    this._onDidChangeFileDecorations.dispose();
  }
};

// src/themeSwitcher.ts
var vscode4 = __toESM(require("vscode"));
var GW_THEMES = [
  { label: "Great White (Dark)", themeId: "Great White (Dark)", shortName: "Dark", icon: "\u{1F988}", color: "#5d8fa8" },
  { label: "Great White (Light)", themeId: "Great White (Light)", shortName: "Light", icon: "\u{1F988}", color: "#3d667c" },
  { label: "Great White (Storm)", themeId: "Great White (Storm)", shortName: "Storm", icon: "\u{1F988}", color: "#4f7ea8" },
  { label: "Great White (Frost)", themeId: "Great White (Frost)", shortName: "Frost", icon: "\u{1F988}", color: "#2f5f84" },
  { label: "Great White (High Contrast Dark)", themeId: "Great White (High Contrast Dark)", shortName: "HC Dark", icon: "\u{1F988}", color: "#6eb8ff" },
  { label: "Great White (High Contrast Light)", themeId: "Great White (High Contrast Light)", shortName: "HC Light", icon: "\u{1F988}", color: "#0f5f93" },
  { label: "Great White (Bloodloss)", themeId: "Great White (Bloodloss)", shortName: "Bloodloss", icon: "\u{1F988}", color: "#c44f5f", detail: "Overflow / context-alarm theme \u2014 manual selection only" }
];
function getActiveThemeId() {
  return vscode4.workspace.getConfiguration().get("workbench.colorTheme", "");
}
function findEntry(themeId) {
  return GW_THEMES.find((t) => t.themeId === themeId);
}
var ThemeSwitcher = class {
  disposables = [];
  statusBar;
  start() {
    this.statusBar = vscode4.window.createStatusBarItem(
      vscode4.StatusBarAlignment.Right,
      200
    );
    this.statusBar.command = "greatWhite.switchTheme";
    this.statusBar.tooltip = "Great White: Switch Theme";
    this.disposables.push(this.statusBar);
    const configSub = vscode4.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.colorTheme") || e.affectsConfiguration("greatWhite.themeSwitcher.scope")) {
        this.refresh();
      }
    });
    this.disposables.push(configSub);
    const switchCmd = vscode4.commands.registerCommand("greatWhite.switchTheme", () => {
      this.showPicker();
    });
    this.disposables.push(switchCmd);
    this.refresh();
  }
  refresh() {
    const entry = findEntry(getActiveThemeId());
    if (entry) {
      this.statusBar.text = `${entry.icon} ${entry.shortName}`;
      this.statusBar.color = entry.color;
      this.statusBar.show();
    } else {
      this.statusBar.color = void 0;
      this.statusBar.hide();
    }
  }
  resolveConfigTarget() {
    const scope = vscode4.workspace.getConfiguration("greatWhite.themeSwitcher").get("scope", "auto");
    if (scope === "global") {
      return vscode4.ConfigurationTarget.Global;
    }
    if (scope === "workspace" || scope === "auto") {
      if (vscode4.workspace.workspaceFolders && vscode4.workspace.workspaceFolders.length > 0) {
        return vscode4.ConfigurationTarget.Workspace;
      }
      if (scope === "workspace") {
        vscode4.window.showWarningMessage(
          "Great White: No workspace folder is open \u2014 theme saved to global user settings."
        );
      }
      return vscode4.ConfigurationTarget.Global;
    }
    return vscode4.ConfigurationTarget.Global;
  }
  async showPicker() {
    const currentThemeId = getActiveThemeId();
    const currentEntry = findEntry(currentThemeId);
    const target = this.resolveConfigTarget();
    const scopeLabel = target === vscode4.ConfigurationTarget.Workspace ? "workspace (.vscode/settings.json)" : "global user settings";
    const items = [
      { label: "Great White Variants", kind: vscode4.QuickPickItemKind.Separator }
    ];
    for (const t of GW_THEMES) {
      items.push({
        label: `${t.icon}  ${t.label}`,
        description: t.themeId === currentThemeId ? "$(check) active" : void 0,
        detail: t.detail,
        themeId: t.themeId
      });
    }
    items.push(
      { label: "", kind: vscode4.QuickPickItemKind.Separator },
      {
        label: "$(color-mode)  Browse all VS Code themes\u2026",
        isBrowse: true
      },
      { label: "", kind: vscode4.QuickPickItemKind.Separator },
      {
        label: `$(info)  Applying to: ${scopeLabel}`,
        detail: "Change via setting: greatWhite.themeSwitcher.scope"
      }
    );
    const activeItem = currentEntry ? items.find((i) => i.themeId === currentEntry.themeId) : void 0;
    const picked = await vscode4.window.showQuickPick(items, {
      title: "Great White: Switch Theme",
      placeHolder: "Select a variant to apply instantly",
      matchOnDescription: true,
      activeItems: activeItem ? [activeItem] : []
    });
    if (!picked) {
      return;
    }
    if (picked.isBrowse) {
      await vscode4.commands.executeCommand("workbench.action.selectTheme");
      return;
    }
    const themeId = picked.themeId;
    if (themeId) {
      await vscode4.workspace.getConfiguration().update("workbench.colorTheme", themeId, target);
    }
  }
  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
};

// src/extension.ts
var watcher;
var gauge;
var switcher;
function activate(context) {
  const cfg = vscode5.workspace.getConfiguration("greatWhite");
  switcher = new ThemeSwitcher();
  switcher.start();
  watcher = new SessionWatcher();
  gauge = new ContextGauge(watcher);
  if (cfg.get("contextGauge.enabled", true)) {
    const pollMs = cfg.get("contextGauge.pollInterval", 10) * 1e3;
    watcher.start(pollMs);
    gauge.start(context);
  }
  const openDetailsCmd = vscode5.commands.registerCommand("greatWhite.openContextDetails", async () => {
    gauge.refresh();
    await showContextDetails(gauge.getSessions(), gauge.getChatPercent());
  });
  const decorationProvider = new EntryPointDecorationProvider();
  const decorationRegistration = vscode5.window.registerFileDecorationProvider(decorationProvider);
  const pkgWatcher = vscode5.workspace.createFileSystemWatcher("**/package.json");
  const invalidateAndRefresh = (uri) => {
    const folder = vscode5.workspace.getWorkspaceFolder(uri);
    decorationProvider.invalidateCache(folder?.uri.toString());
    decorationProvider.fireAll();
  };
  pkgWatcher.onDidChange(invalidateAndRefresh);
  pkgWatcher.onDidCreate(invalidateAndRefresh);
  pkgWatcher.onDidDelete(invalidateAndRefresh);
  const configChangeDisposable = vscode5.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("greatWhite.showEntryPointDecorations") || e.affectsConfiguration("greatWhite.showEntryPointBadges") || e.affectsConfiguration("greatWhite.showConfigFileBadges")) {
      decorationProvider.fireAll();
    }
  });
  const resetDecorationsCmd = vscode5.commands.registerCommand("greatWhite.resetDecorations", async () => {
    const config = vscode5.workspace.getConfiguration("greatWhite");
    await config.update("showEntryPointDecorations", void 0, vscode5.ConfigurationTarget.Global);
    await config.update("showEntryPointBadges", void 0, vscode5.ConfigurationTarget.Global);
    await config.update("showConfigFileBadges", void 0, vscode5.ConfigurationTarget.Global);
    decorationProvider.fireAll();
    vscode5.window.showInformationMessage("Great White: Explorer decorations reset to defaults.");
  });
  const resetFileNestingCmd = vscode5.commands.registerCommand("greatWhite.resetFileNesting", async () => {
    const config = vscode5.workspace.getConfiguration();
    await config.update("explorer.fileNesting.enabled", void 0, vscode5.ConfigurationTarget.Workspace);
    await config.update("explorer.fileNesting.patterns", void 0, vscode5.ConfigurationTarget.Workspace);
    vscode5.window.showInformationMessage("Great White: File nesting patterns reset to defaults.");
  });
  context.subscriptions.push(
    switcher,
    watcher,
    gauge,
    openDetailsCmd,
    decorationRegistration,
    decorationProvider,
    pkgWatcher,
    configChangeDisposable,
    resetDecorationsCmd,
    resetFileNestingCmd
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
