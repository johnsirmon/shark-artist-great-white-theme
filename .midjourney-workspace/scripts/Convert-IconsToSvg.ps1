[CmdletBinding()]
param(
    [string]$IncomingDir = ".midjourney-workspace/incoming",
    [string]$OutputDir = ".midjourney-workspace/output-svg",
    [string]$LogPath = ".midjourney-workspace/logs/conversion-log.json",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-WorkspacePath {
    param([string]$PathValue)

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return $PathValue
    }

    $root = (Resolve-Path ".").Path
    return [System.IO.Path]::GetFullPath((Join-Path $root $PathValue))
}

function Ensure-Directory {
    param([string]$PathValue)

    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue | Out-Null
    }
}

function Normalize-SvgCanvas {
    param([string]$SvgPath)

    $raw = Get-Content -LiteralPath $SvgPath -Raw

    if ($raw -match 'viewBox\s*=\s*"[^"]*"') {
        $raw = [System.Text.RegularExpressions.Regex]::Replace($raw, 'viewBox\s*=\s*"[^"]*"', 'viewBox="0 0 16 16"', 1)
    }
    else {
        $raw = $raw -replace '<svg\b', '<svg viewBox="0 0 16 16"'
    }

    if ($raw -match 'width\s*=\s*"[^"]*"') {
        $raw = [System.Text.RegularExpressions.Regex]::Replace($raw, 'width\s*=\s*"[^"]*"', 'width="16"', 1)
    }
    else {
        $raw = $raw -replace '<svg\b', '<svg width="16"'
    }

    if ($raw -match 'height\s*=\s*"[^"]*"') {
        $raw = [System.Text.RegularExpressions.Regex]::Replace($raw, 'height\s*=\s*"[^"]*"', 'height="16"', 1)
    }
    else {
        $raw = $raw -replace '<svg\b', '<svg height="16"'
    }

    $raw = $raw -replace '\s+inkscape:[^=]+="[^"]*"', ''
    $raw = $raw -replace '\s+sodipodi:[^=]+="[^"]*"', ''

    Set-Content -LiteralPath $SvgPath -Value $raw -NoNewline
}

$incomingPath = Resolve-WorkspacePath -PathValue $IncomingDir
$outputPath = Resolve-WorkspacePath -PathValue $OutputDir
$logPath = Resolve-WorkspacePath -PathValue $LogPath

Ensure-Directory -PathValue $incomingPath
Ensure-Directory -PathValue $outputPath
Ensure-Directory -PathValue ([System.IO.Path]::GetDirectoryName($logPath))

$inkscape = Get-Command inkscape -ErrorAction SilentlyContinue
if (-not $inkscape -and -not $DryRun) {
    throw "Inkscape CLI not found. Install Inkscape and ensure 'inkscape' is available in PATH."
}

$inputFiles = Get-ChildItem -LiteralPath $incomingPath -File | Where-Object {
    $_.Extension -in @('.png', '.jpg', '.jpeg', '.webp')
}

$results = @()

foreach ($file in $inputFiles) {
    $targetSvg = Join-Path $outputPath ("{0}.svg" -f $file.BaseName)

    $entry = [ordered]@{
        source  = $file.FullName
        output  = $targetSvg
        status  = "pending"
        mode    = "trace"
        message = ""
    }

    if ($DryRun) {
        $entry.status = "dry-run"
        if (-not $inkscape) {
            $entry.message = "Conversion skipped due to -DryRun (Inkscape not required in dry-run)."
        }
        else {
            $entry.message = "Conversion skipped due to -DryRun"
        }
        $results += [pscustomobject]$entry
        continue
    }

    try {
        # Attempt vector trace flow first. If unavailable for this Inkscape build, fallback to export only.
        & $inkscape.Source $file.FullName --actions "select-all;SelectionTraceBitmap;export-filename:$targetSvg;export-do;file-close" | Out-Null

        if (-not (Test-Path -LiteralPath $targetSvg)) {
            throw "No SVG output produced by trace action."
        }

        Normalize-SvgCanvas -SvgPath $targetSvg
        $entry.status = "converted"
        $entry.message = "Trace conversion completed."
    }
    catch {
        try {
            & $inkscape.Source $file.FullName --export-type=svg --export-filename=$targetSvg | Out-Null

            if (Test-Path -LiteralPath $targetSvg) {
                Normalize-SvgCanvas -SvgPath $targetSvg
                $entry.status = "fallback-export"
                $entry.mode = "export"
                $entry.message = "Trace action failed; exported SVG fallback produced."
            }
            else {
                throw "Fallback export did not produce output."
            }
        }
        catch {
            $entry.status = "failed"
            $entry.message = $_.Exception.Message
        }
    }

    $results += [pscustomobject]$entry
}

$payload = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    incoming    = $incomingPath
    output      = $outputPath
    dryRun      = [bool]$DryRun
    resultCount = $results.Count
    results     = $results
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $logPath

$failed = @($results | Where-Object { $_.status -eq "failed" })
if ($failed.Count -gt 0) {
    throw "One or more conversions failed. See $logPath"
}

Write-Host "Conversion complete. Log: $logPath"
