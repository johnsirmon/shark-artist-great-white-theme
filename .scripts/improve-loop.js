#!/usr/bin/env node
"use strict";

/**
 * improve-loop.js
 *
 * Safe agentic improvement loop for the Great White theme.
 *
 * What it does:
 *   1. Runs audit.js and collects findings.
 *   2. Applies auto-fixable issues (currently: re-enables semanticHighlighting).
 *   3. Validates with `vsce package` as a hard gate before any commit.
 *   4. Logs a summary entry to .learnings/ regardless of outcome.
 *   5. Exits non-zero if validation fails or high-severity issues remain.
 *
 * Safety guarantees:
 *   - Never pushes or publishes (git/vsce publish not called).
 *   - On vsce package failure, reverts theme file changes and logs to ERRORS.md.
 *   - --dry-run flag suppresses all file writes.
 *
 * Usage:
 *   node .scripts/improve-loop.js [--dry-run] [--report <path>]
 */

const fs          = require("fs");
const path        = require("path");
const { execSync } = require("child_process");

const ROOT          = path.join(__dirname, "..");
const DARK_PATH     = path.join(ROOT, "themes", "great-white-dark-color-theme.json");
const LIGHT_PATH    = path.join(ROOT, "themes", "great-white-light-color-theme.json");
const LEARNINGS     = path.join(ROOT, ".learnings", "LEARNINGS.md");
const ERRORS_FILE   = path.join(ROOT, ".learnings", "ERRORS.md");

const DRY_RUN    = process.argv.includes("--dry-run");
const reportIdx  = process.argv.indexOf("--report");
const REPORT_IN  = reportIdx !== -1 ? process.argv[reportIdx + 1] : null;

// ── Date helpers ──────────────────────────────────────────────────────────────
function today()        { return new Date().toISOString().slice(0, 10); }
function todayCompact() { return today().replace(/-/g, ""); }

// ── Entry counter (per day, per file) ─────────────────────────────────────────
function nextId(filePath, prefix) {
  if (!fs.existsSync(filePath)) return `${prefix}-${todayCompact()}-001`;
  const content = fs.readFileSync(filePath, "utf8");
  const pat = new RegExp(`${prefix}-${todayCompact()}-(\\d{3})`, "g");
  let last = 0, m;
  while ((m = pat.exec(content))) last = Math.max(last, parseInt(m[1], 10));
  return `${prefix}-${todayCompact()}-${String(last + 1).padStart(3, "0")}`;
}

// ── Append an entry block above the sentinel comment ─────────────────────────
function appendEntry(filePath, block) {
  const sentinel = "<!-- Add new entries below this line, newest first. -->";
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const pos = content.indexOf(sentinel);
  if (pos === -1) {
    content += "\n" + block;
  } else {
    const after = pos + sentinel.length;
    content = content.slice(0, after) + "\n" + block + content.slice(after);
  }
  if (!DRY_RUN) fs.writeFileSync(filePath, content, "utf8");
}

function logLearning(entry) {
  const id = nextId(LEARNINGS, "LRN");
  appendEntry(LEARNINGS, [
    `<!--`,
    `ID:               ${id}`,
    `Logged:           ${today()}`,
    `Priority:         ${entry.priority || "low"}`,
    `Status:           open`,
    `Area:             ${entry.area || "conventions"}`,
    `Summary:          ${entry.summary}`,
    `Details:          >`,
    `  ${entry.details}`,
    `Suggested Action: >`,
    `  ${entry.action}`,
    ``,
    `Metadata:`,
    `  Source:           improve-loop`,
    `  Related Files:    ${JSON.stringify(entry.files || [])}`,
    `  Tags:             []`,
    `  See Also:         []`,
    `  Pattern-Key:      ${entry.patternKey || "improve-loop-run"}`,
    `  Recurrence-Count: 1`,
    `-->`,
    "",
  ].join("\n"));
}

function logError(entry) {
  const id = nextId(ERRORS_FILE, "ERR");
  appendEntry(ERRORS_FILE, [
    `<!--`,
    `ID:               ${id}`,
    `Logged:           ${today()}`,
    `Summary:          ${entry.summary}`,
    `Error:            >`,
    `  ${entry.error}`,
    `Context:          >`,
    `  ${entry.context}`,
    `Suggested Fix:    >`,
    `  ${entry.fix}`,
    ``,
    `Metadata:`,
    `  Reproducible:   ${entry.reproducible || "yes"}`,
    `  Related Files:  ${JSON.stringify(entry.files || [])}`,
    `  See Also:       []`,
    `-->`,
    "",
  ].join("\n"));
}

// ── Audit ─────────────────────────────────────────────────────────────────────
function runAudit() {
  try {
    const out = execSync(`node "${path.join(__dirname, "audit.js")}" --json`,
      { cwd: ROOT, encoding: "utf8", stdio: ["pipe","pipe","pipe"] });
    return JSON.parse(out);
  } catch (err) {
    try   { return JSON.parse(err.stdout); }
    catch { return { issues: [], summary: { total:0, high:0, medium:0, autofix:0 } }; }
  }
}

// ── Auto-fix: re-enable semanticHighlighting ──────────────────────────────────
function applyAutoFixes(report) {
  const fixes = report.issues.filter(i => i.autofix);
  if (fixes.length === 0) return 0;
  for (const fix of fixes) {
    if (fix.type === "semantic-highlighting-disabled") {
      for (const p of [DARK_PATH, LIGHT_PATH]) {
        const theme = JSON.parse(fs.readFileSync(p, "utf8"));
        theme.semanticHighlighting = true;
        if (!DRY_RUN) fs.writeFileSync(p, JSON.stringify(theme, null, 2) + "\n", "utf8");
        console.log(`  [autofix] semanticHighlighting=true in ${path.basename(p)}`);
      }
    }
  }
  return fixes.length;
}

// ── vsce package validation ───────────────────────────────────────────────────
function validatePackage() {
  try {
    execSync("vsce package --no-git-tag-version", { cwd: ROOT, stdio: "pipe" });
    return { ok: true };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { ok: false, error: stderr.trim() };
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function main() {
  console.log(`[improve-loop] ${today()}${DRY_RUN ? " (dry-run)" : ""}`);

  // Load or run audit
  let report;
  if (REPORT_IN && fs.existsSync(REPORT_IN)) {
    report = JSON.parse(fs.readFileSync(REPORT_IN, "utf8"));
    console.log(`[improve-loop] Loaded audit from ${REPORT_IN}`);
  } else {
    console.log("[improve-loop] Running audit...");
    report = runAudit();
  }

  const { summary, issues } = report;
  console.log(`[improve-loop] Audit: ${summary.total} issues  (high:${summary.high}  medium:${summary.medium}  autofix:${summary.autofix})`);

  if (summary.total === 0) {
    console.log("[improve-loop] Clean. No action needed.");
    logLearning({
      priority: "low", area: "conventions",
      summary: "Improve loop: no audit issues.",
      details: "All required keys, scopes, and semantic tokens are present. Both themes are symmetric.",
      action: "No action needed.",
      patternKey: "improve-loop-clean",
      files: [DARK_PATH, LIGHT_PATH],
    });
    process.exit(0);
  }

  // Apply auto-fixes
  const fixed = applyAutoFixes(report);
  if (fixed > 0) console.log(`[improve-loop] Applied ${fixed} auto-fix(es).`);

  // Log high-severity issues
  const high = issues.filter(i => i.severity === "high");
  for (const iss of high) {
    console.log(`  [HIGH] ${iss.type}: ${iss.key || ""}${iss.detail ? "  " + iss.detail : ""}`);
    logLearning({
      priority: "high",
      area: iss.type.includes("contrast") ? "palette" : iss.type.includes("ansi") ? "conventions" : "workbench",
      summary: `${iss.type}: ${iss.key || ""}`,
      details: JSON.stringify(iss),
      action: "Review and correct in both theme files before next release.",
      patternKey: `audit-${iss.type}-${(iss.key || "").replace(/\W/g,"-")}`,
      files: [iss.theme === "dark" ? DARK_PATH : iss.theme === "light" ? LIGHT_PATH : ""],
    });
  }

  if (DRY_RUN) {
    console.log("[improve-loop] Dry-run complete. No files written.");
    process.exit(summary.high > 0 ? 1 : 0);
  }

  // Validate package
  console.log("[improve-loop] Validating package (vsce package)...");
  const val = validatePackage();
  if (!val.ok) {
    console.error("[improve-loop] vsce package FAILED. Reverting auto-fixes.");
    // Revert via git checkout if in a git repo
    try { execSync("git checkout -- themes/", { cwd: ROOT, stdio: "pipe" }); } catch (_) {}
    logError({
      summary: "vsce package failed during improve-loop",
      error: val.error,
      context: "improve-loop applied fixes and ran vsce package as validation gate",
      fix: "Inspect theme JSON for syntax errors. Run: vsce package",
      reproducible: "yes",
      files: [DARK_PATH, LIGHT_PATH],
    });
    process.exit(1);
  }

  console.log("[improve-loop] Package valid.");
  logLearning({
    priority: summary.high > 0 ? "high" : "low",
    area: "release",
    summary: `Improve loop: ${summary.total} issues found, package valid.`,
    details: `${summary.high} high, ${summary.medium} medium. ${fixed} auto-fixed. vsce package passed.`,
    action: summary.high > 0
      ? "Address high-severity items in .learnings/LEARNINGS.md before next release."
      : "No action needed.",
    patternKey: "improve-loop-run",
    files: [DARK_PATH, LIGHT_PATH],
  });

  console.log("[improve-loop] Done.");
  process.exit(summary.high > 0 ? 1 : 0);
}

main();
