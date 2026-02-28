# Midjourney Icon Workspace (Local-First)

This folder supports a manual Midjourney workflow with local automation after image export.

Policy constraints:
- Midjourney use must remain manual.
- Do not automate Midjourney website interactions.
- Save generated images manually into `incoming/`.

Workflow:
1. Generate icon candidates manually in Midjourney.
2. Save source images to `.midjourney-workspace/incoming/`.
3. Run `Convert-IconsToSvg.ps1` to create SVG candidates in `output-svg/`.
4. Run `Validate-SvgIcons.ps1` to ensure icon output is 16x16 and vector content exists.
5. Run `Sync-IconsToRepo.ps1` to copy validated icons into `icons/`.

Notes:
- This workspace is excluded from extension packaging via `.vscodeignore`.
- Source images and generated intermediates should stay local and private.
