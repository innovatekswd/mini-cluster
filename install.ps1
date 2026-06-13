# MiniCluster One-Line Installer — Windows
# Run as Administrator
#
# Usage:
#   irm https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.ps1 | iex
#
# Or with options:
#   $env:MINICLUSTER_VERSION = "1.2.0"
#   $env:MINICLUSTER_PORT    = "2016"
#   irm https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.ps1 | iex

param(
    [string]$Version    = $env:MINICLUSTER_VERSION,
    [string]$InstallDir = "$env:ProgramFiles\MiniCluster",
    [string]$DataDir    = "$env:ProgramData\MiniCluster",
    [int]   $Port       = if ($env:MINICLUSTER_PORT) { [int]$env:MINICLUSTER_PORT } else { 2016 },
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$GithubRepo = "innovatekswd/mini-cluster"
$ServiceName = "MiniCluster"

function Test-Administrator {
    $user = [Security.Principal.WindowsIdentity]::GetCurrent()
    ([Security.Principal.WindowsPrincipal]$user).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Error "Run this script as Administrator (right-click PowerShell → Run as Administrator)"
    exit 1
}

# ── Uninstall ─────────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "Uninstalling MiniCluster..." -ForegroundColor Yellow
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq 'Running') { Stop-Service -Name $ServiceName -Force }
        sc.exe delete $ServiceName | Out-Null
        Write-Host "  Service removed"
    }
    $path = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    [Environment]::SetEnvironmentVariable('Path', ($path.Split(';') | Where-Object { $_ -ne $InstallDir }) -join ';', 'Machine')
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force; Write-Host "  Files removed: $InstallDir" }
    Write-Host "Done. Data preserved at: $DataDir" -ForegroundColor Green
    exit 0
}

# ── Resolve version ───────────────────────────────────────────────────────────
if (-not $Version) {
    Write-Host "  → Resolving latest version..."
    $release = Invoke-RestMethod "https://api.github.com/repos/$GithubRepo/releases/latest"
    $Version = $release.tag_name -replace '^v', ''
}

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        MiniCluster Installer             ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Version    : $Version"
Write-Host "  Install to : $InstallDir"
Write-Host "  Data dir   : $DataDir"
Write-Host "  Port       : $Port"
Write-Host ""

# ── Download ──────────────────────────────────────────────────────────────────
$zipName = "minicluster-${Version}-windows-amd64.zip"
$url = "https://raw.githubusercontent.com/$GithubRepo/main/releases/v${Version}/${zipName}"
$tmpDir = Join-Path $env:TEMP "minicluster-install-$([System.Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tmpDir | Out-Null

Write-Host "  → Downloading $zipName ..."
Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmpDir $zipName) -UseBasicParsing

Write-Host "  → Extracting ..."
Expand-Archive -Path (Join-Path $tmpDir $zipName) -DestinationPath $tmpDir -Force
$stage = Get-ChildItem $tmpDir -Directory | Select-Object -First 1

# ── Install ───────────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir    | Out-Null

Copy-Item "$($stage.FullName)\minicluster-api.exe" "$InstallDir\minicluster-api.exe" -Force
Write-Host "  → API installed: $InstallDir\minicluster-api.exe" -ForegroundColor Green

if (Test-Path "$($stage.FullName)\mc.exe") {
    Copy-Item "$($stage.FullName)\mc.exe" "$InstallDir\mc.exe" -Force
    Write-Host "  → CLI installed: $InstallDir\mc.exe" -ForegroundColor Green
}

$configDest = Join-Path $InstallDir "config.yaml"
if (-not (Test-Path $configDest) -and (Test-Path "$($stage.FullName)\config.yaml")) {
    (Get-Content "$($stage.FullName)\config.yaml") `
        -replace 'port: \d+', "port: $Port" `
        -replace 'data_dir: ""', "data_dir: `"$($DataDir.Replace('\','\\'))`"" |
        Set-Content $configDest
    Write-Host "  → Config written: $configDest" -ForegroundColor Green
}

# ── PATH ──────────────────────────────────────────────────────────────────────
$syspath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($syspath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$syspath;$InstallDir", 'Machine')
    Write-Host "  → Added to PATH: $InstallDir" -ForegroundColor Green
}

# ── Windows Service ───────────────────────────────────────────────────────────
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    sc.exe config $ServiceName binpath= "`"$InstallDir\minicluster-api.exe`"" | Out-Null
} else {
    sc.exe create $ServiceName binpath= "`"$InstallDir\minicluster-api.exe`"" start= auto obj= LocalSystem DisplayName= "MiniCluster API" | Out-Null
    sc.exe description $ServiceName "MiniCluster lightweight process management platform" | Out-Null
    Write-Host "  → Service registered: $ServiceName" -ForegroundColor Green
}
Start-Service -Name $ServiceName
Write-Host "  → Service started" -ForegroundColor Green

Remove-Item $tmpDir -Recurse -Force

Write-Host ""
Write-Host "  ═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ MiniCluster installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Open: http://localhost:$Port"
Write-Host ""
Write-Host "  CLI quickstart:"
Write-Host "    mc login --server http://localhost:$Port"
Write-Host ""
Write-Host "  Service commands:"
Write-Host "    Start-Service $ServiceName"
Write-Host "    Stop-Service  $ServiceName"
Write-Host "    Get-Service   $ServiceName"
Write-Host "  ═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
