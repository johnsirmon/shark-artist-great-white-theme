[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipSync,
    [string]$IncomingDir = ".midjourney-workspace/incoming",
    [string]$OutputDir = ".midjourney-workspace/output-svg"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$convertScript = Join-Path $scriptRoot "Convert-IconsToSvg.ps1"
$validateScript = Join-Path $scriptRoot "Validate-SvgIcons.ps1"
$syncScript = Join-Path $scriptRoot "Sync-IconsToRepo.ps1"

if (-not (Test-Path -LiteralPath $convertScript)) { throw "Missing script: $convertScript" }
if (-not (Test-Path -LiteralPath $validateScript)) { throw "Missing script: $validateScript" }
if (-not (Test-Path -LiteralPath $syncScript)) { throw "Missing script: $syncScript" }

Write-Host "[1/3] Converting source images to SVG..."
& $convertScript -IncomingDir $IncomingDir -OutputDir $OutputDir -DryRun:$DryRun

Write-Host "[2/3] Validating SVG outputs..."
& $validateScript -SvgDir $OutputDir -FailOnError

if ($SkipSync) {
    Write-Host "[3/3] Sync skipped by request."
} else {
    Write-Host "[3/3] Syncing validated SVGs into repo icons/..."
    & $syncScript -SourceDir $OutputDir -DryRun:$DryRun
}

Write-Host "Pipeline completed successfully."
