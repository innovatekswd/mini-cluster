$ErrorActionPreference = 'Stop'

$installDir = Join-Path $env:ProgramFiles 'MiniCluster'

# Remove from PATH
Uninstall-ChocolateyPath -PathToUninstall $installDir -PathType 'Machine'

# Remove installation directory
if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host "MiniCluster CLI has been uninstalled"
}
