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
function getContextWindowSize(model) {
  if (!model) {
    return 2e5;
  }
  const m = model.toLowerCase();
  if (m.includes("claude")) {
    return 2e5;
  }
  if (m.startsWith("gpt-5")) {
    return 2e5;
  }
  if (m.startsWith("gpt-4")) {
    return 128e3;
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
    let inputTokensEstimate = 0;
    let turnCount = 0;
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
            if (data.selectedModel) {
              model = data.selectedModel;
            }
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
              inputTokensEstimate += Math.ceil(data.content.length / 4);
            }
            break;
          case "tool.execution_complete":
            if (typeof data.content === "string") {
              inputTokensEstimate += Math.ceil(data.content.length / 4);
            }
            break;
        }
      }
    } catch {
    }
    const contextPercent = Math.min(100, Math.round(
      (outputTokens + inputTokensEstimate) / getContextWindowSize(model) * 100
    ));
    const info = {
      id: yaml["id"] || id,
      summary: yaml["summary"] || "",
      model,
      contextPercent,
      outputTokens,
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
      if (a.id !== b.id || a.contextPercent !== b.contextPercent || a.outputTokens !== b.outputTokens || a.inputTokensEstimate !== b.inputTokensEstimate || a.turnCount !== b.turnCount || a.isActive !== b.isActive || a.summary !== b.summary || a.model !== b.model) {
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
  statusBar;
  previousCliPercent = 0;
  chatPercent;
  disposables = [];
  constructor(sessionWatcher) {
    this.watcher = sessionWatcher;
  }
  start(context) {
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
    const cliPercent = sessions.length > 0 ? Math.max(...sessions.map((s) => s.contextPercent)) : 0;
    this.pollChat();
    const trend = trendArrow(this.previousCliPercent, cliPercent);
    this.previousCliPercent = cliPercent;
    const peak = Math.max(cliPercent, this.chatPercent ?? 0);
    const severity = getSeverity(peak);
    const icon = severity === "critical" ? "\u{1FA78}" : "\u{1F988}";
    const cliLabel = sessions.length > 0 ? `${cliPercent}%${trend}` : "\u2014";
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
        lines.push(
          `\u2022 ${s.summary} \u2014 ${s.model} \xB7 ${s.contextPercent}% \xB7 ${s.turnCount} turns \xB7 ${dur}`
        );
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
      const lm2 = vscode2.lm;
      if (!lm2?.selectChatModels) {
        this.chatPercent = void 0;
        return;
      }
      Promise.resolve(lm2.selectChatModels({ family: "gpt-4o" })).then(() => {
        this.chatPercent = void 0;
      }).catch(() => {
        this.chatPercent = void 0;
      });
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
    items.push({
      label: `${marker} ${s.summary}  \u2014  ${s.model} \xB7 ${s.contextPercent}% \xB7 ${s.turnCount} turns \xB7 ${dur}`,
      detail: `${s.outputTokens} output tokens \xB7 branch: ${s.branch}`
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
var path2 = __toESM(require("path"));
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
    const basename2 = path2.basename(uri.fsPath);
    if (showEntryBadges && entryPoints.has(uri.fsPath)) {
      return {
        badge: "E",
        tooltip: "Entry Point",
        color: new vscode3.ThemeColor("greatWhite.entryPointForeground"),
        propagate: true
      };
    }
    if (showEntryBadges && ENTRY_FILENAMES.has(basename2)) {
      const relative2 = path2.relative(folder.uri.fsPath, uri.fsPath);
      const depth = relative2.split(path2.sep).length - 1;
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
      out.add(path2.resolve(root, value));
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
  { label: "Great White (Dark)", themeId: "Great White (Dark)", shortName: "Dark", icon: "\u{1F30A}" },
  { label: "Great White (Light)", themeId: "Great White (Light)", shortName: "Light", icon: "\u2600\uFE0F" },
  { label: "Great White (Storm)", themeId: "Great White (Storm)", shortName: "Storm", icon: "\u{1F329}\uFE0F" },
  { label: "Great White (Frost)", themeId: "Great White (Frost)", shortName: "Frost", icon: "\u2744\uFE0F" },
  { label: "Great White (High Contrast Dark)", themeId: "Great White (High Contrast Dark)", shortName: "HC Dark", icon: "\u{1F311}" },
  { label: "Great White (High Contrast Light)", themeId: "Great White (High Contrast Light)", shortName: "HC Light", icon: "\u{1F315}" },
  { label: "Great White (Bloodloss)", themeId: "Great White (Bloodloss)", shortName: "Bloodloss", icon: "\u{1FA78}", detail: "Overflow / context-alarm theme \u2014 manual selection only" }
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
      if (e.affectsConfiguration("workbench.colorTheme")) {
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
      this.statusBar.show();
    } else {
      this.statusBar.hide();
    }
  }
  async showPicker() {
    const currentThemeId = getActiveThemeId();
    const currentEntry = findEntry(currentThemeId);
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
      await vscode4.workspace.getConfiguration().update("workbench.colorTheme", themeId, vscode4.ConfigurationTarget.Global);
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
