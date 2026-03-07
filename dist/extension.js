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
var vscode4 = __toESM(require("vscode"));

// src/tracker.ts
var vscode = __toESM(require("vscode"));
var GenerationTracker = class {
  docStats = /* @__PURE__ */ new Map();
  // Bloat Severity: 0 - 100
  currentSeverity = 0;
  constructor() {
  }
  trackChange(event) {
    const doc = event.document;
    if (doc.uri.scheme !== "file" && doc.uri.scheme !== "untitled") {
      return this.currentSeverity;
    }
    const uriStr = doc.uri.toString();
    const now = Date.now();
    const currentSize = doc.getText().length;
    let stat = this.docStats.get(uriStr);
    if (!stat) {
      stat = { lastSize: currentSize, lastUpdateTime: now, velocity: 0 };
      this.docStats.set(uriStr, stat);
      return this.currentSeverity;
    }
    const timeDiff = now - stat.lastUpdateTime;
    if (timeDiff > 0) {
      const sizeDiff = currentSize - stat.lastSize;
      if (sizeDiff > 0) {
        const currentVelocity = sizeDiff / timeDiff * 1e3;
        stat.velocity = stat.velocity * 0.7 + currentVelocity * 0.3;
      } else {
        stat.velocity = stat.velocity * 0.9;
      }
    }
    stat.lastSize = currentSize;
    stat.lastUpdateTime = now;
    this.currentSeverity = this.calculateSeverity(currentSize, stat.velocity);
    return this.currentSeverity;
  }
  getSeverity() {
    return this.currentSeverity;
  }
  getHottestFile() {
    let hottest;
    for (const [uriStr, stat] of this.docStats) {
      if (!hottest || stat.lastSize > hottest.chars) {
        const parsed = vscode.Uri.parse(uriStr);
        const segments = parsed.fsPath.replace(/\\/g, "/").split("/");
        const label = segments[segments.length - 1] || parsed.fsPath;
        hottest = { label, chars: stat.lastSize };
      }
    }
    return hottest;
  }
  decaySeverity() {
    if (this.currentSeverity > 0) {
      this.currentSeverity = Math.max(0, this.currentSeverity - 2);
      for (let stat of this.docStats.values()) {
        stat.velocity *= 0.8;
      }
    }
  }
  reset() {
    this.currentSeverity = 0;
    this.docStats.clear();
  }
  calculateSeverity(size, velocity) {
    const cfg = vscode.workspace.getConfiguration("greatWhite");
    const sizeThreshold = cfg.get("bloodloss.sizeThreshold", 5e5);
    const velocityThreshold = cfg.get("bloodloss.velocityThreshold", 5e3);
    const bloatScore = Math.min(50, size / sizeThreshold * 50);
    const velocityScore = Math.min(50, velocity / velocityThreshold * 50);
    return Math.min(100, bloatScore + velocityScore);
  }
};

// src/themeSwitcher.ts
var vscode2 = __toESM(require("vscode"));
var ThemeSwitcher = class {
  isBloodlossActive = false;
  originalTheme;
  constructor() {
  }
  get isActive() {
    return this.isBloodlossActive;
  }
  async switchToBloodloss() {
    if (this.isBloodlossActive) return;
    this.isBloodlossActive = true;
    const config = vscode2.workspace.getConfiguration("workbench");
    this.originalTheme = config.get("colorTheme");
    await config.update("colorTheme", "Great White (Bloodloss)", vscode2.ConfigurationTarget.Workspace);
  }
  async restoreOriginalTheme() {
    if (!this.isBloodlossActive) return;
    this.isBloodlossActive = false;
    const config = vscode2.workspace.getConfiguration("workbench");
    if (this.originalTheme && this.originalTheme !== "Great White (Bloodloss)") {
      await config.update("colorTheme", this.originalTheme, vscode2.ConfigurationTarget.Workspace);
    } else {
      await config.update("colorTheme", void 0, vscode2.ConfigurationTarget.Workspace);
    }
  }
};

// src/decorationProvider.ts
var vscode3 = __toESM(require("vscode"));
var path = __toESM(require("path"));
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
    const basename2 = path.basename(uri.fsPath);
    if (showEntryBadges && entryPoints.has(uri.fsPath)) {
      return {
        badge: "E",
        tooltip: "Entry Point",
        color: new vscode3.ThemeColor("greatWhite.entryPointForeground"),
        propagate: true
      };
    }
    if (showEntryBadges && ENTRY_FILENAMES.has(basename2)) {
      const relative2 = path.relative(folder.uri.fsPath, uri.fsPath);
      const depth = relative2.split(path.sep).length - 1;
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
      out.add(path.resolve(root, value));
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

// src/extension.ts
var tracker;
var switcher;
var statusBar;
var statusBarDismiss;
var statusBarDisable;
var previousSeverity = 0;
var warningSent = false;
var cleanseCount = 0;
var snoozedAtSeverity;
var extContext;
function activate(context) {
  extContext = context;
  tracker = new GenerationTracker();
  switcher = new ThemeSwitcher();
  snoozedAtSeverity = context.workspaceState.get("greatWhite.snoozedAtSeverity");
  statusBar = vscode4.window.createStatusBarItem(vscode4.StatusBarAlignment.Right, 200);
  statusBar.command = "greatWhite.cleanseBloodloss";
  context.subscriptions.push(statusBar);
  statusBarDismiss = vscode4.window.createStatusBarItem(vscode4.StatusBarAlignment.Right, 199);
  statusBarDismiss.text = "$(close)";
  statusBarDismiss.command = "greatWhite.dismissStatusBar";
  statusBarDismiss.tooltip = "Snooze alert \u2014 re-shows if severity rises 10+ points";
  context.subscriptions.push(statusBarDismiss);
  statusBarDisable = vscode4.window.createStatusBarItem(vscode4.StatusBarAlignment.Right, 198);
  statusBarDisable.text = "$(bell-slash)";
  statusBarDisable.command = "greatWhite.disableBloodloss";
  statusBarDisable.tooltip = "Disable context tracking. Re-enable via command palette.";
  context.subscriptions.push(statusBarDisable);
  let changeDisposable = vscode4.workspace.onDidChangeTextDocument((event) => {
    const severity = tracker.trackChange(event);
    evaluateSeverity(severity);
  });
  let editorDisposable = vscode4.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      const severity = tracker.trackChange({
        document: editor.document,
        contentChanges: [],
        reason: void 0
      });
      evaluateSeverity(severity);
    } else {
      switcher.restoreOriginalTheme();
    }
  });
  let cleanseCommand = vscode4.commands.registerCommand("greatWhite.cleanseBloodloss", () => {
    tracker.reset();
    switcher.restoreOriginalTheme();
    cleanseCount++;
    warningSent = false;
    snoozedAtSeverity = void 0;
    context.workspaceState.update("greatWhite.snoozedAtSeverity", void 0);
    updateStatusBar(0, false);
    vscode4.window.showInformationMessage("Bloodloss cleansed. The theme has been restored.");
  });
  let dismissCommand = vscode4.commands.registerCommand("greatWhite.dismissStatusBar", () => {
    const current = tracker.getSeverity();
    snoozedAtSeverity = current;
    context.workspaceState.update("greatWhite.snoozedAtSeverity", current);
    updateStatusBar(current, switcher.isActive);
  });
  let disableCommand = vscode4.commands.registerCommand("greatWhite.disableBloodloss", async () => {
    const cfg = vscode4.workspace.getConfiguration("greatWhite");
    await cfg.update("statusBar.enabled", false, vscode4.ConfigurationTarget.Global);
    statusBar.hide();
    statusBarDismiss.hide();
    statusBarDisable.hide();
    vscode4.window.showInformationMessage(
      "Great White context tracking disabled. Run 'Great White: Enable Context Tracking' to restore."
    );
  });
  let enableCommand = vscode4.commands.registerCommand("greatWhite.enableBloodloss", async () => {
    const cfg = vscode4.workspace.getConfiguration("greatWhite");
    await cfg.update("statusBar.enabled", true, vscode4.ConfigurationTarget.Global);
    updateStatusBar(tracker.getSeverity(), switcher.isActive);
  });
  const decorationProvider = new EntryPointDecorationProvider();
  const decorationRegistration = vscode4.window.registerFileDecorationProvider(decorationProvider);
  const pkgWatcher = vscode4.workspace.createFileSystemWatcher("**/package.json");
  const invalidateAndRefresh = (uri) => {
    const folder = vscode4.workspace.getWorkspaceFolder(uri);
    decorationProvider.invalidateCache(folder?.uri.toString());
    decorationProvider.fireAll();
  };
  pkgWatcher.onDidChange(invalidateAndRefresh);
  pkgWatcher.onDidCreate(invalidateAndRefresh);
  pkgWatcher.onDidDelete(invalidateAndRefresh);
  const configChangeDisposable = vscode4.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("greatWhite.showEntryPointDecorations") || e.affectsConfiguration("greatWhite.showEntryPointBadges") || e.affectsConfiguration("greatWhite.showConfigFileBadges")) {
      decorationProvider.fireAll();
    }
    if (e.affectsConfiguration("greatWhite.statusBar.alwaysShow") || e.affectsConfiguration("greatWhite.statusBar.enabled")) {
      updateStatusBar(tracker.getSeverity(), switcher.isActive);
    }
  });
  const resetDecorationsCmd = vscode4.commands.registerCommand("greatWhite.resetDecorations", async () => {
    const config = vscode4.workspace.getConfiguration("greatWhite");
    await config.update("showEntryPointDecorations", void 0, vscode4.ConfigurationTarget.Global);
    await config.update("showEntryPointBadges", void 0, vscode4.ConfigurationTarget.Global);
    await config.update("showConfigFileBadges", void 0, vscode4.ConfigurationTarget.Global);
    decorationProvider.fireAll();
    vscode4.window.showInformationMessage("Great White: Explorer decorations reset to defaults.");
  });
  const resetFileNestingCmd = vscode4.commands.registerCommand("greatWhite.resetFileNesting", async () => {
    const config = vscode4.workspace.getConfiguration();
    await config.update("explorer.fileNesting.enabled", void 0, vscode4.ConfigurationTarget.Workspace);
    await config.update("explorer.fileNesting.patterns", void 0, vscode4.ConfigurationTarget.Workspace);
    vscode4.window.showInformationMessage("Great White: File nesting patterns reset to defaults.");
  });
  context.subscriptions.push(
    changeDisposable,
    editorDisposable,
    cleanseCommand,
    dismissCommand,
    disableCommand,
    enableCommand,
    decorationRegistration,
    decorationProvider,
    pkgWatcher,
    configChangeDisposable,
    resetDecorationsCmd,
    resetFileNestingCmd
  );
  updateStatusBar(0, false);
}
function evaluateSeverity(severity) {
  const cfg = vscode4.workspace.getConfiguration("greatWhite");
  const triggerAt = cfg.get("bloodloss.triggerSeverity", 75);
  const restoreAt = triggerAt - 20;
  if (severity > triggerAt) {
    switcher.switchToBloodloss();
  } else if (severity < restoreAt) {
    switcher.restoreOriginalTheme();
  }
  const warnAt = cfg.get("bloodloss.warningSeverity", 50);
  if (warnAt > 0 && !warningSent && severity >= warnAt && previousSeverity < warnAt) {
    vscode4.window.showWarningMessage(
      `Great White: Context complexity rising (score ${Math.round(severity)}/100). Consider a checkpoint before Bloodloss activates.`
    );
    warningSent = true;
  }
  if (severity < 10) {
    warningSent = false;
  }
  updateStatusBar(severity, switcher.isActive);
}
function updateStatusBar(severity, bloodlossActive) {
  const cfg = vscode4.workspace.getConfiguration("greatWhite");
  const enabled = cfg.get("statusBar.enabled", true);
  const alwaysShow = cfg.get("statusBar.alwaysShow", true);
  const triggerAt = cfg.get("bloodloss.triggerSeverity", 75);
  if (!enabled) {
    statusBar.hide();
    statusBarDismiss.hide();
    statusBarDisable.hide();
    return;
  }
  if (snoozedAtSeverity !== void 0) {
    if (severity < 10 || severity >= snoozedAtSeverity + 10) {
      snoozedAtSeverity = void 0;
      extContext.workspaceState.update("greatWhite.snoozedAtSeverity", void 0);
    } else {
      statusBar.hide();
      statusBarDismiss.hide();
      statusBarDisable.hide();
      return;
    }
  }
  if (severity < 10 && !alwaysShow) {
    statusBar.hide();
    statusBarDismiss.hide();
    statusBarDisable.hide();
    return;
  }
  const delta = severity - previousSeverity;
  const trend = delta > 3 ? "\u2191" : delta < -3 ? "\u2193" : "\u2192";
  previousSeverity = severity;
  const score = Math.round(severity);
  const pct = Math.min(100, score);
  const hotFile = tracker.getHottestFile();
  const hotFileStr = hotFile ? `Hottest file: ${hotFile.label} (${(hotFile.chars / 1e3).toFixed(1)} KB).` : "";
  if (bloodlossActive) {
    statusBar.text = `\u{1FA78} ${score} ${trend}`;
    statusBar.color = void 0;
    statusBar.backgroundColor = new vscode4.ThemeColor("statusBarItem.warningBackground");
    statusBar.tooltip = [
      `Bloodloss active \u2014 AI output velocity critical.`,
      `Score: ${score}/100 (~${pct}% of context capacity).`,
      hotFileStr,
      `Cleanses this session: ${cleanseCount}.`,
      `Click to cleanse and restore theme.`
    ].filter(Boolean).join("\n");
  } else if (score >= 50) {
    statusBar.text = `\u{1F988} ${score} ${trend}`;
    statusBar.color = new vscode4.ThemeColor("charts.yellow");
    statusBar.backgroundColor = void 0;
    statusBar.tooltip = [
      `Context complexity high \u2014 score ${score}/100 (~${pct}% of context window).`,
      `Warning: checkpoint before Bloodloss activates at ${triggerAt}.`,
      hotFileStr,
      `Click to cleanse and reset score.`
    ].filter(Boolean).join("\n");
  } else if (score >= 10) {
    statusBar.text = `\u{1F988} ${score} ${trend}`;
    statusBar.color = void 0;
    statusBar.backgroundColor = void 0;
    statusBar.tooltip = [
      `Context complexity building \u2014 score ${score}/100 (~${pct}% of context window).`,
      `Bloodloss alarm activates at ${triggerAt}.`,
      hotFileStr,
      `Click to cleanse and reset score.`
    ].filter(Boolean).join("\n");
  } else {
    statusBar.text = `\u{1F988} ${score} ${trend}`;
    statusBar.color = new vscode4.ThemeColor("charts.green");
    statusBar.backgroundColor = void 0;
    statusBar.tooltip = [
      `Context healthy \u2014 score ${score}/100 (~${pct}% of context window).`,
      hotFileStr || "No files tracked yet.",
      `Bloodloss alarm threshold: ${triggerAt}.`
    ].join("\n");
  }
  statusBar.show();
  if (score >= 10) {
    statusBarDismiss.show();
  } else {
    statusBarDismiss.hide();
  }
  statusBarDisable.show();
}
function deactivate() {
  return switcher?.restoreOriginalTheme();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
