# Release Checklist

> TIP: Use `@release-manager` in Copilot to walk through this checklist interactively.

## Pre-release

- [ ] Verify `package.json` metadata:
- [ ] `name`, `displayName`, `publisher`, `description`, `categories`, `keywords`
- [ ] Confirm repository links (`repository`, `bugs`, `homepage`) are valid
- [ ] Ensure `CHANGELOG.md` has release notes for target version
- [ ] Run `node .scripts/audit.js` — resolve any HIGH severity issues before continuing
- [ ] Validate all six themes manually in Extension Development Host (`F5`)
- [ ] Check readability in TypeScript, Python, JSON, and Markdown samples
- [ ] Confirm diagnostics and diff colors are distinguishable
- [ ] Verify Explorer enhancements in Extension Development Host:
  - [ ] File nesting is active — `package-lock.json` nests under `package.json`, `CHANGELOG.md` nests under `README.md`, etc.
  - [ ] Entry point badge `E` (amber) appears on files listed in `package.json` `main`/`module`/`exports`/`bin`
  - [ ] Config badge `C` (sky blue) appears on `tsconfig.json`, `vite.config.*`, `.eslintrc*`, etc.
  - [ ] Parent folders tint amber when they contain an entry point (propagate)
  - [ ] `greatWhite.showEntryPointDecorations: false` clears all badges without requiring reload
- [ ] Run `vsce package` and confirm VSIX generated successfully

## Publish

- [ ] Authenticate: `vsce login shark-labs`
- [ ] Publish: `vsce publish`
- [ ] Verify Marketplace page renders README and metadata correctly
- [ ] Verify all six variants appear in Theme Picker

## Post-release

- [ ] Push git tag and GitHub release notes
- [ ] Attach generated VSIX to GitHub release (optional)
- [ ] Announce release and collect early feedback
