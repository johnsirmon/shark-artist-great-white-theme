[CmdletBinding()]
param(
    [string]$SvgDir = ".midjourney-workspace/output-svg",
    [string]$LogPath = ".midjourney-workspace/logs/validation-log.json",
    [switch]$FailOnError
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $PSBoundParameters.ContainsKey("FailOnError")) {
    $FailOnError = $true
}

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

$svgPath = Resolve-WorkspacePath -PathValue $SvgDir
$logPath = Resolve-WorkspacePath -PathValue $LogPath
Ensure-Directory -PathValue ([System.IO.Path]::GetDirectoryName($logPath))
Ensure-Directory -PathValue $svgPath

$files = Get-ChildItem -LiteralPath $svgPath -Filter *.svg -File
$results = @()

foreach ($file in $files) {
    $raw = Get-Content -LiteralPath $file.FullName -Raw
    $issues = @()

    try {
        [xml]$xml = $raw
    }
    catch {
        $issues += "Invalid XML"
        $results += [pscustomobject]@{
            file   = $file.FullName
            valid  = $false
            issues = $issues
        }
        continue
    }

    $svgNode = $xml.DocumentElement
    if (-not $svgNode -or $svgNode.Name -ne "svg") {
        $issues += "Missing <svg> root"
    }

    $viewBox = $svgNode.GetAttribute("viewBox")
    if ($viewBox -ne "0 0 16 16") {
        $issues += "viewBox must be '0 0 16 16'"
    }

    $width = $svgNode.GetAttribute("width")
    $height = $svgNode.GetAttribute("height")
    if ($width -ne "16") {
        $issues += "width must be '16'"
    }

    if ($height -ne "16") {
        $issues += "height must be '16'"
    }

    $vectorNodeCount = @(
        $xml.GetElementsByTagName("path").Count,
        $xml.GetElementsByTagName("circle").Count,
        $xml.GetElementsByTagName("rect").Count,
        $xml.GetElementsByTagName("polygon").Count,
        $xml.GetElementsByTagName("ellipse").Count,
        $xml.GetElementsByTagName("line").Count,
        $xml.GetElementsByTagName("polyline").Count
    ) | Measure-Object -Sum | Select-Object -ExpandProperty Sum

    if ($vectorNodeCount -lt 1) {
        $issues += "No vector drawing nodes found"
    }

    $results += [pscustomobject]@{
        file   = $file.FullName
        valid  = ($issues.Count -eq 0)
        issues = $issues
    }
}

$payload = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    svgDir      = $svgPath
    resultCount = $results.Count
    results     = $results
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $logPath

$invalid = @($results | Where-Object { -not $_.valid })
if ($FailOnError -and $invalid.Count -gt 0) {
    throw "Validation failed for $($invalid.Count) file(s). See $logPath"
}

Write-Host "Validation complete. Log: $logPath"
