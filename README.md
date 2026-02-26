# Shark Artist: Great White Theme

A brand-forward VS Code theme pack inspired by great white sharks and coastal depth.

Includes two variants:
- `Great White (Dark)`
- `Great White (Light)`

## Design Intent

This theme is built around a realistic, muted ocean palette drawn from great white dorsal slate, ventral off-white, and open-water blue:
- Deep water blues and navy for structure and focus
- Dorsal slate and soft off-white for readable hierarchy
- Controlled spray-blue accents for active states; coral/amber only for diagnostics

## Install (Local Development)

1. Open this folder in VS Code.
2. Press `F5` to launch an Extension Development Host window.
3. In the new window, run `Preferences: Color Theme`.
4. Pick `Great White (Dark)` or `Great White (Light)`.

## Packaging

```bash
npm install -g @vscode/vsce
vsce package
```

## Publishing

```bash
vsce login thesharkartist
vsce publish
```

## Marketplace Notes

Before first publish, verify these fields in `package.json`:
- `publisher`
- `repository`
- `bugs`
- `homepage`

If the publisher ID is unavailable, create an alternate publisher and update `publisher`.

## License

MIT. See `LICENSE`.
