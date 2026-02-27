# Release Checklist

## Pre-release

- [ ] Verify `package.json` metadata:
- [ ] `name`, `displayName`, `publisher`, `description`, `categories`, `keywords`
- [ ] Confirm repository links (`repository`, `bugs`, `homepage`) are valid
- [ ] Ensure `CHANGELOG.md` has release notes for target version
- [ ] Validate both themes manually in Extension Development Host (`F5`)
- [ ] Check readability in TypeScript, Python, JSON, and Markdown samples
- [ ] Confirm diagnostics and diff colors are distinguishable
- [ ] Run `vsce package` and confirm VSIX generated successfully

## Publish

- [ ] Authenticate: `vsce login shark-labs`
- [ ] Publish: `vsce publish`
- [ ] Verify Marketplace page renders README and metadata correctly
- [ ] Verify both variants appear in Theme Picker

## Post-release

- [ ] Push git tag and GitHub release notes
- [ ] Attach generated VSIX to GitHub release (optional)
- [ ] Announce release and collect early feedback
