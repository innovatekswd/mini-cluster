<p align="center">
  <h1 align="center">MiniCluster</h1>
  <p align="center">
    <strong>A lightweight self-hosted PaaS for managing apps, services, containers, and deployments from a single dashboard.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/innovatekswd/mini-cluster/releases/latest"><img src="https://img.shields.io/github/v/release/innovatekswd/mini-cluster?style=flat-square" alt="Latest Release"></a>
    <a href="https://github.com/innovatekswd/mini-cluster/blob/main/LICENSE"><img src="https://img.shields.io/github/license/innovatekswd/mini-cluster?style=flat-square" alt="License"></a>
  </p>
</p>

---

## Table of Contents

- [What is MiniCluster?](#what-is-minicluster)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Installation](#installation)
- [CLI Reference — `mc`](#cli-reference--mc)
  - [Installation & Setup](#cli-installation--setup)
  - [Authentication](#authentication)
  - [Global Flags](#global-flags)
  - [Configuration & Contexts](#configuration--contexts)
  - [Managing Apps](#managing-apps)
  - [Managing Services](#managing-services)
  - [Streaming Logs](#streaming-logs)
  - [Container Management](#container-management)
  - [File Management](#file-management)
  - [Package Registry](#package-registry)
  - [Package Building & Inspection](#package-building--inspection)
  - [Output Formats](#output-formats)
  - [Shell Completions](#shell-completions)
- [API Server Configuration](#api-server-configuration)
- [Updating](#updating)
- [License](#license)

---

## What is MiniCluster?

MiniCluster is a self-hosted platform-as-a-service (PaaS) designed for small teams and individual developers who want full control over their infrastructure without the complexity of Kubernetes. It provides a web-based operations cockpit and a powerful CLI (`mc`) to manage:

- **Applications** — Logical groups that organize related services
- **Services** — Process-managed executables with auto-restart, health checks, and log capture
- **Containers** — Docker container lifecycle management with image pulls, volume management, and exec
- **Deployments** — Zero-downtime blue-green deployments
- **Packages** — Heterogeneous multi-component packages (`.mcpkg`) with a built-in registry
- **Files** — Server-side file management with upload, download, and bulk operations
- **Cron Jobs** — Scheduled task execution with monitoring
- **Metrics & Monitoring** — Real-time CPU, memory, disk, and network metrics with alerting

---

## Features

- 🖥️ **Web Operations Cockpit** — Real-time dashboard with metrics, logs, terminal, and service management
- 🔌 **REST API** — Full-featured API for automation and CI/CD integration
- 🐳 **Docker Integration** — Pull images, manage containers, volumes, and networks
- 📦 **Package Registry** — Build, publish, and install multi-component packages
- 🔄 **Zero-Downtime Deployments** — Blue-green deployment strategy built-in
- 📊 **Real-Time Monitoring** — Live metrics streaming via SignalR
- 🔐 **Authentication** — JWT-based auth with role-based access control
- 🗓️ **Cron Scheduling** — Built-in job scheduler for recurring tasks
- 📁 **File Explorer** — Upload, download, and manage files on the server
- 🖥️ **Web Terminal** — Full terminal access from the browser
- 🔔 **Alerting** — Configurable alerts for health and performance thresholds
- ⚡ **Auto-Update** — In-app update notifications and one-click upgrades

---

## Quick Start

### One-Line Install (Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
```

### Manual Install

```bash
# Download the latest release
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster_1.0.16_amd64.deb

# Install
sudo dpkg -i minicluster_1.0.16_amd64.deb

# Start the service
sudo systemctl start minicluster
sudo systemctl enable minicluster

# Open the dashboard
# http://your-server:2016
```

### Connect with the CLI

```bash
# Authenticate
mc login --server http://your-server:2016

# List your apps
mc app list

# Stream logs from a service
mc service logs my-api -f
```

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Web UI     │────▶│   API Server     │────▶│  Service Manager │
│  (React SPA) │     │   (Go + Chi)     │     │  (Process/Container)│
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                      │                        │
       │              ┌───────┴────────┐               │
       │              │   SQLite DB    │               │
       │              │  (metrics,     │               │
       │              │   logs, auth)  │               │
       │              └────────────────┘               │
       │                      │                        │
       │              ┌───────┴────────┐        ┌──────┴──────┐
       └──────────────│   SignalR Hub  │        │   Docker    │
       (real-time)    │  (logs, metrics│        │   Engine    │
                      │   terminal)    │        └─────────────┘
                      └────────────────┘
```

| Component | Technology | Description |
|-----------|-----------|-------------|
| **API Server** | Go + Chi Router | Lightweight, fast HTTP server with embedded web UI |
| **Web UI** | React + Vite | Single-page application with real-time dashboards |
| **Database** | SQLite | Zero-config embedded database for metrics, logs, and config |
| **Real-Time** | SignalR | WebSocket-based hub for live logs, metrics, and terminal |
| **CLI** | Go + Cobra | Cross-platform command-line interface |
| **Container** | Docker API | Native Docker integration for container lifecycle |

---

## Installation

### Linux (Debian/Ubuntu)

```bash
# Using .deb package
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster_1.0.16_amd64.deb
sudo dpkg -i minicluster_1.0.16_amd64.deb

# Or using the tarball
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster-api-1.0.16-linux-amd64.tar.gz
tar xzf minicluster-api-1.0.16-linux-amd64.tar.gz
cd minicluster
sudo ./install.sh
```

### Linux (ARM64)

```bash
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster-api-1.0.16-linux-arm64.tar.gz
tar xzf minicluster-api-1.0.16-linux-arm64.tar.gz
```

### Windows

```powershell
# Download and extract
Invoke-WebRequest -Uri "https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster-1.0.16-windows-amd64.zip" -OutFile minicluster.zip
Expand-Archive minicluster.zip -DestinationPath .\minicluster

# Run the installer (as Administrator)
.\minicluster\install.ps1
```

### From Source

```bash
git clone https://github.com/innovatekswd/mini-cluster.git
cd minicluster

# Build API server + CLI
make build-go-linux

# Or build just the CLI
make build-cli
```

---

## CLI Reference — `mc`

The `mc` CLI is the primary tool for interacting with MiniCluster from the terminal, scripts, and CI/CD pipelines. It communicates with the MiniCluster API server over HTTP and supports multiple output formats for automation.

### CLI Installation & Setup

#### Linux (included with server package)

The CLI binary (`mc`) is bundled with the MiniCluster server installation. After installing the server, the CLI is available at `/usr/local/bin/mc`.

#### Standalone CLI Installation

```bash
# Download the CLI binary directly
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/mc-linux-amd64
chmod +x mc-linux-amd64
sudo mv mc-linux-amd64 /usr/local/bin/mc

# Verify installation
mc version
```

#### Windows

The CLI (`mc.exe`) is included in the Windows ZIP package. Add the extracted directory to your `PATH` or run the `install.ps1` script as Administrator.

```powershell
# Verify installation
mc.exe version
```

#### Build from Source

```bash
cd cli
go build -o mc ./cmd/mc
sudo mv mc /usr/local/bin/
```

### Authentication

Before using any command that communicates with the server, you must authenticate:

```bash
# Interactive login (prompts for username and password)
mc login

# Login with username (prompts for password securely)
mc login --username admin

# Login to a specific server
mc login --server http://192.168.1.100:2016

# Use an existing JWT token directly
mc login --token eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Check current authentication status
mc login --status

# Logout (remove stored credentials)
mc logout

# Logout from all servers
mc logout --all
```

**How it works:** Credentials are stored in `~/.minicluster/credentials.json`. The token is automatically attached to all subsequent API requests. Tokens have configurable expiration; when expired, re-run `mc login` to refresh.

### Global Flags

These flags are available on every command:

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--config` | `-c` | `~/.minicluster/config.yaml` | Path to configuration file |
| `--server` | `-s` | `http://localhost:2016` | MiniCluster API server URL |
| `--token` | `-t` | *(from credentials)* | Authentication token override |
| `--output` | `-o` | `table` | Output format: `table`, `json`, `yaml`, `quiet` |
| `--context` | | *(active context)* | Named context from config file |
| `--no-color` | | `false` | Disable colored output |
| `--verbose` | `-v` | `false` | Show additional detail in output |
| `--debug` | | `false` | Show raw HTTP API calls for troubleshooting |
| `--timeout` | | `30s` | Request timeout duration |
| `--yes` | `-y` | `false` | Skip confirmation prompts (non-interactive mode) |

**Environment variables:** You can also configure the CLI using environment variables:

| Variable | Equivalent Flag |
|----------|----------------|
| `MC_SERVER_URL` | `--server` |
| `MC_AUTH_TOKEN` | `--token` |
| `MC_OUTPUT_FORMAT` | `--output` |
| `MC_CONTEXT` | `--context` |

### Configuration & Contexts

MiniCluster supports **multi-server management** through named contexts. Each context stores a server URL and authentication token, making it easy to switch between production, staging, and development servers.

```bash
# View all configuration
mc config get

# Get a specific setting
mc config get server.url

# Set a configuration value
mc config set server.url http://localhost:2016
mc config set output.format json
mc config set defaults.confirm false

# List all available contexts
mc config contexts

# Switch to a different context (server)
mc config use-context production
mc config use-context staging

# Show the currently active context
mc config current-context
```

**Example config file** (`~/.minicluster/config.yaml`):

```yaml
context: production
contexts:
  production:
    server:
      url: https://prod.example.com:2016
    auth:
      token: eyJhbGciOi...
  staging:
    server:
      url: https://staging.example.com:2016
    auth:
      token: eyJhbGciOi...
  local:
    server:
      url: http://localhost:2016
    auth:
      token: local-dev-token
output:
  format: table
  no_color: false
defaults:
  wait: true
  confirm: true
```

### Managing Apps

Apps are logical groupings for related services. They help organize your infrastructure (e.g., "Backend", "Frontend", "Monitoring").

```bash
# List all apps with service statistics
mc app list
mc app list -o json

# Get detailed information about an app
mc app get my-app
mc app get "My App" -o json

# Create a new app
mc app create "Backend Services"
mc app create "Frontend" --description "Web applications" --icon "🌐" --color "#3b82f6"

# Delete an app (services become unassigned, not deleted)
mc app delete my-app
mc app delete my-app --yes    # skip confirmation prompt

# Clone an app with all its services
mc app clone my-app
```

**Output example** (`mc app list`):

```
NAME              SERVICES  RUNNING  STOPPED  CREATED
────────────────  ────────  ───────  ───────  ──────────────────
Backend Services  5         4        1        2026-01-15 10:30:00
Frontend          3         3        0        2026-01-16 14:22:00
Monitoring        2         2        0        2026-02-01 09:00:00
```

### Managing Services

Services are the core unit of MiniCluster. Each service represents a managed process or container with lifecycle control, auto-restart, health checks, and log capture.

```bash
# List all services with current status
mc service list
mc service list -o json

# Get detailed information about a service
mc service get my-api
mc service get "API Server" -o json

# Start a stopped service
mc service start my-api
mc service start "API Server"

# Stop a running service
mc service stop my-api
mc service stop "API Server"

# Restart a service (stop then start)
mc service restart my-api

# Get runtime status of all services
mc service status

# Get status of a specific service
mc service status my-api

# Clone a service with its full configuration
mc service clone my-api

# Delete a service (must be stopped first)
mc service delete my-api
mc service delete my-api --yes
```

**Services can be identified by name or ID** — both work interchangeably in all commands.

### Streaming Logs

View and stream real-time logs from any service:

```bash
# View the last 100 lines of logs
mc service logs my-api

# Follow/stream logs in real-time (like tail -f)
mc service logs my-api -f

# Show last N lines
mc service logs my-api --tail 500

# Combine with --no-color for piping to files
mc service logs my-api --tail 1000 --no-color > api-logs.txt
```

**Tips:**
- Use `-f` (follow) to stream logs live — press `Ctrl+C` to stop
- Use `--tail N` to control how many historical lines are shown before streaming begins
- Logs include both stdout and stderr from the managed process
- Logs are persisted in the server's SQLite database and survive service restarts

### Container Management

MiniCluster has deep Docker integration for managing container-type services, images, volumes, and networks.

#### Container Runtime & Info

```bash
# Show Docker runtime information (version, containers, images)
mc container runtime
```

#### Docker Images

```bash
# List local Docker images
mc container images list

# Pull an image from a registry
mc container images pull nginx:latest
mc container images pull postgres:16

# Remove a local image
mc container images remove nginx:latest
mc container images rm nginx:latest    # shorthand
```

#### Container Configuration for Services

Each service can have a container configuration that defines how it runs as a Docker container:

```bash
# View the container config for a service
mc container config get my-service

# Set container configuration
mc container config set my-service \
  --image nginx \
  --tag latest \
  --ports "8080:80,8443:443" \
  --volumes "/data:/usr/share/nginx/html:ro" \
  --network my-network \
  --memory 512 \
  --cpu 1.0 \
  --entrypoint "/docker-entrypoint.sh" \
  --command "nginx -g 'daemon off;'" \
  --user "nginx" \
  --workdir "/usr/share/nginx/html" \
  --privileged=false \
  --read-only=true \
  --remove-on-stop=true \
  --labels "app=web,env=production"

# Delete container config (service reverts to process mode)
mc container config delete my-service
mc container config rm my-service
```

**Container config flags:**

| Flag | Description |
|------|-------------|
| `--image` | Docker image name |
| `--tag` | Image tag (default: `latest`) |
| `--registry` | Private registry URL |
| `--pull-policy` | Pull policy: `always`, `missing`, `never` |
| `--ports` | Port mappings (comma-separated `host:container`) |
| `--volumes` | Volume mounts (comma-separated `host:container[:options]`) |
| `--network` | Docker network name |
| `--memory` | Memory limit in MB |
| `--cpu` | CPU limit (e.g., `1.5` for 1.5 cores) |
| `--entrypoint` | Container entrypoint override |
| `--command` | Container command override |
| `--user` | Run as user |
| `--workdir` | Working directory inside container |
| `--privileged` | Run in privileged mode |
| `--read-only` | Read-only root filesystem |
| `--remove-on-stop` | Remove container when service stops |
| `--labels` | Docker labels (comma-separated `key=value`) |

#### Container Stats & Exec

```bash
# Show CPU/memory/network stats for a container
mc container stats my-service

# Execute a command inside a running container
mc container exec my-service ls -la /app
mc container exec my-service cat /etc/nginx/nginx.conf
mc container exec my-service sh -c "echo hello"
```

#### Docker Volumes

```bash
# List all Docker volumes
mc container volumes list

# Create a named volume
mc container volumes create my-data
mc container volumes create my-data --driver local --label "backup=daily"

# Remove a volume
mc container volumes remove my-data
```

#### Docker Networks

```bash
# List all Docker networks
mc container networks list

# Create a network
mc container networks create my-network
mc container networks create my-network --driver bridge --subnet "172.20.0.0/16"

# Remove a network
mc container networks remove my-network
```

### File Management

Upload, download, and manage files on the MiniCluster server:

```bash
# List files in the root directory
mc file list

# List files in a specific folder
mc file list prod
mc file list backup/2026-01

# Upload a file
mc file upload ./config.json prod
mc file upload ~/data.csv backup/data

# Upload multiple files with a glob pattern
mc file upload-bulk "*.json" prod
mc file upload-bulk "./data/*.csv" backup/data

# Download a file
mc file download prod/config.json ./config.json
mc file download backup/data/data.csv ~/downloads/

# Download an entire folder (downloaded as zip and extracted)
mc file download prod/configs ./local-configs
mc file download backup/2026-01 ~/backups/january
```

**Notes:**
- File paths with spaces should be quoted: `mc file upload "./my file.json" prod`
- Folder downloads are automatically zipped server-side and extracted locally
- The `--no-progress` flag disables the upload/download progress bar for scripting

### Package Registry

MiniCluster includes a built-in package registry for publishing, discovering, and installing heterogeneous multi-component packages (`.mcpkg`).

#### Browsing & Searching

```bash
# List all packages in the registry
mc registry list

# Filter by name
mc registry list --name my-package

# Filter by tag
mc registry list --tag production

# Show all versions of a package
mc registry versions my-package

# Show details of a specific version
mc registry show my-package
mc registry show my-package@1.2.0

# Search packages by keyword
mc registry search "web server"
```

#### Publishing Packages

```bash
# Publish a directory (reads name/version from manifest.json)
mc registry push ./my-package-dir

# Publish with overrides
mc registry push ./my-package-dir \
  --name my-package \
  --version 1.0.0 \
  --description "My awesome package" \
  --author "Your Name" \
  --tags "web,api,server"

# Publish a pre-built .mcpkg file
mc registry push my-package-1.0.0.mcpkg \
  --name my-package \
  --version 1.0.0
```

**Directory structure for publishing:**

```
my-package-dir/
├── manifest.json        # Required: defines components and metadata
├── .mcignore           # Optional: patterns to exclude from package
├── frontend/
│   └── ...
├── backend/
│   └── ...
└── config/
    └── ...
```

#### Installing Packages

```bash
# Install the latest version
mc install my-package

# Install a specific version
mc install my-package@1.2.0

# List installed packages
mc registry installs

# Uninstall a package
mc registry uninstall <installation-id>
```

#### Managing Registry

```bash
# Delete a package version from the registry
mc registry delete my-package@1.0.0
mc registry delete my-package          # delete all versions
```

### Package Building & Inspection

Build and validate `.mcpkg` packages locally before publishing:

```bash
# Initialize a new package directory with a template manifest.json
mc package init
mc package init ./my-package

# Validate a package directory
mc package validate
mc package validate ./my-package

# Build a .mcpkg file from a directory
mc package build
mc package build ./my-package

# Push (build + publish in one step)
mc package push ./my-package

# Inspect a .mcpkg file — show components and required env vars
mc inspect my-package-1.0.0.mcpkg
mc inspect my-package@1.2.0          # inspect from registry
```

### Output Formats

All commands that produce output support multiple formats via the `--output` (`-o`) flag:

```bash
# Human-readable table (default)
mc app list
mc app list -o table

# JSON output — ideal for scripting and jq processing
mc app list -o json

# YAML output
mc app list -o yaml

# Quiet mode — only essential output (useful for CI/CD)
mc service start my-api -o quiet
```

**Scripting example:**

```bash
# Get all running service names
mc service list -o json | jq -r '.[] | select(.status == "Running") | .name'

# Stop all services in an app
mc app get "Backend" -o json | jq -r '.services[].name' | while read svc; do
  mc service stop "$svc" -y
done

# Check if a service is healthy
status=$(mc service status my-api -o json | jq -r '.health')
if [ "$status" = "healthy" ]; then
  echo "Service is healthy!"
fi
```

### Shell Completions

Generate auto-completion scripts for popular shells:

```bash
# Bash
mc completion bash > /etc/bash_completion.d/mc
# Or for current session:
source <(mc completion bash)

# Zsh
mc completion zsh > "${fpath[1]}/_mc"

# Fish
mc completion fish > ~/.config/fish/completions/mc.fish
```

After installing completions, you can tab-complete commands, flags, and in some cases service/app names.

---

## API Server Configuration

The API server is configured via `/etc/minicluster/config.yaml` (Linux) or `config.json` (Windows):

```yaml
# Server settings
port: 2016
host: "0.0.0.0"
dataDir: "/var/lib/minicluster"

# Authentication
auth:
  enabled: true
  jwtSecret: "your-secret-key"
  tokenExpiry: "24h"

# Logging
logging:
  level: "info"     # debug, info, warn, error
  maxAge: 7         # days to retain log files
  maxSize: 100      # max MB per log file

# Metrics collection
metrics:
  enabled: true
  interval: "10s"   # collection interval
  retention: "7d"   # how long to keep metrics
```

---

## Updating

### Automatic Update (from the Web UI)

MiniCluster checks GitHub for new releases and shows an update notification in the System panel. Click "Update" to download and apply the latest version automatically.

### Manual Update (Linux)

```bash
# Using the install script (installs latest)
curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash

# Or download a specific version
wget https://github.com/innovatekswd/mini-cluster/releases/download/v1.0.16/minicluster_1.0.16_amd64.deb
sudo dpkg -i minicluster_1.0.16_amd64.deb
sudo systemctl restart minicluster
```

### Manual Update (Windows)

Download the latest ZIP, extract, and run `install.ps1` as Administrator.

---

## License

MiniCluster is open-source software. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/innovatekswd">Innovatek</a></sub>
</p>
