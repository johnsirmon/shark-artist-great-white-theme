# VS Code Theme Extension Best Practices

## 1. Marketplace Presence

### Icon
- **Format:** PNG (SVG is not supported by the Marketplace).
- **Size:** At least 128x128 pixels (256x256 recommended for high DPI).
- **Design:** distinctive, simple shape, uses theme colors. Avoid text.
- **Reference:** `package.json` -> `"icon": "icon.png"`

### Screenshots
- **Importance:** Users judge themes visually.
- **Format:** High-resolution PNGs. Avoid JPEGs (compression artifacts).
- **Content:** Show code in popular languages (JS/TS, Python, HTML/CSS) and UI elements (sidebar, status bar).
- **Location:** Store in `images/` or similar folder in repo, link in `README.md`.

### Gallery Banner
- **Define:** Set `galleryBanner.color` and `galleryBanner.theme` in `package.json`.
- **Purpose:** Brands your extension page header in the Marketplace.

### Keywords & Categories
- **Keywords:** Include specific terms like "dark theme", "accessible", "shark", "ocean".
- **Categories:** Always include "Themes".

## 2. Technical Quality

### Contrast & Accessibility
- **Target:** WCAG AA (4.5:1 text vs background).
- **Tooling:** Use scripts to automate contrast checking (like `.scripts/audit.js`).
- **Semantic Highlighting:** Support semantic tokens (`semanticTokenColors`) for modern language features.

### Workbench Coverage
- **Completeness:** Style not just the editor, but the sidebar, activity bar, status bar, tabs, inputs, lists, and notifications.
- **Consistency:** Ensure UI borders/focus states match the theme aesthetic.

### Minimal Maintenance
- **Files:** Keep theme JSONs minimal. Inherit from standard baselines if possible (though this theme uses full definitions).
- **Build:** Automate packaging (`vsce package`) and validation.

## 3. Community & Feedback

### README.md
- **Clear Pitch:** What makes this theme unique? (Contrast, Shark inspiration).
- **Installation:** Simple steps.
- **Visuals:** Screenshots are mandatory.
- **Badges:** Add badges for Version, Downloads, License.

### Versioning
- **SemVer:** Use Semantic Versioning (MAJOR.MINOR.PATCH).
- **Changelog:** Maintain a `CHANGELOG.md` for major updates.

### License
- **Open Source:** MIT is standard and encourages use.
