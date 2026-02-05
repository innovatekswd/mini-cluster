# MiniCluster CLI Installer for Windows
# Usage: Run this script as Administrator

param(
    [string]$InstallDir = "$env:ProgramFiles\MiniCluster",
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

function Test-Administrator {
    $user = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($user)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Add-ToPath {
    param([string]$Path)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$Path*") {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$Path",
            "Machine"
        )
        Write-Host "Added $Path to system PATH" -ForegroundColor Green
    }
}

function Remove-FromPath {
    param([string]$Path)
    
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $newPath = ($currentPath.Split(';') | Where-Object { $_ -ne $Path }) -join ';'
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    Write-Host "Removed $Path from system PATH" -ForegroundColor Green
}

if (-not (Test-Administrator)) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

if ($Uninstall) {
    Write-Host "Uninstalling MiniCluster CLI..." -ForegroundColor Yellow
    
    if (Test-Path $InstallDir) {
        Remove-FromPath $InstallDir
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "MiniCluster CLI has been uninstalled" -ForegroundColor Green
    } else {
        Write-Host "MiniCluster CLI is not installed" -ForegroundColor Yellow
    }
    exit 0
}

Write-Host "Installing MiniCluster CLI..." -ForegroundColor Cyan

# Create installation directory
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Copy binary
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binarySource = Join-Path $scriptDir "mc.exe"

if (-not (Test-Path $binarySource)) {
    Write-Error "mc.exe not found in $scriptDir"
    Write-Host "Please ensure mc.exe is in the same directory as this installer"
    exit 1
}

Copy-Item -Path $binarySource -Destination (Join-Path $InstallDir "mc.exe") -Force

# Add to PATH
Add-ToPath $InstallDir

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "MiniCluster CLI installed successfully!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installation directory: $InstallDir"
Write-Host ""
Write-Host "IMPORTANT: Close and reopen your terminal/PowerShell for PATH changes to take effect"
Write-Host ""
Write-Host "Get started with:"
Write-Host "  mc --help"
Write-Host "  mc version"
Write-Host "  mc --server http://localhost:5147 login"
Write-Host ""
