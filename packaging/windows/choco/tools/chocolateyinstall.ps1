$ErrorActionPreference = 'Stop'

$packageName = 'minicluster-cli'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$installDir = Join-Path $env:ProgramFiles 'MiniCluster'
$binaryPath = Join-Path $installDir 'mc.exe'

# Create installation directory
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Copy binary to installation directory
$exePath = Join-Path $toolsDir 'mc.exe'
Copy-Item -Path $exePath -Destination $binaryPath -Force

# Add to PATH
Install-ChocolateyPath -PathToInstall $installDir -PathType 'Machine'

Write-Host "MiniCluster CLI installed to: $installDir"
Write-Host "The 'mc' command is now available in your PATH"
Write-Host ""
Write-Host "Get started with:"
Write-Host "  mc --help"
Write-Host "  mc version"
