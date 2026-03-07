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
var vscode2 = __toESM(require("vscode"));

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

// src/extension.ts
var tracker;
var switcher;
function activate(context) {
  tracker = new GenerationTracker();
  switcher = new ThemeSwitcher();
  let changeDisposable = vscode2.workspace.onDidChangeTextDocument((event) => {
    const severity = tracker.trackChange(event);
    evaluateSeverity(severity);
  });
  let editorDisposable = vscode2.window.onDidChangeActiveTextEditor((editor) => {
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
  let cleanseCommand = vscode2.commands.registerCommand("greatWhite.cleanseBloodloss", () => {
    tracker.reset();
    switcher.restoreOriginalTheme();
    vscode2.window.showInformationMessage("Bloodloss cleansed. The theme has been restored.");
  });
  context.subscriptions.push(changeDisposable, editorDisposable, cleanseCommand);
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
