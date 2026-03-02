# Screenshot Capture Helper
# Run this script, then use Win+Shift+S to capture each theme as it activates.
# Save each screenshot to docs/screenshots/ with the filename shown.

$themes = @(
    @{ name = "Great White (Dark)";                 file = "great-white-dark.png" },
    @{ name = "Great White (Light)";                file = "great-white-light.png" },
    @{ name = "Great White (Storm)";                file = "great-white-storm.png" },
    @{ name = "Great White (Frost)";                file = "great-white-frost.png" },
    @{ name = "Great White (High Contrast Dark)";   file = "great-white-hc-dark.png" },
    @{ name = "Great White (High Contrast Light)";  file = "great-white-hc-light.png" }
)

Write-Host "`nScreenshot Capture Helper" -ForegroundColor Cyan
Write-Host "========================`n"
Write-Host "This will open a sample file in VS Code Insiders and cycle through each theme."
Write-Host "For each theme, use Win+Shift+S to capture and save to docs/screenshots/`n"

foreach ($theme in $themes) {
    Write-Host "Activating: $($theme.name)" -ForegroundColor Yellow
    Write-Host "  Save as:  docs/screenshots/$($theme.file)" -ForegroundColor Green
    Write-Host "  Press Enter when you've captured the screenshot..."
    Read-Host
}

Write-Host "`nDone! All screenshots captured." -ForegroundColor Cyan
