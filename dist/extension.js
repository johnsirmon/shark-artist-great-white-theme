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
var vscode3 = __toESM(require("vscode"));

// src/tracker.ts
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
    let bloatScore = Math.min(50, size / 1e5 * 50);
    let velocityScore = Math.min(50, velocity / 1e3 * 50);
    return Math.min(100, bloatScore + velocityScore);
  }
};

// src/themeSwitcher.ts
var vscode = __toESM(require("vscode"));
var ThemeSwitcher = class {
  isBloodlossActive = false;
  originalTheme;
  constructor() {
  }
  async switchToBloodloss() {
    if (this.isBloodlossActive) return;
    this.isBloodlossActive = true;
    const config = vscode.workspace.getConfiguration("workbench");
    this.originalTheme = config.get("colorTheme");
    await config.update("colorTheme", "Great White (Bloodloss)", vscode.ConfigurationTarget.Workspace);
    vscode.window.showWarningMessage("\u{1FA78} File complexity threshold exceeded. Context bloat detected.", "Acknowledge");
  }
  async restoreOriginalTheme() {
    if (!this.isBloodlossActive) return;
    this.isBloodlossActive = false;
    const config = vscode.workspace.getConfiguration("workbench");
    if (this.originalTheme && this.originalTheme !== "Great White (Bloodloss)") {
      await config.update("colorTheme", this.originalTheme, vscode.ConfigurationTarget.Workspace);
    } else {
      await config.update("colorTheme", void 0, vscode.ConfigurationTarget.Workspace);
    }
  }
};

// src/decorationProvider.ts
var vscode2 = __toESM(require("vscode"));
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
  _onDidChangeFileDecorations = new vscode2.EventEmitter();
  onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  /** Keyed by workspace folder URI string → resolved absolute entry-point paths */
  _entryPointCache = /* @__PURE__ */ new Map();
  async provideFileDecoration(uri, _token) {
    const config = vscode2.workspace.getConfiguration("greatWhite");
    if (!config.get("showEntryPointDecorations", true)) {
      return void 0;
    }
    const folder = vscode2.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return void 0;
    }
    const entryPoints = await this._getEntryPoints(folder);
    const basename2 = path.basename(uri.fsPath);
    if (entryPoints.has(uri.fsPath)) {
      return {
        badge: "E",
        tooltip: "Entry Point",
        color: new vscode2.ThemeColor("greatWhite.entryPointForeground"),
        propagate: true
      };
    }
    if (ENTRY_FILENAMES.has(basename2)) {
      const relative2 = path.relative(folder.uri.fsPath, uri.fsPath);
      const depth = relative2.split(path.sep).length - 1;
      if (depth <= 2) {
        return {
          badge: "E",
          tooltip: "Entry Point",
          color: new vscode2.ThemeColor("greatWhite.entryPointForeground"),
          propagate: true
        };
      }
    }
    if (CONFIG_PATTERN.test(basename2)) {
      return {
        badge: "C",
        tooltip: "Config / Build File",
        color: new vscode2.ThemeColor("greatWhite.configFileForeground"),
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
    const found = await vscode2.workspace.findFiles(
      new vscode2.RelativePattern(folder, "package.json"),
      "**/node_modules/**",
      1
    );
    if (found.length > 0) {
      try {
        const raw = await vscode2.workspace.fs.readFile(found[0]);
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
function activate(context) {
  tracker = new GenerationTracker();
  switcher = new ThemeSwitcher();
  let changeDisposable = vscode3.workspace.onDidChangeTextDocument((event) => {
    const severity = tracker.trackChange(event);
    evaluateSeverity(severity);
  });
  let editorDisposable = vscode3.window.onDidChangeActiveTextEditor((editor) => {
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
  let cleanseCommand = vscode3.commands.registerCommand("greatWhite.cleanseBloodloss", () => {
    tracker.reset();
    switcher.restoreOriginalTheme();
    vscode3.window.showInformationMessage("Bloodloss cleansed. The theme has been restored.");
  });
  const decorationProvider = new EntryPointDecorationProvider();
  const decorationRegistration = vscode3.window.registerFileDecorationProvider(decorationProvider);
  const pkgWatcher = vscode3.workspace.createFileSystemWatcher("**/package.json");
  const invalidateAndRefresh = (uri) => {
    const folder = vscode3.workspace.getWorkspaceFolder(uri);
    decorationProvider.invalidateCache(folder?.uri.toString());
    decorationProvider.fireAll();
  };
  pkgWatcher.onDidChange(invalidateAndRefresh);
  pkgWatcher.onDidCreate(invalidateAndRefresh);
  pkgWatcher.onDidDelete(invalidateAndRefresh);
  const configChangeDisposable = vscode3.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("greatWhite.showEntryPointDecorations")) {
      decorationProvider.fireAll();
    }
  });
  context.subscriptions.push(
    changeDisposable,
    editorDisposable,
    cleanseCommand,
    decorationRegistration,
    decorationProvider,
    pkgWatcher,
    configChangeDisposable
  );
}
function evaluateSeverity(severity) {
  if (severity > 50) {
    switcher.switchToBloodloss();
  } else if (severity < 30) {
    switcher.restoreOriginalTheme();
  }
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
