# MiniCluster API (.NET) — Windows Service Installer
# Run as Administrator
#
# Usage:
#   .\install.ps1                         # Install service
#   .\install.ps1 -Uninstall              # Remove service + files
#   .\install.ps1 -InstallDir "C:\mc"     # Custom install path
#   .\install.ps1 -Port 5147              # Custom port

param(
    [string]$InstallDir  = "$env:ProgramFiles\MiniCluster",
    [string]$DataDir     = "$env:ProgramData\MiniCluster",
    [int]   $Port        = 5147,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$ServiceName  = 'MiniCluster'
$BinaryName   = 'minicluster.exe'

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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binarySrc  = Join-Path $scriptDir $BinaryName

if (-not (Test-Path $binarySrc)) {
    Write-Error "$BinaryName not found in $scriptDir. Please place it next to this installer."
    exit 1
}

# Create directories
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'data') | Out-Null

# Copy binary
Copy-Item -Path $binarySrc -Destination (Join-Path $InstallDir $BinaryName) -Force
Write-Host "  Binary installed: $InstallDir\$BinaryName" -ForegroundColor Green

# Copy wwwroot (React UI — required alongside the exe)
$wwwrootSrc = Join-Path $scriptDir 'wwwroot'
if (Test-Path $wwwrootSrc) {
    $wwwrootDest = Join-Path $InstallDir 'wwwroot'
    if (Test-Path $wwwrootDest) { Remove-Item -Path $wwwrootDest -Recurse -Force }
    Copy-Item -Path $wwwrootSrc -Destination $wwwrootDest -Recurse -Force
    Write-Host "  UI installed:    $wwwrootDest" -ForegroundColor Green
} else {
    Write-Host "  WARNING: wwwroot not found next to installer — UI will not be served" -ForegroundColor Yellow
}

# Write appsettings.json if not already present
$configDest = Join-Path $InstallDir 'appsettings.json'
if (-not (Test-Path $configDest)) {
    $configSrc = Join-Path $scriptDir 'config.json'
    if (Test-Path $configSrc) {
        $dbPath  = (Join-Path $DataDir 'data\minicluster.db').Replace('\', '\\')
        $logPath = (Join-Path $DataDir 'data\logs.db').Replace('\', '\\')
        (Get-Content $configSrc -Raw) `
            -replace '__DB_PATH__',  $dbPath `
            -replace '__LOG_PATH__', $logPath `
            -replace '__PORT__',     $Port |
            Set-Content $configDest -Encoding UTF8
        Write-Host "  Config written:  $configDest" -ForegroundColor Green
    }
} else {
    Write-Host "  Config exists, skipping: $configDest"
}

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$currentPath;$InstallDir", 'Machine')
    Write-Host "  Added to system PATH: $InstallDir" -ForegroundColor Green
}

# Register Windows Service
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "  Service already registered; updating binary path..."
    sc.exe config $ServiceName binpath= "`"$InstallDir\$BinaryName`"" | Out-Null
} else {
    sc.exe create $ServiceName `
        binpath= "`"$InstallDir\$BinaryName`"" `
        start=   auto `
        obj=     LocalSystem `
        DisplayName= "MiniCluster API" | Out-Null

    sc.exe description $ServiceName "MiniCluster lightweight process management platform" | Out-Null
    Write-Host "  Windows service registered: $ServiceName" -ForegroundColor Green
}

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
