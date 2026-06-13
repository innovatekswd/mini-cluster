# MiniCluster API — Windows Service Installer
# Run as Administrator
#
# Usage:
#   .\install.ps1                         # Install service
#   .\install.ps1 -Uninstall              # Remove service + files
#   .\install.ps1 -InstallDir "C:\mc"     # Custom install path
#   .\install.ps1 -Port 8080              # Custom port

param(
    [string]$InstallDir  = "$env:ProgramFiles\MiniCluster",
    [string]$DataDir     = "$env:ProgramData\MiniCluster",
    [int]   $Port        = 2016,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$ServiceName = 'MiniCluster'

function Test-Administrator {
    $user      = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($user)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# ── Uninstall ─────────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "Uninstalling MiniCluster API..." -ForegroundColor Yellow

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq 'Running') {
            Stop-Service -Name $ServiceName -Force
            Write-Host "  Service stopped"
        }
        sc.exe delete $ServiceName | Out-Null
        Write-Host "  Windows service removed"
    }

    $currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $newPath = ($currentPath.Split(';') | Where-Object { $_ -ne $InstallDir }) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')

    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "  Installation directory removed: $InstallDir"
    }

    Write-Host ""
    Write-Host "MiniCluster API uninstalled." -ForegroundColor Green
    Write-Host "Data directory preserved at: $DataDir"
    Write-Host "(Remove manually if no longer needed)"
    exit 0
}

# ── Install ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MiniCluster API Installer for Windows" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$binaryName = 'minicluster-api.exe'
$binarySrc  = Join-Path $scriptDir $binaryName

if (-not (Test-Path $binarySrc)) {
    Write-Error "$binaryName not found in $scriptDir. Please place it next to this installer."
    exit 1
}

# Create directories
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'registry') | Out-Null

# Copy binaries
Copy-Item -Path $binarySrc -Destination (Join-Path $InstallDir $binaryName) -Force
Write-Host "  Binary installed: $InstallDir\$binaryName" -ForegroundColor Green

$cliSrc = Join-Path $scriptDir 'mc.exe'
if (Test-Path $cliSrc) {
    Copy-Item -Path $cliSrc -Destination (Join-Path $InstallDir 'mc.exe') -Force
    Write-Host "  CLI installed:    $InstallDir\mc.exe" -ForegroundColor Green
}

# Write config if not already present
$configDest = Join-Path $InstallDir 'config.yaml'
if (-not (Test-Path $configDest)) {
    $configSrc = Join-Path $scriptDir 'config.yaml'
    if (Test-Path $configSrc) {
        # Patch the data_dir into the shipped config
        (Get-Content $configSrc) -replace 'data_dir: ""', "data_dir: `"$($DataDir.Replace('\','\\'))`"" |
            Set-Content $configDest
    }
    Write-Host "  Config written:  $configDest" -ForegroundColor Green
} else {
    Write-Host "  Config exists, skipping: $configDest"
}

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$currentPath;$InstallDir", 'Machine')
    Write-Host "  Added to system PATH: $InstallDir" -ForegroundColor Green
}

# Register Windows Service using sc.exe (no NSSM dependency)
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "  Service already registered; updating binary path..."
    sc.exe config $ServiceName binpath= "`"$InstallDir\$binaryName`"" | Out-Null
} else {
    $binPath = "`"$InstallDir\$binaryName`""
    sc.exe create $ServiceName `
        binpath= $binPath `
        start=   auto `
        obj=     LocalSystem `
        DisplayName= "MiniCluster API" | Out-Null

    sc.exe description $ServiceName "MiniCluster lightweight process management platform" | Out-Null
    Write-Host "  Windows service registered: $ServiceName" -ForegroundColor Green
}

# Set working directory via registry so the binary finds config.yaml
$regKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
Set-ItemProperty -Path $regKey -Name 'ImagePath' `
    -Value "`"$InstallDir\$binaryName`"" -ErrorAction SilentlyContinue

# Start the service
Start-Service -Name $ServiceName
Write-Host "  Service started" -ForegroundColor Green

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  MiniCluster API installed successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Install dir : $InstallDir"
Write-Host "  Data dir    : $DataDir"
Write-Host "  Config      : $configDest"
Write-Host "  Port        : $Port"
Write-Host ""
Write-Host "  API URL     : http://localhost:$Port"
Write-Host ""
Write-Host "  Service commands:"
Write-Host "    Start   : Start-Service $ServiceName"
Write-Host "    Stop    : Stop-Service  $ServiceName"
Write-Host "    Status  : Get-Service   $ServiceName"
Write-Host "    Logs    : Get-EventLog -LogName Application -Source $ServiceName -Newest 50"
Write-Host ""
Write-Host "  To uninstall:"
Write-Host "    .\install.ps1 -Uninstall"
Write-Host ""
