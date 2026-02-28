[CmdletBinding()]
param(
    [string]$SourceDir = ".midjourney-workspace/output-svg",
    [string]$RepoIconsDir = "icons",
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

$sourcePath = Resolve-WorkspacePath -PathValue $SourceDir
$iconsPath = Resolve-WorkspacePath -PathValue $RepoIconsDir

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Source directory not found: $sourcePath"
}

if (-not (Test-Path -LiteralPath $iconsPath)) {
    throw "Repo icons directory not found: $iconsPath"
}

$requiredFiles = @(
    "agents-md.svg",
    "claude-md.svg",
    "gemini-md.svg",
    "copilot-folder.svg",
    "copilot-instructions.svg",
    "learnings-folder.svg",
    "plan-md.svg"
)

$missing = @()
foreach ($name in $requiredFiles) {
    $candidate = Join-Path $sourcePath $name
    if (-not (Test-Path -LiteralPath $candidate)) {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    $message = "Missing required SVG(s) in source: {0}" -f ($missing -join ", ")
    throw $message
}

foreach ($name in $requiredFiles) {
    $source = Join-Path $sourcePath $name
    $dest = Join-Path $iconsPath $name

    if ($DryRun) {
        Write-Host "[DryRun] Copy $source -> $dest"
        continue
    }

    Copy-Item -LiteralPath $source -Destination $dest -Force
    Write-Host "Copied $name"
}

Write-Host "Sync complete."
