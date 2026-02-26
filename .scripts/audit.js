#!/usr/bin/env node
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT       = path.join(__dirname, "..");
const DARK_PATH  = path.join(ROOT, "themes", "great-white-dark-color-theme.json");
const LIGHT_PATH = path.join(ROOT, "themes", "great-white-light-color-theme.json");

// ── Required workbench color keys (both files must define these) ─────────────
const REQUIRED_COLOR_KEYS = [
  "focusBorder",
  "editor.background", "editor.foreground",
  "editor.lineHighlightBackground", "editor.selectionBackground",
  "editor.findMatchBackground", "editor.wordHighlightBackground",
  "editorCursor.foreground",
  "editorBracketMatch.border",
  "editorBracketHighlight.foreground1", "editorBracketHighlight.foreground2",
  "editorBracketHighlight.unexpectedBracket.foreground",
  "editorError.foreground", "editorWarning.foreground", "editorInfo.foreground",
  "editorGutter.modifiedBackground", "editorGutter.addedBackground", "editorGutter.deletedBackground",
  "editorOverviewRuler.errorForeground", "editorOverviewRuler.warningForeground",
  "editorGroup.border", "editorGroupHeader.tabsBackground",
  "tab.activeBackground", "tab.activeForeground", "tab.activeBorderTop",
  "tab.inactiveBackground", "tab.inactiveForeground",
  "sideBar.background", "sideBar.foreground", "sideBar.border",
  "activityBar.background", "activityBar.foreground", "activityBar.border",
  "activityBarBadge.background",
  "statusBar.background", "statusBar.foreground", "statusBar.border",
  "statusBar.debuggingBackground",
  "titleBar.activeBackground", "titleBar.activeForeground",
  "titleBar.inactiveBackground", "titleBar.border",
  "panel.background", "panel.border",
  "panelTitle.activeForeground", "panelTitle.activeBorder",
  "input.background", "input.foreground", "input.border", "input.placeholderForeground",
  "dropdown.background", "dropdown.border",
  "button.background", "button.foreground", "button.hoverBackground",
  "list.activeSelectionBackground", "list.activeSelectionForeground",
  "list.hoverBackground", "list.inactiveSelectionBackground",
  "list.highlightForeground",
  "breadcrumb.foreground", "breadcrumb.activeSelectionForeground",
  "gitDecoration.addedResourceForeground", "gitDecoration.modifiedResourceForeground",
  "gitDecoration.deletedResourceForeground", "gitDecoration.ignoredResourceForeground",
  "gitDecoration.conflictingResourceForeground",
  "diffEditor.insertedTextBackground", "diffEditor.removedTextBackground",
  "scrollbarSlider.background", "scrollbarSlider.hoverBackground", "scrollbarSlider.activeBackground",
  "badge.background", "badge.foreground", "progressBar.background",
  "peekView.border", "peekViewEditor.background", "peekViewResult.background",
  "minimap.selectionHighlight", "minimap.errorHighlight", "minimap.warningHighlight",
  "terminal.background", "terminal.foreground",
  "terminal.ansiBlack", "terminal.ansiRed", "terminal.ansiGreen", "terminal.ansiYellow",
  "terminal.ansiBlue", "terminal.ansiMagenta", "terminal.ansiCyan", "terminal.ansiWhite",
  "terminal.ansiBrightBlack", "terminal.ansiBrightWhite",
];

// ── Required semantic token types ────────────────────────────────────────────
const REQUIRED_SEMANTIC = [
  "variable", "parameter", "property", "function", "method",
  "class", "interface", "type", "enumMember", "keyword",
  "decorator", "operator", "string", "number",
];

// ── Required TextMate token scopes ───────────────────────────────────────────
const REQUIRED_SCOPES = [
  "comment", "string", "constant.numeric", "keyword", "keyword.operator",
  "entity.name.function", "entity.name.type", "variable", "variable.language",
  "constant", "entity.name.tag", "entity.other.attribute-name",
  "markup.heading", "markup.bold", "markup.italic", "markup.inline.raw",
  "markup.quote", "invalid",
];

// ── ANSI keys that must match between dark and light ─────────────────────────
const ANSI_KEYS = [
  "terminal.ansiBlack","terminal.ansiRed","terminal.ansiGreen","terminal.ansiYellow",
  "terminal.ansiBlue","terminal.ansiMagenta","terminal.ansiCyan","terminal.ansiWhite",
  "terminal.ansiBrightBlack","terminal.ansiBrightRed","terminal.ansiBrightGreen",
  "terminal.ansiBrightYellow","terminal.ansiBrightBlue","terminal.ansiBrightMagenta",
  "terminal.ansiBrightCyan","terminal.ansiBrightWhite",
];

// ── WCAG contrast helpers ─────────────────────────────────────────────────────
function hexLuminance(hex) {
  const h = hex.replace("#","").slice(0,6);
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  const f = c => c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
}
function contrastRatio(a, b) {
  const la = hexLuminance(a), lb = hexLuminance(b);
  const hi = Math.max(la,lb), lo = Math.min(la,lb);
  return (hi+0.05)/(lo+0.05);
}

// ── Checks ────────────────────────────────────────────────────────────────────
function getDefinedScopes(theme) {
  const s = new Set();
  for (const rule of theme.tokenColors || []) {
    const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    scopes.forEach(sc => s.add(sc));
  }
  return s;
}

function checkTheme(theme, themeName) {
  const issues = [];

  // Required workbench keys
  for (const key of REQUIRED_COLOR_KEYS) {
    if (!theme.colors || !(key in theme.colors)) {
      issues.push({ severity:"high", type:"missing-color-key", theme:themeName, key, autofix:false });
    }
  }

  // semanticHighlighting must be true
  if (theme.semanticHighlighting !== true) {
    issues.push({ severity:"high", type:"semantic-highlighting-disabled", theme:themeName, key:"semanticHighlighting", autofix:true });
  }

  // Required semantic tokens
  const st = theme.semanticTokenColors || {};
  for (const token of REQUIRED_SEMANTIC) {
    if (!(token in st) && !(token.split(".")[0] in st)) {
      issues.push({ severity:"medium", type:"missing-semantic-token", theme:themeName, key:token, autofix:false });
    }
  }

  // Required token scopes
  const defined = getDefinedScopes(theme);
  for (const scope of REQUIRED_SCOPES) {
    if (!defined.has(scope)) {
      issues.push({ severity:"medium", type:"missing-token-scope", theme:themeName, key:scope, autofix:false });
    }
  }

  // WCAG contrast for syntax token colors vs editor background
  const bg = theme.colors && theme.colors["editor.background"];
  if (bg) {
    const tokenScopes = [
      { name:"comment",  scope:"comment" },
      { name:"string",   scope:"string" },
      { name:"keyword",  scope:"keyword" },
      { name:"function", scope:"entity.name.function" },
      { name:"number",   scope:"constant.numeric" },
    ];
    for (const { name, scope } of tokenScopes) {
      const rule = (theme.tokenColors || []).find(r => {
        const s = Array.isArray(r.scope) ? r.scope : [r.scope];
        return s.includes(scope);
      });
      if (rule && rule.settings && rule.settings.foreground) {
        const cr = contrastRatio(rule.settings.foreground, bg);
        if (cr < 4.5) {
          issues.push({
            severity: "high",
            type: "contrast-fail",
            theme: themeName,
            key: scope,
            detail: `${rule.settings.foreground} vs bg ${bg} = ${cr.toFixed(2)}:1 (need 4.5)`,
            autofix: false,
          });
        }
      }
    }
  }

  return issues;
}

function checkSymmetry(dark, light) {
  const issues = [];
  const dk = new Set(Object.keys(dark.colors || {}));
  const lk = new Set(Object.keys(light.colors || {}));

  for (const key of dk) {
    if (!lk.has(key))
      issues.push({ severity:"medium", type:"asymmetric-key", presentIn:"dark", missingFrom:"light", key });
  }
  for (const key of lk) {
    if (!dk.has(key))
      issues.push({ severity:"medium", type:"asymmetric-key", presentIn:"light", missingFrom:"dark", key });
  }

  // ANSI must match
  for (const key of ANSI_KEYS) {
    const dv = dark.colors && dark.colors[key];
    const lv = light.colors && light.colors[key];
    if (dv && lv && dv !== lv) {
      issues.push({ severity:"high", type:"ansi-mismatch", key, dark:dv, light:lv, autofix:false });
    }
  }

  return issues;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const jsonMode = process.argv.includes("--json");

  let dark, light;
  try {
    dark  = JSON.parse(fs.readFileSync(DARK_PATH,  "utf8"));
    light = JSON.parse(fs.readFileSync(LIGHT_PATH, "utf8"));
  } catch (err) {
    const msg = { error: "Failed to parse theme files: " + err.message };
    process.stdout.write(JSON.stringify(msg) + "\n");
    process.exit(2);
  }

  const issues = [
    ...checkTheme(dark,  "dark"),
    ...checkTheme(light, "light"),
    ...checkSymmetry(dark, light),
  ];

  const summary = {
    total:   issues.length,
    high:    issues.filter(i => i.severity === "high").length,
    medium:  issues.filter(i => i.severity === "medium").length,
    autofix: issues.filter(i => i.autofix).length,
  };

  if (jsonMode) {
    process.stdout.write(JSON.stringify({ issues, summary }, null, 2) + "\n");
  } else {
    console.log("=== Theme Audit ===");
    if (issues.length === 0) {
      console.log("No issues found.");
    } else {
      for (const i of issues) {
        const tag  = i.severity === "high" ? "[HIGH]" : "[MED] ";
        const fix  = i.autofix ? " (autofix)" : "";
        const det  = i.detail  ? "  " + i.detail : "";
        const thm  = i.theme   ? " [" + i.theme + "]" : "";
        console.log(`${tag}${thm} ${i.type}: ${i.key || ""}${fix}${det}`);
      }
    }
    console.log(`\nTotal:${summary.total}  High:${summary.high}  Medium:${summary.medium}  Autofix:${summary.autofix}`);
  }

  process.exit(summary.high > 0 ? 1 : 0);
}

main();
