[CmdletBinding()]
param(
    [string]$IncomingDir = ".midjourney-workspace/incoming",
    [string]$OutputDir = ".midjourney-workspace/output-svg",
    [string]$LogPath = ".midjourney-workspace/logs/conversion-log.json",
    [string]$VtracerBin = ".midjourney-workspace/bin/vtracer.exe",
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
$vtracerPath = Resolve-WorkspacePath -PathValue $VtracerBin

Ensure-Directory -PathValue $incomingPath
Ensure-Directory -PathValue $outputPath
Ensure-Directory -PathValue ([System.IO.Path]::GetDirectoryName($logPath))

if (-not $DryRun -and -not (Test-Path -LiteralPath $vtracerPath)) {
    throw "vtracer not found at '$vtracerPath'. Download from https://github.com/visioncortex/vtracer/releases"
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
        mode    = "vtracer"
        message = ""
    }

    if ($DryRun) {
        $entry.status = "dry-run"
        $entry.message = "Conversion skipped due to -DryRun"
        $results += [pscustomobject]$entry
        continue
    }

    try {
        & $vtracerPath --input $file.FullName --output $targetSvg `
            --colormode color `
            --hierarchical stacked `
            --mode polygon `
            --filter_speckle 4 `
            --color_precision 6 `
            --gradient_step 16 | Out-Null

        if (-not (Test-Path -LiteralPath $targetSvg)) {
            throw "No SVG output produced by vtracer."
        }

        Normalize-SvgCanvas -SvgPath $targetSvg
        $entry.status = "converted"
        $entry.message = "vtracer conversion completed."
    }
    catch {
        $entry.status = "failed"
        $entry.message = $_.Exception.Message
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
