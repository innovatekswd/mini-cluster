<div align="center">

# ⚡ MiniCluster

**Lightweight process management & monitoring with a built-in web dashboard**

[![Latest Release](https://img.shields.io/github/v/release/innovatekswd/mini-cluster?label=latest)](releases/)
[![License](https://img.shields.io/github/license/innovatekswd/mini-cluster)](https://github.com/innovatekswd/mini-cluster)

[Quick Start](#-quick-start) • [First Steps](#-first-steps) • [CLI Reference](#-cli--mc) • [Downloads](#-downloads) • [Troubleshooting](#-troubleshooting)

</div>

---

<details>
<summary><strong>📖 Table of Contents</strong></summary>

- [What is MiniCluster?](#-what-is-minicluster)
- [Quick Start](#-quick-start)
- [First Steps](#-first-steps)
- [Architecture](#️-architecture)
- [Downloads](#-downloads)
- [Installation Details](#-installation-details)
- [Configuration](#-configuration)
- [CLI Reference — mc](#-cli--mc)
- [Uninstall](#-uninstall)
- [Troubleshooting](#-troubleshooting)
- [Support](#-support)

</details>

---

## 🤔 What is MiniCluster?

MiniCluster is a self-hosted platform for managing and monitoring applications, services, and containers — all through a clean web dashboard or the `mc` CLI.

- 🖥️ **Web Dashboard** — manage apps, services, and containers from your browser
- ⚙️ **Process Manager** — auto-restart, log streaming, environment management
- 📦 **Package System** — build and deploy `.mcpkg` packages with one command
- 🔐 **Authentication** — JWT-based auth out of the box
- 🐧🪟 **Cross-Platform** — first-class support for Linux and Windows
- 🪶 **Lightweight** — single binary, minimal resource footprint

---

## 🚀 Quick Start

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
```

### Windows (PowerShell — run as Administrator)

```powershell
irm https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.ps1 | iex
```

> **That's it!** Open **http://localhost:2016** to access the dashboard.

### Custom Install Options

| Option | Linux | Windows |
|--------|-------|---------|
| Custom port | `MINICLUSTER_PORT=9000 curl ... \| bash` | `$env:MINICLUSTER_PORT="9000"; irm ... \| iex` |
| Custom version | `MINICLUSTER_VERSION=1.2.0 curl ... \| bash` | `$env:MINICLUSTER_VERSION="1.2.0"; irm ... \| iex` |
| Skip service setup | `MINICLUSTER_NO_SERVICE=1 curl ... \| bash` | — |

---

## 🎯 First Steps

Once installed, get up and running in under a minute:

```bash
# 1. Log in to your server
mc login --server http://localhost:2016

# 2. Verify the connection
mc version

# 3. Create your first app
mc app create my-api --type web --dir /path/to/app

# 4. Start it
mc service start my-api

# 5. Watch the logs
mc service logs my-api -f

# 6. Check all running services
mc service list
```

> 💡 The CLI config is saved at `~/.minicluster/config.yaml`. Use **contexts** to manage multiple servers — see [CLI Contexts](#working-with-multiple-servers-contexts) below.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│               MiniCluster Server                 │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │   Web UI     │     │   Process Manager    │  │
│  │  (Dashboard) │     │  (apps / services /  │  │
│  │              │     │   containers)        │  │
│  └──────┬───────┘     └──────────┬───────────┘  │
│         └────────────┬───────────┘              │
│                REST API (:2016)                 │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
     ┌────┴────┐              ┌─────┴─────┐
     │  Web    │              │  mc CLI   │
     │ Browser │              │ (terminal) │
     └─────────┘              └───────────┘
```

---

## 📦 Downloads

All release packages are hosted in the [`releases/`](releases/) directory of this repository.

| Platform | Package | Contents |
|----------|---------|----------|
| 🐧 Linux (deb) | `minicluster_<version>_amd64.deb` | API server + CLI — installs as systemd service |
| 🐧 Linux (tar) amd64 | `minicluster-api-<version>-linux-amd64.tar.gz` | API server + CLI + config + systemd unit |
| 🐧 Linux (tar) arm64 | `minicluster-api-<version>-linux-arm64.tar.gz` | API server + CLI + config + systemd unit |
| 🪟 Windows | `minicluster-<version>-windows-amd64.zip` | API server + CLI + PowerShell installer |

> 📂 **Browse all versions** in the [`releases/`](releases/) directory.

### Direct Download URLs

Replace `<version>` with any release number (e.g. `1.0.12`):

```
# Linux .deb
https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/releases/v<version>/minicluster_<version>_amd64.deb

# Linux tarball (amd64)
https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/releases/v<version>/minicluster-api-<version>-linux-amd64.tar.gz

# Linux tarball (arm64)
https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/releases/v<version>/minicluster-api-<version>-linux-arm64.tar.gz

# Windows ZIP
https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/releases/v<version>/minicluster-<version>-windows-amd64.zip
```

---

## 🔧 Installation Details

### Linux — Debian/Ubuntu (.deb)

```bash
# Download & install
wget https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/releases/v1.0.12/minicluster_1.0.12_amd64.deb
sudo dpkg -i minicluster_1.0.12_amd64.deb

# Start & check
sudo systemctl start minicluster
sudo systemctl status minicluster
```

**After install:**

| Item | Path / URL |
|------|------------|
| Dashboard | http://localhost:2016 |
| Config file | `/etc/minicluster/config.yaml` |
| Data directory | `/var/lib/minicluster` |
| Logs | `journalctl -u minicluster -f` |

### Linux — Tarball (manual)

```bash
tar -xzf minicluster-api-1.0.12-linux-amd64.tar.gz
cd minicluster-api-1.0.12-linux-amd64

# Run directly
chmod +x minicluster-api mc
./minicluster-api

# Or install system-wide
sudo cp minicluster-api mc /usr/local/bin/
```

### Windows

**Option 1 — Installer (recommended)**

1. Download `minicluster-<version>-windows-amd64.zip`
2. Extract the ZIP
3. Right-click PowerShell → **Run as Administrator**

```powershell
cd minicluster-<version>-windows-amd64
.\install.ps1
```

Installer parameters:

```powershell
.\install.ps1 -Port 9000                        # custom port
.\install.ps1 -InstallDir "C:\mc"               # custom install path
.\install.ps1 -DataDir "D:\mc-data"             # custom data directory
.\install.ps1 -Uninstall                        # remove
```

**After install:**

| Item | Path / URL |
|------|------------|
| Dashboard | http://localhost:2016 |
| Config | `%ProgramFiles%\MiniCluster\config.yaml` |
| Data | `%ProgramData%\MiniCluster` |
| Binaries | Added to system `PATH` |

**Option 2 — Run directly (no install)**

```powershell
.\minicluster-api.exe
# Open http://localhost:2016
```

---

## ⚙️ Configuration

### Environment Variables

All config values can be overridden with environment variables using the `MINICLUSTER_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `MINICLUSTER_PORT` | `2016` | HTTP port for the API and dashboard |
| `MINICLUSTER_DATA_DIR` | `/var/lib/minicluster` | Data directory for persistent storage |
| `MINICLUSTER_AUTHENTICATION_ENABLED` | `true` | Enable/disable authentication |
| `MINICLUSTER_AUTHENTICATION_JWT_SECRET` | *(auto-generated)* | JWT signing secret |

**Example:**

```bash
MINICLUSTER_PORT=9000 MINICLUSTER_DATA_DIR=/srv/mc ./minicluster-api
```

### Changing the Port (Linux .deb)

```bash
# Option 1: Edit config file
sudo nano /etc/minicluster/config.yaml   # set port: 9000
sudo systemctl restart minicluster

# Option 2: Environment variable
sudo systemctl edit minicluster
# Add under [Service]:
# Environment=MINICLUSTER_PORT=9000
sudo systemctl restart minicluster
```

---

## ⚡ CLI — `mc`

The `mc` command-line tool is your primary interface to MiniCluster. It's included in every package and communicates with the API server.

### Setup

```bash
# Connect to your server and authenticate
mc login --server http://localhost:2016

# Verify the connection
mc version
```

### Working with Multiple Servers (Contexts)

Manage connections to multiple MiniCluster servers using named contexts:

```bash
# Add a staging server
mc config set-context staging --server http://staging-host:2016

# Switch to staging
mc config use-context staging

# List all contexts
mc config get-contexts

# Switch back to default
mc config use-context default
```

CLI config is saved at `~/.minicluster/config.yaml`.

### App Management

```bash
mc app list                          # list all applications
mc app create my-api --type web      # create a new web app
mc app info my-api                   # show app details
mc app update my-api --dir /new/path # update app settings
mc app delete my-api                 # remove an application
```

### Service Control

```bash
mc service list                      # list all services
mc service start my-api              # start a service
mc service stop my-api               # stop a service
mc service restart my-api            # restart a service
mc service status my-api             # detailed status info
mc service logs my-api -f            # stream logs live
mc service logs my-api --tail 100    # last 100 lines
```

### Container Management

```bash
mc container list                    # list all containers
mc container start my-container      # start a container
mc container stop my-container       # stop a container
mc container restart my-container    # restart a container
mc container logs my-container -f    # stream container logs
```

### File Manager

```bash
mc file ls /path/on/server           # list remote files
mc file cat /path/to/file            # view file contents
mc file cp local.txt /remote/path    # upload a file
mc file cp /remote/file.txt ./       # download a file
```

### Packages & Deployment

```bash
mc package build ./my-app            # build .mcpkg from a directory
mc package install my-app.mcpkg      # install a local package
mc registry list                     # browse registry packages
mc registry search nginx             # search the registry
mc install nginx --from registry     # install from registry
```

### Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --server` | API server URL (e.g. `http://myhost:2016`) | current context |
| `-t, --token` | Authentication token | current context |
| `-o, --output` | Output format: `table`, `json`, `yaml`, `quiet` | `table` |
| `--debug` | Show raw API requests for debugging | off |
| `--timeout` | Request timeout duration | `30s` |
| `-y, --yes` | Skip all confirmation prompts | off |
| `--context` | Use a named context from config | `default` |

### Command Reference

| Command | Description |
|---------|-------------|
| `mc app` | Manage applications |
| `mc service` | Manage services (start/stop/logs/deploy) |
| `mc container` | Manage container-type services |
| `mc file` | Remote file manager |
| `mc package` | Build `.mcpkg` deployment packages |
| `mc registry` | Browse and search the package registry |
| `mc install` | Install a package from registry or file |
| `mc login` / `mc logout` | Authentication |
| `mc config` | Manage CLI configuration and contexts |
| `mc server-config` | View server configuration |
| `mc version` | Print client and server version info |

> 💡 Run `mc <command> --help` for full details on any command.

---

## 🗑️ Uninstall

### Linux (.deb)

```bash
sudo systemctl stop minicluster
sudo dpkg -r minicluster
# Data is preserved at /var/lib/minicluster — remove manually if needed
sudo rm -rf /var/lib/minicluster
```

### Windows

```powershell
# Run as Administrator
.\install.ps1 -Uninstall
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Connection refused` on :2016 | Check service status: `sudo systemctl status minicluster` |
| Port already in use | Change port in config or set `MINICLUSTER_PORT` env var |
| `mc: command not found` | Ensure install directory is in `$PATH` |
| Authentication errors | Re-login: `mc login --server http://localhost:2016` |
| Permission denied on logs | Use `sudo journalctl -u minicluster -f` |
| Windows: script not allowed | Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` first |

### Viewing Logs

```bash
# Linux (systemd)
sudo journalctl -u minicluster -f

# Linux (tarball — when running directly)
./minicluster-api 2>&1 | tee minicluster.log

# Windows (PowerShell)
Get-Content -Tail 50 -Wait "$env:ProgramData\MiniCluster\logs\*.log"
```

---

## 💬 Support

- **Issues:** [github.com/innovatekswd/mini-cluster/issues](https://github.com/innovatekswd/mini-cluster/issues)
- **Source:** [github.com/innovatekswd/mini-cluster](https://github.com/innovatekswd/mini-cluster)
- **Releases:** Browse all versions in [`releases/`](releases/)
