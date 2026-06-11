# MiniCluster Releases

Official release packages for [MiniCluster](https://github.com/innovatekswd/mini-cluster) — a lightweight process management and monitoring platform with a built-in web dashboard.

---

## Quick Install

### Linux (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
```

Custom port or version:

```bash
MINICLUSTER_PORT=9000 MINICLUSTER_VERSION=1.2.0 \
  curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
```

### Windows (PowerShell — run as Administrator)

```powershell
irm https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.ps1 | iex
```

Custom port or version:

```powershell
$env:MINICLUSTER_VERSION = "1.2.0"
$env:MINICLUSTER_PORT    = "9000"
irm https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.ps1 | iex
```

---

## Manual Download

Go to the [Releases](https://github.com/innovatekswd/mini-cluster/releases) page and download the package for your platform.

| Platform | Package | Contents |
|----------|---------|----------|
| Linux amd64 | `minicluster_<version>_amd64.deb` | API server + CLI (`mc`) — installs as systemd service |
| Linux amd64 | `minicluster-api-<version>-linux-amd64.tar.gz` | API server + CLI + config + systemd unit |
| Linux arm64 | `minicluster-api-<version>-linux-arm64.tar.gz` | API server + CLI + config + systemd unit |
| Windows x64 | `minicluster-<version>-windows-amd64.zip` | API server + CLI + PowerShell installer |

### Direct download URLs (replace `<version>`)

```
# Linux .deb
https://github.com/innovatekswd/mini-cluster/releases/download/v<version>/minicluster_<version>_amd64.deb

# Linux tarball (amd64)
https://github.com/innovatekswd/mini-cluster/releases/download/v<version>/minicluster-api-<version>-linux-amd64.tar.gz

# Linux tarball (arm64)
https://github.com/innovatekswd/mini-cluster/releases/download/v<version>/minicluster-api-<version>-linux-arm64.tar.gz

# Windows ZIP
https://github.com/innovatekswd/mini-cluster/releases/download/v<version>/minicluster-<version>-windows-amd64.zip
```

---

## Linux — Debian/Ubuntu (.deb)

```bash
# Download
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.0/minicluster_1.0.0_amd64.deb

# Install
sudo dpkg -i minicluster_1.0.0_amd64.deb

# Start
sudo systemctl start minicluster

# Check status
sudo systemctl status minicluster
```

After install:
- API server: `http://localhost:2016`
- Config file: `/etc/minicluster/config.yaml`
- Data directory: `/var/lib/minicluster`
- Logs: `journalctl -u minicluster -f`

**Change the port:**

```bash
sudo nano /etc/minicluster/config.yaml   # set port: 9000
sudo systemctl restart minicluster
```

Or via environment variable:

```bash
sudo systemctl edit minicluster
# Add under [Service]:
# Environment=MINICLUSTER_PORT=9000
```

---

## Linux — Tarball

```bash
tar -xzf minicluster-api-1.0.0-linux-amd64.tar.gz
cd minicluster-api-1.0.0-linux-amd64

# Run directly
chmod +x minicluster-api mc
./minicluster-api

# Or install system-wide
sudo cp minicluster-api /usr/local/bin/
sudo cp mc /usr/local/bin/
```

---

## Windows

**Option 1 — Installer (recommended)**

1. Download `minicluster-<version>-windows-amd64.zip`
2. Extract the ZIP
3. Right-click PowerShell → **Run as Administrator**
4. Run:

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

After install:
- API server: `http://localhost:2016`
- Config: `%ProgramFiles%\MiniCluster\config.yaml`
- Data: `%ProgramData%\MiniCluster`
- Both `minicluster-api.exe` and `mc.exe` are added to the system PATH

**Option 2 — Run directly (no install)**

```powershell
.\minicluster-api.exe
# Open http://localhost:2016
```

---

## Environment Variables

All config values can be overridden with environment variables using the prefix `MINICLUSTER_`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MINICLUSTER_PORT` | `2016` | HTTP port |
| `MINICLUSTER_DATA_DIR` | `/var/lib/minicluster` | Data directory |
| `MINICLUSTER_AUTHENTICATION_ENABLED` | `true` | Enable/disable auth |
| `MINICLUSTER_AUTHENTICATION_JWT_SECRET` | *(auto-generated)* | JWT signing secret |

Example:

```bash
MINICLUSTER_PORT=9000 MINICLUSTER_DATA_DIR=/srv/mc ./minicluster-api
```

---

## CLI — `mc`

The `mc` CLI is included in every package. It communicates with the API server.

### Global flags

| Flag | Description |
|------|-------------|
| `-s, --server` | API server URL (e.g. `http://myhost:2016`) |
| `-t, --token` | Auth token |
| `-o, --output` | Output format: `table`, `json`, `yaml`, `quiet` |
| `--debug` | Show raw API calls |
| `--timeout` | Request timeout (default `30s`) |
| `-y, --yes` | Skip confirmation prompts |
| `--context` | Named context from config file |

### Quickstart

```bash
# Point mc at your server and log in
mc login --server http://localhost:2016

# List apps and services
mc app list
mc service list

# Start / stop a service
mc service start my-api
mc service stop  my-api

# Stream logs
mc service logs my-api -f

# CLI config is saved at ~/.minicluster/config.yaml
# You can switch between servers using contexts:
mc config set-context staging --server http://staging-host:2016
mc config use-context staging
```

### Available commands

| Command | Description |
|---------|-------------|
| `mc app` | Manage applications |
| `mc service` | Manage services (start/stop/logs/deploy) |
| `mc container` | Manage container-type services |
| `mc file` | File manager |
| `mc package` | Build `.mcpkg` packages |
| `mc registry` | Package registry |
| `mc install` | Install a package |
| `mc login` / `mc logout` | Authentication |
| `mc config` | Manage CLI config and contexts |
| `mc server-config` | View server configuration |
| `mc version` | Print version info |

Run `mc [command] --help` for details on any command.

---

## Uninstall

**Linux (.deb):**

```bash
sudo systemctl stop minicluster
sudo dpkg -r minicluster
# Data is preserved at /var/lib/minicluster — remove manually if needed
```

**Windows:**

```powershell
# Run as Administrator
.\install.ps1 -Uninstall
```

---

## Support

- Issues: [github.com/innovatekswd/mini-cluster/issues](https://github.com/innovatekswd/mini-cluster/issues)
- Source: [github.com/innovatekswd/mini-cluster](https://github.com/innovatekswd/mini-cluster)
