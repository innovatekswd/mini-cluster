# MiniCluster CLI Specification

## Overview

The MiniCluster CLI (`minicluster` or `mc`) is a command-line interface for managing applications, services, and deployments in a MiniCluster environment. It's designed for DevOps automation, CI/CD integration, and zero-downtime deployments.

## Design Principles

1. **DevOps-First**: Designed for automation with predictable exit codes, JSON output, and scriptable commands
2. **Zero-Downtime**: Built-in support for blue-green deployments and rolling updates
3. **Idempotent Operations**: Commands can be safely re-run without side effects
4. **Progressive Disclosure**: Simple commands for basic use, advanced flags for power users
5. **Fail-Safe**: Operations validate before executing, with automatic rollback on failure

---

## Installation & Configuration

### Binary Location
```
/opt/minicluster/bin/minicluster
```

### Symlink (for convenience)
```
/usr/local/bin/mc → /opt/minicluster/bin/minicluster
```

### Configuration Files
```
~/.minicluster/config.yaml          # User config
/etc/minicluster/cli-config.yaml    # System-wide config
```

### Configuration Hierarchy (highest to lowest priority)
1. Command-line flags
2. Environment variables (`MC_*`)
3. User config file
4. System config file
5. Built-in defaults

### Sample Configuration
```yaml
# ~/.minicluster/config.yaml
server:
  url: http://localhost:5147
  timeout: 30s

auth:
  token: ${MC_AUTH_TOKEN}  # Environment variable expansion
  # OR
  username: admin
  password: ${MC_PASSWORD}

output:
  format: table  # table, json, yaml, quiet
  color: auto    # auto, always, never

defaults:
  wait: true
  timeout: 300s
```

### Environment Variables
```bash
MC_SERVER_URL=http://localhost:5147
MC_AUTH_TOKEN=your-jwt-token
MC_OUTPUT_FORMAT=json
MC_NO_COLOR=true
MC_TIMEOUT=60s
```

---

## Command Structure

```
minicluster [global-flags] <resource> <action> [resource-name] [flags]
```

### Global Flags
| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--server` | `-s` | API server URL | `http://localhost:5147` |
| `--token` | `-t` | Authentication token | - |
| `--config` | `-c` | Config file path | `~/.minicluster/config.yaml` |
| `--output` | `-o` | Output format (table/json/yaml/quiet) | `table` |
| `--no-color` | - | Disable colored output | `false` |
| `--verbose` | `-v` | Verbose output | `false` |
| `--debug` | - | Debug mode (shows API calls) | `false` |
| `--timeout` | - | Operation timeout | `30s` |
| `--yes` | `-y` | Skip confirmation prompts | `false` |

---

## Resource Commands

### 1. Apps (`mc app` / `mc apps`)

#### List Apps
```bash
mc app list [flags]
mc apps                           # Shorthand

# Flags
--filter, -f    Filter by name pattern (glob)
--status        Filter by status (running/stopped/mixed)
--sort          Sort by field (name/created/services)
--limit         Limit results
```

**Examples:**
```bash
mc app list
mc app list -o json
mc app list --filter "prod-*" --status running
```

#### Get App Details
```bash
mc app get <app-name-or-id> [flags]

# Flags
--with-services    Include service details
--with-stats       Include runtime statistics
```

**Examples:**
```bash
mc app get my-app
mc app get my-app --with-services -o yaml
mc app get 550e8400-e29b-41d4-a716-446655440000
```

#### Create App
```bash
mc app create <app-name> [flags]

# Flags
--description, -d    App description
--icon               Emoji icon
--color              Hex color code
--from-file, -f      Create from YAML/JSON file
--from-template      Create from template
```

**Examples:**
```bash
mc app create my-new-app -d "Production services" --icon "🚀" --color "#3b82f6"
mc app create -f app-definition.yaml
mc app create my-app --from-template microservice
```

#### Update App
```bash
mc app update <app-name-or-id> [flags]

# Flags
--name              New name
--description, -d   New description
--icon              New icon
--color             New color
--from-file, -f     Update from YAML/JSON file
```

#### Delete App
```bash
mc app delete <app-name-or-id> [flags]

# Flags
--force           Force delete even if services exist
--cascade         Delete all services in the app
--keep-services   Unassign services but don't delete them
```

**Examples:**
```bash
mc app delete my-app --cascade -y
mc app delete my-app --keep-services
```

#### Clone App
```bash
mc app clone <source-app> [new-name] [flags]

# Flags
--with-services    Clone services too (default: true)
--no-services      Clone app structure only
--prefix           Prefix for cloned service names
--suffix           Suffix for cloned service names
```

#### Start/Stop All Services in App
```bash
mc app start <app-name-or-id> [flags]
mc app stop <app-name-or-id> [flags]
mc app restart <app-name-or-id> [flags]

# Flags
--parallel, -p     Start/stop services in parallel
--sequential       Start/stop services sequentially (respects order)
--wait, -w         Wait for operation to complete
--timeout          Timeout for wait (default: 5m)
```

#### App Status
```bash
mc app status <app-name-or-id>
```

**Output:**
```
App: my-app (🚀)
Status: Running (3/4 services)

Services:
  NAME            STATUS      PID     CPU     MEMORY    UPTIME
  api-gateway     Running     1234    2.1%    256 MB    2d 5h
  auth-service    Running     1235    0.8%    128 MB    2d 5h
  db-service      Running     1236    5.2%    512 MB    2d 5h
  worker          Stopped     -       -       -         -
```

---

### 2. Services (`mc service` / `mc svc`)

#### List Services
```bash
mc service list [flags]
mc svc ls                          # Shorthand

# Flags
--app, -a           Filter by app
--status            Filter by status
--filter, -f        Filter by name pattern
--unassigned        Show only unassigned services
--all               Include all details
```

#### Get Service Details
```bash
mc service get <service-name-or-id> [flags]

# Flags
--with-metrics     Include current metrics
--with-config      Include full configuration
```

#### Create Service
```bash
mc service create <service-name> [flags]

# Required Flags
--executable, -e    Path to executable
--working-dir, -w   Working directory

# Optional Flags
--app, -a           Assign to app
--args              Command arguments
--env               Environment variables (KEY=VALUE)
--env-file          Load env vars from file
--description, -d   Description
--auto-start        Auto-start on system boot
--access-link       URL for web access
--shell-execute     Use shell execute mode
--capture-output    Capture stdout/stderr
--from-file, -f     Create from YAML/JSON file
```

**Examples:**
```bash
mc service create api-server \
  --app my-app \
  -e /usr/bin/dotnet \
  --args "MyApp.dll" \
  -w /opt/apps/myapp \
  --env "ASPNETCORE_ENVIRONMENT=Production" \
  --env "DATABASE_URL=postgres://..." \
  --auto-start \
  --access-link "http://localhost:5000"

mc service create -f service.yaml
```

#### Update Service
```bash
mc service update <service-name-or-id> [flags]

# Flags (same as create, all optional)
--executable, -e
--working-dir, -w
--args
--env
--env-file
--clear-env         Clear all environment variables
--description, -d
--auto-start
--no-auto-start
--app, -a           Move to different app
--unassign          Remove from current app
--from-file, -f
```

#### Delete Service
```bash
mc service delete <service-name-or-id> [flags]

# Flags
--force             Force delete even if running
```

#### Service Control
```bash
mc service start <service-name-or-id> [flags]
mc service stop <service-name-or-id> [flags]
mc service restart <service-name-or-id> [flags]
mc service kill <service-name-or-id> [flags]      # Force kill

# Flags
--wait, -w          Wait for operation to complete
--timeout           Timeout for wait
--graceful-timeout  Time to wait before force kill (for stop/restart)
```

#### Service Status
```bash
mc service status <service-name-or-id>
```

#### Service Logs
```bash
mc service logs <service-name-or-id> [flags]

# Flags
--follow, -f        Stream logs in real-time
--tail, -n          Number of lines to show (default: 100)
--since             Show logs since timestamp/duration
--until             Show logs until timestamp
--timestamps        Show timestamps
--no-color          Disable log coloring
```

**Examples:**
```bash
mc service logs api-server -f
mc service logs api-server --since "2024-01-15T10:00:00Z"
mc service logs api-server --since "1h" --tail 500
```

#### Service Metrics
```bash
mc service metrics <service-name-or-id> [flags]

# Flags
--watch, -w         Continuously update metrics
--interval          Update interval (default: 2s)
--history           Show historical data
--since             History start time
```

---

### 3. Deploy (`mc deploy`)

Zero-downtime deployment commands for production use.

#### Blue-Green Deployment
```bash
mc deploy blue-green <app-or-service> [flags]

# Flags
--source, -s        Source (current running)
--target, -t        Target (new version path/config)
--from-file, -f     Deployment config file
--health-check      Health check endpoint
--health-timeout    Health check timeout (default: 30s)
--health-retries    Health check retries (default: 3)
--rollback-on-fail  Auto rollback on failure (default: true)
--keep-old          Keep old version running (don't stop)
--swap-delay        Delay before swapping (default: 0)
```

**Blue-Green Deployment Process:**
1. Validate target configuration
2. Start new instance (green) alongside existing (blue)
3. Run health checks on green
4. If healthy: route traffic to green, stop blue
5. If unhealthy: stop green, keep blue running

**Example:**
```bash
mc deploy blue-green api-service \
  --target /opt/apps/api-v2 \
  --health-check "http://localhost:5001/health" \
  --health-timeout 60s
```

#### Rolling Update
```bash
mc deploy rolling <app> [flags]

# Flags
--batch-size        Number of services to update at once (default: 1)
--delay             Delay between batches (default: 10s)
--health-check      Health check endpoint pattern
--max-unavailable   Max services that can be down (default: 1)
--from-file, -f     Deployment config file
```

#### Canary Deployment
```bash
mc deploy canary <service> [flags]

# Flags
--target, -t        New version path/config
--weight            Traffic weight for canary (0-100)
--duration          Duration to run canary
--metrics-threshold Error rate threshold to abort
--auto-promote      Auto-promote if successful
```

#### Deployment Status
```bash
mc deploy status [deployment-id]
mc deploy status --watch
```

#### Rollback
```bash
mc deploy rollback <app-or-service> [flags]

# Flags
--to                Rollback to specific version/deployment
--immediate         Skip health checks, immediate rollback
```

#### Deployment History
```bash
mc deploy history <app-or-service> [flags]

# Flags
--limit             Number of deployments to show
```

---

### 4. Config (`mc config`)

Manage service configurations and templates.

#### Export Configuration
```bash
mc config export <app-or-service> [flags]

# Flags
--output, -o        Output file (default: stdout)
--format            Format (yaml/json)
--include-secrets   Include sensitive data (masked by default)
--full              Include all metadata
```

**Example:**
```bash
mc config export my-app -o my-app-config.yaml
mc config export api-service --format json
```

#### Import Configuration
```bash
mc config import <file> [flags]

# Flags
--dry-run           Validate without applying
--merge             Merge with existing config
--replace           Replace existing config
--create-missing    Create apps/services if they don't exist
```

**Example:**
```bash
mc config import my-app-config.yaml --dry-run
mc config import my-app-config.yaml --create-missing
```

#### Diff Configuration
```bash
mc config diff <source> <target>
mc config diff my-app-config.yaml --live  # Compare file with running config
```

#### Templates
```bash
mc config template list
mc config template get <template-name>
mc config template create <name> --from-app <app>
mc config template create <name> --from-file <file>
mc config template delete <name>
```

---

### 5. System (`mc system`)

System-wide operations and monitoring.

#### System Status
```bash
mc system status [flags]

# Flags
--metrics           Include system metrics
--services          Include all service statuses
```

**Output:**
```
MiniCluster Status
═══════════════════════════════════════════════════════════════
Server:     http://localhost:5147
Version:    1.0.10
Uptime:     15d 3h 42m

System Metrics:
  CPU:      23.5% (8 cores)
  Memory:   4.2 GB / 16 GB (26.3%)
  Disk:     45.2 GB / 256 GB (17.7%)

Summary:
  Apps:     12 total
  Services: 47 total, 42 running, 5 stopped
```

#### Process List
```bash
mc system processes [flags]

# Flags
--all               Show all system processes
--mine              Show only managed processes (default)
--sort              Sort by (cpu/memory/name/pid)
--top               Show top N processes
```

#### Health Check
```bash
mc system health [flags]

# Flags
--deep              Deep health check (check all services)
--timeout           Timeout per service
```

#### Metrics
```bash
mc system metrics [flags]

# Flags
--watch, -w         Continuously update
--interval          Update interval
```

---

### 6. Batch Operations (`mc batch`)

Execute multiple operations from a file or stdin.

#### Run Batch
```bash
mc batch run <file-or-stdin> [flags]

# Flags
--parallel, -p      Run operations in parallel
--max-parallel      Max parallel operations (default: 5)
--continue-on-error Continue even if operation fails
--dry-run           Validate without executing
--verbose           Show each operation
```

**Batch File Format (YAML):**
```yaml
# batch-operations.yaml
version: 1
operations:
  - action: service.create
    name: api-gateway
    config:
      executable: /usr/bin/dotnet
      args: ["Gateway.dll"]
      workingDirectory: /opt/apps/gateway
      app: production
      
  - action: service.create
    name: auth-service
    config:
      executable: /usr/bin/dotnet
      args: ["Auth.dll"]
      workingDirectory: /opt/apps/auth
      app: production
      
  - action: app.start
    name: production
    
  - action: wait
    duration: 5s
    
  - action: service.health-check
    name: api-gateway
    config:
      endpoint: http://localhost:5000/health
      timeout: 30s
```

**Examples:**
```bash
mc batch run deployment.yaml --dry-run
mc batch run deployment.yaml --verbose

# From stdin
cat deployment.yaml | mc batch run -
```

---

### 7. Variables (`mc var`)

Manage variable groups for templated configurations.

```bash
mc var list [group-name]
mc var get <group-name>
mc var set <group-name> <key>=<value> [key2=value2 ...]
mc var delete <group-name> [key]
mc var import <file> [--group <name>]
mc var export [group-name] [-o file]
```

---

### 8. Proxy (`mc proxy`)

Manage reverse proxy routes.

```bash
mc proxy list
mc proxy get <route-id>
mc proxy create --path <path> --target <target-url> [--service <service>]
mc proxy update <route-id> [flags]
mc proxy delete <route-id>
mc proxy reload                    # Reload proxy configuration
```

---

## Exit Codes

Standardized exit codes for CI/CD integration:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments / usage error |
| 3 | Authentication error |
| 4 | Resource not found |
| 5 | Resource already exists |
| 6 | Operation timeout |
| 7 | Health check failed |
| 8 | Deployment failed |
| 9 | Rollback performed |
| 10 | Partial success (batch operations) |
| 64 | Connection error |
| 65 | Server error |

---

## Output Formats

### Table (Default)
Human-readable tables with colors.

### JSON
```bash
mc app list -o json
```
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "my-app",
      "status": "running",
      "serviceCount": 4,
      "runningCount": 3
    }
  ],
  "total": 1
}
```

### YAML
```bash
mc app get my-app -o yaml
```

### Quiet
Only essential output (IDs, names) for scripting:
```bash
mc app list -o quiet
# Output:
my-app
other-app
```

---

## CI/CD Integration Examples

### GitHub Actions
```yaml
- name: Deploy to MiniCluster
  env:
    MC_SERVER_URL: ${{ secrets.MINICLUSTER_URL }}
    MC_AUTH_TOKEN: ${{ secrets.MINICLUSTER_TOKEN }}
  run: |
    mc deploy blue-green api-service \
      --target ./publish \
      --health-check "http://localhost:5000/health" \
      --health-timeout 60s
```

### Azure DevOps
```yaml
- script: |
    mc service update api-service \
      --working-dir $(Build.ArtifactStagingDirectory)/app \
      --args "$(Build.BuildNumber)"
    mc service restart api-service --wait
  env:
    MC_SERVER_URL: $(MINICLUSTER_URL)
    MC_AUTH_TOKEN: $(MINICLUSTER_TOKEN)
```

### Shell Script
```bash
#!/bin/bash
set -e

# Deploy with automatic rollback on failure
if ! mc deploy blue-green api-service \
    --target /opt/apps/api-new \
    --health-check http://localhost:5000/health; then
    echo "Deployment failed, checking status..."
    mc deploy status
    exit 1
fi

echo "Deployment successful!"
mc service status api-service
```

---

## Configuration File Formats

### App Definition (YAML)
```yaml
# my-app.yaml
apiVersion: minicluster/v1
kind: App
metadata:
  name: my-production-app
  description: Production API services
  icon: "🚀"
  color: "#3b82f6"
spec:
  services:
    - name: api-gateway
      executable: /usr/bin/dotnet
      arguments: ["Gateway.dll"]
      workingDirectory: /opt/apps/gateway
      environment:
        ASPNETCORE_ENVIRONMENT: Production
        LOG_LEVEL: Information
      autoStart: true
      accessLink: http://localhost:5000
      
    - name: auth-service
      executable: /usr/bin/dotnet
      arguments: ["Auth.dll"]
      workingDirectory: /opt/apps/auth
      environment:
        ASPNETCORE_ENVIRONMENT: Production
      autoStart: true
```

### Service Definition (YAML)
```yaml
# service.yaml
apiVersion: minicluster/v1
kind: Service
metadata:
  name: api-gateway
  description: API Gateway service
  app: my-production-app
spec:
  executable: /usr/bin/dotnet
  arguments: ["Gateway.dll"]
  workingDirectory: /opt/apps/gateway
  environment:
    ASPNETCORE_ENVIRONMENT: Production
    DATABASE_URL: ${DATABASE_URL}      # Variable expansion
    API_KEY: ${secrets.API_KEY}        # Secret reference
  autoStart: true
  captureOutput: true
  accessLink: http://localhost:5000
  healthCheck:
    endpoint: /health
    interval: 30s
    timeout: 5s
```

### Deployment Definition (YAML)
```yaml
# deploy.yaml
apiVersion: minicluster/v1
kind: Deployment
metadata:
  name: api-v2-rollout
spec:
  strategy: blue-green
  target:
    service: api-gateway
    workingDirectory: /opt/apps/gateway-v2
    arguments: ["Gateway.dll", "--version", "2.0"]
  healthCheck:
    endpoint: http://localhost:5000/health
    timeout: 60s
    retries: 3
  rollback:
    automatic: true
    keepOldVersion: true
```

---

## Zero-Downtime Deployment Strategies

### 1. Blue-Green Deployment

**Process:**
```
                    ┌─────────────┐
    Traffic ──────▶ │   Blue      │  (current v1.0)
                    │  (Active)   │
                    └─────────────┘

    1. Deploy Green (v2.0) alongside Blue
    
                    ┌─────────────┐
    Traffic ──────▶ │   Blue      │  (v1.0)
                    │  (Active)   │
                    └─────────────┘
                    ┌─────────────┐
                    │   Green     │  (v2.0 starting)
                    │ (Standby)   │
                    └─────────────┘
    
    2. Health check Green
    3. Switch traffic to Green
    
                    ┌─────────────┐
                    │   Blue      │  (v1.0, stopping)
                    │ (Standby)   │
                    └─────────────┘
                    ┌─────────────┐
    Traffic ──────▶ │   Green     │  (v2.0)
                    │  (Active)   │
                    └─────────────┘
    
    4. Stop Blue (or keep for rollback)
```

**CLI Usage:**
```bash
mc deploy blue-green api-service \
  --target /opt/apps/api-v2 \
  --health-check http://localhost:5001/health \
  --keep-old
```

### 2. Rolling Update (for Apps with Multiple Services)

**Process:**
```
    Services: [S1, S2, S3, S4]
    
    Batch 1: Update S1
      S1(v2) ✓  S2(v1)  S3(v1)  S4(v1)
    
    Batch 2: Update S2
      S1(v2)  S2(v2) ✓  S3(v1)  S4(v1)
    
    ... continue until all updated
```

**CLI Usage:**
```bash
mc deploy rolling my-app \
  --from-file update-config.yaml \
  --batch-size 2 \
  --delay 30s \
  --health-check "http://localhost:{port}/health"
```

### 3. In-Place Update with Graceful Shutdown

**Process:**
```bash
mc service update api-service \
  --working-dir /opt/apps/api-v2 \
  --args "NewApp.dll"

mc service restart api-service \
  --graceful-timeout 30s \
  --wait
```

---

## Autocomplete

### Bash
```bash
source <(mc completion bash)
# Or add to ~/.bashrc:
echo 'source <(mc completion bash)' >> ~/.bashrc
```

### Zsh
```bash
source <(mc completion zsh)
# Or add to ~/.zshrc
```

### PowerShell
```powershell
mc completion powershell | Out-String | Invoke-Expression
```

---

## Version Information

```bash
mc version
# Output:
# MiniCluster CLI
# Version:    1.0.10
# Build:      2024-01-15T10:30:00Z
# Go Version: go1.21.5
# OS/Arch:    linux/amd64

mc version --short
# Output: 1.0.10
```

---

## Future Enhancements (Roadmap)

### Phase 1 (Current)
- [x] Basic CRUD operations for apps and services
- [ ] Service control (start/stop/restart)
- [ ] Logs streaming
- [ ] Basic health checks

### Phase 2
- [ ] Blue-green deployments
- [ ] Configuration import/export
- [ ] Batch operations
- [ ] Variable groups

### Phase 3
- [ ] Rolling updates
- [ ] Canary deployments
- [ ] Deployment history and rollback
- [ ] Metrics and monitoring

### Phase 4
- [ ] Multi-cluster support
- [ ] Service mesh integration
- [ ] Advanced scheduling
- [ ] Event webhooks

---

## Implementation Notes

### Technology Stack
- **Language**: Go (for cross-platform binaries and performance)
- **CLI Framework**: Cobra + Viper (industry standard)
- **HTTP Client**: Native Go with retry logic
- **Output**: tablewriter for tables, encoding/json for JSON

### Alternative: .NET Global Tool
If staying within .NET ecosystem:
```bash
dotnet tool install -g MiniCluster.CLI
```

### API Requirements
The CLI requires these API endpoints (most already exist):
- `GET/POST/PUT/DELETE /api/apps`
- `GET/POST/PUT/DELETE /api/services`
- `POST /api/services/{id}/start`
- `POST /api/services/{id}/stop`
- `GET /api/services/{id}/logs`
- `GET /api/metrics/current`
- `GET /api/metrics/system`
- `POST /api/deploy` (new)
- `GET /api/deploy/status` (new)
