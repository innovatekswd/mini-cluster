# MiniCluster CLI Packages

This document describes the available MiniCluster CLI packages and installation methods.

## Package Overview

The MiniCluster CLI (`mc`) is packaged for multiple platforms:

- **Linux Debian/Ubuntu**: `.deb` package
- **Linux Snap**: Universal Linux package (coming soon)
- **Windows**: ZIP archive with PowerShell installer
- **Windows Chocolatey**: `.nupkg` package (coming soon)

## Version Information

Current version: **1.0.11**

## Installation

### Debian/Ubuntu (`.deb`)

```bash
# Download and install
sudo dpkg -i minicluster-cli_1.0.11_amd64.deb

# Or use apt
sudo apt install ./minicluster-cli_1.0.11_amd64.deb

# Verify installation
mc version
```

The `.deb` package installs:
- Binary: `/usr/bin/mc`
- Shell completions: `/usr/share/bash-completion/completions/mc`

### Windows (ZIP)

#### Option 1: PowerShell Installer (Recommended)

```powershell
# Extract the ZIP file
# Right-click PowerShell and "Run as Administrator"
cd path\to\extracted\folder
.\install.ps1
```

This installer:
- Installs `mc.exe` to `C:\Program Files\MiniCluster`
- Adds installation directory to system PATH
- Makes `mc` command globally available

#### Option 2: Manual Installation

1. Extract `minicluster-cli-1.0.11-windows-amd64.zip`
2. Copy `mc.exe` to a directory in your PATH
3. Or add the extracted directory to your PATH

To uninstall:
```powershell
.\install.ps1 -Uninstall
```

### Windows (Chocolatey)

```powershell
# Coming soon
choco install minicluster-cli
```

### Snap (Linux)

```bash
# Coming soon
sudo snap install minicluster-cli
```

## Usage

After installation, the `mc` command is available globally:

```bash
# Show version
mc version

# Get help
mc --help

# Login to MiniCluster API server
mc --server http://localhost:5147 login

# List services
mc service list

# View service logs
mc service logs my-service

# Start a service
mc service start my-service
```

## Configuration

### Server URL

Specify the MiniCluster API server URL:

```bash
# Via command flag
mc --server http://api.example.com:5147 service list

# Via environment variable
export MC_SERVER_URL=http://api.example.com:5147
mc service list

# Via config file
mc config set server http://api.example.com:5147
```

### Authentication

```bash
# Interactive login
mc login

# Via environment variable
export MC_AUTH_TOKEN=your-jwt-token
mc service list

# Via command flag
mc --token your-jwt-token service list
```

## Package Details

### Debian Package

- **Size**: ~2.7 MB
- **Architecture**: amd64
- **Dependencies**: None (static binary)
- **Installs to**: `/usr/bin/mc`

### Windows Package

- **Size**: ~3.3 MB (ZIP)
- **Architecture**: amd64
- **Binary**: `mc.exe` (static, no runtime dependencies)
- **Includes**: PowerShell installer scripts

## Building from Source

To build all CLI packages:

```bash
cd /path/to/mini-cluster
./packaging/scripts/build-all-cli.sh
```

Individual packages:

```bash
# Debian package
./packaging/scripts/build-cli-deb.sh

# Windows package
./packaging/scripts/build-cli-windows.sh

# Snap package
./packaging/scripts/build-cli-snap.sh
```

## Package Contents

### Files Included

**Debian:**
- `/usr/bin/mc` - CLI binary
- `/usr/share/bash-completion/completions/mc` - Bash completion
- `/usr/share/zsh/site-functions/_mc` - Zsh completion (optional)
- `/usr/share/fish/vendor_completions.d/mc.fish` - Fish completion (optional)

**Windows:**
- `mc.exe` - CLI binary
- `install.ps1` - PowerShell installer
- `README.txt` - Installation instructions

## System Requirements

### Linux
- Kernel 3.2+ (x86_64)
- No additional dependencies

### Windows
- Windows 10 or later (64-bit)
- PowerShell 5.0+ (for installer)
- No additional runtime dependencies

## Shell Completions

After installing the Debian package, shell completions are automatically available for bash.

For manual installations, generate completions:

```bash
# Bash
mc completion bash > ~/.bash_completion.d/mc

# Zsh
mc completion zsh > ~/.zsh/completion/_mc

# Fish
mc completion fish > ~/.config/fish/completions/mc.fish

# PowerShell
mc completion powershell > mc.ps1
```

## Upgrades

### Debian/Ubuntu
```bash
sudo apt install ./minicluster-cli_<new-version>_amd64.deb
```

### Windows
Run the installer for the new version. It will replace the existing installation.

## Uninstallation

### Debian/Ubuntu
```bash
sudo apt remove minicluster-cli
```

### Windows
```powershell
# Using installer
.\install.ps1 -Uninstall

# Or manually
Remove-Item "C:\Program Files\MiniCluster" -Recurse
```

## Support

For issues, questions, or feature requests:
- Repository: https://dev.azure.com/innovatekswd/InnovatekTools
- Contact: support@innovatek.com

## License

Copyright © 2026 Innovatek. All rights reserved.
This software is proprietary and confidential.
