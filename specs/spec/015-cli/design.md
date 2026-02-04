# MiniCluster CLI: Design Specification

> **Status:** 📋 Spec Draft  
> **Phase:** 11 - CLI & DevOps Tooling  
> **Priority:** 🟡 HIGH  
> **Author:** MiniCluster Team  
> **Date:** 2026-02-04

---

## Overview

This document provides the technical design specification for the MiniCluster CLI. It covers architecture decisions, command structure, implementation details, and integration patterns.

---

## Design Principles

These principles guide all CLI design decisions:

| Principle | Description | Example |
|-----------|-------------|---------||
| **0. Thin Client** | CLI has no business logic - it only calls the API | All process management happens server-side |
| **1. Predictable** | Same input → same output | `mc app list -o json` always returns JSON array |
| **2. Composable** | Commands work with Unix pipes | `mc service list -o quiet \| xargs mc service stop` |
| **3. Progressive** | Simple by default, powerful when needed | `mc app get foo` vs `mc app get foo --with-services --with-metrics -o yaml` |
| **4. Forgiving** | Help users recover from mistakes | Clear error messages with suggested fixes |
| **5. Fast** | Responsive feedback | Commands respond in <200ms for non-network ops |
| **6. Future-Ready** | Design for multi-node now, implement later | `--context` flag ready from day 1 |

---

## Critical Architecture Concept: CLI is a Thin Client

**The CLI never directly manages processes.** It always:

1. Parses command-line arguments
2. Makes HTTP request to MiniCluster API
3. API server does actual process management
4. CLI formats and displays response

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         How Start/Stop/Restart Works                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Your Machine               Target Machine (local or remote)                │
│  ┌─────────────┐           ┌─────────────────────────────────────────────┐ │
│  │   CLI       │           │  MiniCluster API Server (.NET)              │ │
│  │   (mc)      │──HTTP────►│  http://localhost:5147                      │ │
│  └─────────────┘           │           │                                 │ │
│                            │           │ Process.Start()/Kill()          │ │
│                            │           ▼                                 │ │
│                            │  ┌─────────────┐  ┌─────────────┐          │ │
│                            │  │ Service A   │  │ Service B   │          │ │
│                            │  │ (process)   │  │ (process)   │          │ │
│                            │  └─────────────┘  └─────────────┘          │ │
│                            └─────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implications:**
- You need MiniCluster API running on each machine you want to manage
- The CLI can be on a different machine than the services
- All heavy lifting is server-side (authentication, process mgmt, etc.)

---

## Expected Usage Patterns

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Usage Breakdown                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CI/CD Deployments        ████████████████████  50%    │
│  SSH/Remote Management    ██████████            25%    │
│  Developer Quick Commands ██████                15%    │
│  Automation Scripts       ████                  10%    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Environment | Why CLI over UI |
|-------------|----------------|
| **CI/CD Pipelines** | No human interaction possible |
| **SSH to servers** | No GUI available |
| **Scripts** | Scriptable, repeatable |
| **Developer laptops** | Faster than opening browser |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MINICLUSTER CLI                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        CLI Application Layer                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   Commands   │  │   Output     │  │   Configuration          │  │   │
│  │  │   (Cobra)    │  │   Formatter  │  │   Management             │  │   │
│  │  │              │  │  (table/json │  │  (Viper)                 │  │   │
│  │  │  • app       │  │   /yaml/quiet│  │  • config.yaml           │  │   │
│  │  │  • service   │  │             )│  │  • env vars              │  │   │
│  │  │  • deploy    │  │              │  │  • flags                 │  │   │
│  │  │  • config    │  │              │  │                          │  │   │
│  │  │  • system    │  │              │  │                          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Client Layer                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   HTTP       │  │   Auth       │  │   Retry Logic            │  │   │
│  │  │   Client     │  │   Handler    │  │   & Error Handling       │  │   │
│  │  │              │  │  (JWT/API    │  │                          │  │   │
│  │  │              │  │   Key)       │  │  • Exponential backoff   │  │   │
│  │  │              │  │              │  │  • Circuit breaker       │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ HTTPS/HTTP                             │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MiniCluster API Server                           │   │
│  │                     (ASP.NET Core)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

```
minicluster-cli/
├── cmd/                      # Command definitions
│   ├── root.go              # Root command, global flags
│   ├── app.go               # mc app [subcommand]
│   ├── service.go           # mc service [subcommand]
│   ├── deploy.go            # mc deploy [subcommand]
│   ├── config.go            # mc config [subcommand]
│   ├── system.go            # mc system [subcommand]
│   ├── batch.go             # mc batch [subcommand]
│   ├── proxy.go             # mc proxy [subcommand]
│   ├── completion.go        # Shell completions
│   └── version.go           # Version info
├── internal/
│   ├── api/                 # API client
│   │   ├── client.go        # HTTP client wrapper
│   │   ├── auth.go          # Authentication handling
│   │   ├── apps.go          # Apps API endpoints
│   │   ├── services.go      # Services API endpoints
│   │   ├── deploy.go        # Deployment API endpoints
│   │   └── system.go        # System API endpoints
│   ├── config/              # Configuration management
│   │   ├── config.go        # Config file handling
│   │   ├── credentials.go   # Secure credential storage
│   │   └── defaults.go      # Default values
│   ├── output/              # Output formatting
│   │   ├── formatter.go     # Base formatter interface
│   │   ├── table.go         # Table output
│   │   ├── json.go          # JSON output
│   │   ├── yaml.go          # YAML output
│   │   └── quiet.go         # Minimal output
│   ├── spinner/             # Progress indicators
│   │   └── spinner.go       # Loading spinners
│   └── util/                # Utilities
│       ├── errors.go        # Error handling
│       ├── validators.go    # Input validation
│       └── color.go         # Color detection
├── pkg/                     # Public packages (if any)
│   └── types/               # Shared types/DTOs
│       ├── app.go
│       ├── service.go
│       └── deploy.go
├── main.go                  # Entry point
├── go.mod
├── go.sum
├── Makefile                 # Build targets
└── README.md
```

---

## Technology Decisions

### Language: Go

**Decision:** Implement CLI in Go

**Rationale:**

| Factor | Go | .NET |
|--------|-----|-----|
| Binary Size | ~15-20 MB | ~50-80 MB (single-file) |
| Startup Time | <50ms | ~200-500ms |
| Cross-Compile | Built-in | Requires RID publish |
| CLI Ecosystem | Excellent (Cobra, Viper) | Good (System.CommandLine) |
| Distribution | Single binary | Global tool or single-file |
| Runtime Deps | None | None (with AOT) |

**Go Advantages:**
- Industry standard for CLI tools (kubectl, docker, gh, terraform)
- Cobra/Viper provide mature CLI patterns
- Trivial cross-compilation
- Fastest cold-start time

**Alternative Considered:** .NET Global Tool
- Would share code with backend
- Higher startup latency
- Larger binary size
- Could be added later as secondary distribution

### No Code Duplication Strategy

**Problem:** CLI (Go) and API (.NET) both need DTOs/models.

**Solution:** Generate Go client from OpenAPI spec:

```bash
# Generate Go client from Swagger spec
openapi-generator generate \
  -i http://localhost:5147/swagger/v1/swagger.json \
  -g go \
  -o ./pkg/api
```

**Result:** Zero manual DTO duplication. Models auto-generated from API.

| Component | In CLI | In API | Duplicated? |
|-----------|--------|--------|-------------|
| DTOs/Models | Auto-generated | C# classes | ❌ No |
| Business Logic | None | Yes | ❌ No |
| Validation | Basic input checks | Full validation | ❌ Minimal |
| Process Mgmt | None (calls API) | Yes | ❌ No |

### Key Dependencies

| Dependency | Purpose | License |
|------------|---------|---------|
| [cobra](https://github.com/spf13/cobra) | CLI framework | Apache-2.0 |
| [viper](https://github.com/spf13/viper) | Configuration | MIT |
| [tablewriter](https://github.com/olekukonko/tablewriter) | Table output | MIT |
| [color](https://github.com/fatih/color) | Colored output | MIT |
| [spinner](https://github.com/briandowns/spinner) | Progress spinners | Apache-2.0 |
| [survey](https://github.com/AlecAivazis/survey) | Interactive prompts | MIT |
| [yaml.v3](https://gopkg.in/yaml.v3) | YAML parsing | Apache-2.0 |

---

## Command Structure

### Command Hierarchy

```
minicluster (mc)
├── app
│   ├── list (ls)
│   ├── get
│   ├── create
│   ├── update
│   ├── delete (rm)
│   ├── clone
│   ├── start
│   ├── stop
│   ├── restart
│   └── status
├── service (svc)
│   ├── list (ls)
│   ├── get
│   ├── create
│   ├── update
│   ├── delete (rm)
│   ├── start
│   ├── stop
│   ├── restart
│   ├── kill
│   ├── logs
│   ├── status
│   └── metrics
├── deploy
│   ├── blue-green
│   ├── rolling
│   ├── canary
│   ├── status
│   ├── rollback
│   └── history
├── config
│   ├── export
│   ├── import
│   ├── diff
│   ├── validate
│   └── template
│       ├── list
│       ├── get
│       ├── create
│       └── delete
├── system
│   ├── status
│   ├── health
│   ├── metrics
│   └── processes
├── batch
│   └── run
├── proxy
│   ├── list
│   ├── get
│   ├── create
│   ├── update
│   ├── delete
│   └── reload
├── login
├── logout
├── completion
│   ├── bash
│   ├── zsh
│   ├── fish
│   └── powershell
└── version
```

### Command Pattern

All commands follow this pattern:

```
mc <resource> <action> [resource-identifier] [flags]
```

**Examples:**
```bash
mc app list                          # List all apps
mc app get my-app                    # Get specific app
mc service create api --app my-app   # Create service in app
mc service logs api -f               # Follow logs
mc deploy blue-green my-app          # Deploy app
```

---

## Configuration System

### What config.yaml is for

**IMPORTANT:** `config.yaml` stores CLI settings, NOT application/service configuration.

| Config.yaml IS for | Config.yaml is NOT for |
|--------------------|------------------------|
| Which server to connect to | Service executables/paths |
| Authentication tokens | Environment variables for apps |
| Output format preference | App configurations |
| Default timeout values | Service definitions |
| Multiple server contexts | Database settings |

### Configuration Hierarchy

```
1. Command-line flags        (highest priority)
2. Environment variables     (MC_*)
3. Project config file       (.minicluster.yaml in cwd)
4. User config file          (~/.minicluster/config.yaml)
5. System config file        (/etc/minicluster/config.yaml)
6. Built-in defaults         (lowest priority)
```

### Configuration File Schema

```yaml
# ~/.minicluster/config.yaml

# API Server configuration
server:
  url: http://localhost:5147    # MiniCluster API URL
  timeout: 30s                  # Request timeout
  insecure: false              # Skip TLS verification

# Authentication
auth:
  # Option 1: JWT Token
  token: ${MC_AUTH_TOKEN}       # Environment variable reference
  
  # Option 2: Credentials (will get token automatically)
  username: admin
  password: ${MC_PASSWORD}
  
  # Option 3: API Key (when implemented)
  api-key: ${MC_API_KEY}

# Output preferences
output:
  format: table                # Default: table, json, yaml, quiet
  color: auto                  # auto, always, never
  timestamps: false            # Show timestamps in logs

# Default behaviors
defaults:
  wait: true                   # Wait for operations to complete
  timeout: 300s                # Default wait timeout
  confirm: true                # Ask for confirmation on destructive ops

# Contexts (forward-compatible for multi-node, implement structure now)
contexts:
  - name: local
    server:
      url: http://localhost:5147
    auth:
      token: ${MC_LOCAL_TOKEN}
      
  - name: staging
    server:
      url: https://staging.example.com:5147
    auth:
      token: ${MC_STAGING_TOKEN}
      
  - name: production
    server:
      url: https://prod.example.com:5147
    auth:
      token: ${MC_PROD_TOKEN}

current-context: local
```

### Forward-Compatible Multi-Context Design

**Principle:** Design for multi-node now, implement later.

Implement these in Phase 1 (even as simple pass-through):

```bash
# Global --context flag (works from day 1)
mc --context production app list
mc --context staging service restart api

# Uses current-context from config (default: local)
mc app list
```

**Why now?**
- User scripts won't break when multi-node arrives
- Config files are portable across versions
- ~2 hours extra implementation cost
- Prevents breaking changes later

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MC_SERVER_URL` | API server URL | `http://localhost:5147` |
| `MC_AUTH_TOKEN` | JWT authentication token | - |
| `MC_API_KEY` | API key (when supported) | - |
| `MC_USERNAME` | Username for login | - |
| `MC_PASSWORD` | Password for login | - |
| `MC_OUTPUT_FORMAT` | Output format | `table` |
| `MC_NO_COLOR` | Disable colored output | `false` |
| `MC_TIMEOUT` | Default timeout | `30s` |
| `MC_CONFIG` | Config file path | `~/.minicluster/config.yaml` |
| `MC_DEBUG` | Enable debug mode | `false` |
| `MC_INSECURE` | Skip TLS verification | `false` |
| `MC_CONTEXT` | Context name to use | `current-context` from config |

---

## Authentication Design

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Authentication Flow                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Option 1: Token in Config/Env                                              │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │   CLI        │   ─────► │   Add Token  │   ─────► │   API Call   │      │
│  │   Command    │          │   to Header  │          │   Succeeds   │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                                                             │
│  Option 2: Login Command                                                    │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │   mc login   │   ─────► │   POST       │   ─────► │   Store      │      │
│  │   (user/pwd) │          │   /api/auth  │          │   Token      │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                    │                                        │
│                                    ▼                                        │
│                            ┌──────────────┐                                 │
│                            │   Secure     │                                 │
│                            │   Storage    │                                 │
│                            │   (keychain) │                                 │
│                            └──────────────┘                                 │
│                                                                             │
│  Option 3: API Key (Future)                                                 │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │   CLI        │   ─────► │   Add Key to │   ─────► │   API Call   │      │
│  │   Command    │          │   X-API-Key  │          │   Succeeds   │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Storage

**Priority:**
1. OS Keychain (macOS Keychain, Windows Credential Manager, libsecret)
2. Encrypted file (`~/.minicluster/credentials`)
3. Plain config file (with warning)

### Login Command

```bash
# Interactive login (prompts for everything)
mc login
# Server URL [http://localhost:5147]: 
# Username: admin
# Password: ********
# ✓ Logged in successfully. Token stored.

# Non-interactive login (for scripts)
mc login --server https://api.example.com --username admin --password $PASSWORD

# Login with existing token (skip username/password)
mc login --token $JWT_TOKEN

# Login to specific context
mc login --context production

# Check login status
mc login --status
# Output:
# ✓ Logged in to http://localhost:5147
# User: admin
# Token expires: 2026-02-11 14:30:00

# Logout
mc logout
# ✓ Logged out. Token removed from credential store.
```

### CI/CD: No Login Required

In CI/CD pipelines, skip `mc login` entirely. Use environment variables:

```yaml
# GitHub Actions
env:
  MC_SERVER_URL: ${{ secrets.MINICLUSTER_URL }}
  MC_AUTH_TOKEN: ${{ secrets.MINICLUSTER_TOKEN }}

steps:
  - run: mc app list  # Uses env vars, no login needed
```

**The CLI automatically uses `MC_AUTH_TOKEN` when present.**

---

## Output Formatting

### Format Types

#### 1. Table (Default)
Human-readable, colorized tables.

```bash
$ mc app list

NAME               STATUS     SERVICES    RUNNING    CREATED
────────────────────────────────────────────────────────────────
production-api     Running    4           4          2 days ago
staging-api        Mixed      4           2          5 days ago
worker-services    Stopped    3           0          1 week ago
```

#### 2. JSON
Machine-parseable JSON output.

```bash
$ mc app list -o json
{
  "context": "local",  // Forward-compatible: include context in output
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "production-api",
      "status": "running",
      "serviceCount": 4,
      "runningCount": 4,
      "createdAt": "2026-02-02T10:30:00Z"
    }
  ],
  "total": 3
}
```

**Note:** Include `context` field in JSON output from day 1 (forward-compatible for multi-node).

#### 3. YAML
YAML output for configuration compatibility.

```bash
$ mc app get production-api -o yaml
id: 550e8400-e29b-41d4-a716-446655440000
name: production-api
status: running
services:
  - name: api-gateway
    status: running
  - name: auth-service
    status: running
```

#### 4. Quiet
Minimal output for scripting.

```bash
$ mc app list -o quiet
production-api
staging-api
worker-services

$ mc service list -o quiet --app production-api
api-gateway
auth-service
db-service
worker
```

### Color Coding

| Status | Color |
|--------|-------|
| Running | Green |
| Stopped | Gray |
| Failed/Error | Red |
| Starting/Stopping | Yellow |
| Warning | Orange |

Color detection:
- Auto-detect TTY
- Check `NO_COLOR` environment variable
- Check `--no-color` flag
- Check `TERM` for capability

---

## Error Handling

### Error Message Format

```
Error: <brief description>

<detailed explanation>

Suggestion: <how to fix>

For more information, run: mc <command> --help
```

**Example:**
```
Error: Service "api-server" not found

No service with the name or ID "api-server" exists in the current context.
Did you mean one of these?
  • api-gateway
  • api-service

Suggestion: Run 'mc service list' to see available services.

For more information, run: mc service get --help
```

### Exit Codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | `ExitSuccess` | Success |
| 1 | `ExitError` | General error |
| 2 | `ExitUsageError` | Invalid arguments / usage |
| 3 | `ExitAuthError` | Authentication failed |
| 4 | `ExitNotFound` | Resource not found |
| 5 | `ExitConflict` | Resource already exists |
| 6 | `ExitTimeout` | Operation timed out |
| 7 | `ExitHealthFailed` | Health check failed |
| 8 | `ExitDeployFailed` | Deployment failed |
| 9 | `ExitRollback` | Rollback was performed |
| 10 | `ExitPartialSuccess` | Batch: some ops failed |
| 64 | `ExitConnError` | Connection error |
| 65 | `ExitServerError` | Server error (5xx) |

---

## API Client Design

### Client Interface

```go
type MiniClusterClient interface {
    // Apps
    ListApps(ctx context.Context, opts ListOptions) ([]App, error)
    GetApp(ctx context.Context, id string) (*App, error)
    CreateApp(ctx context.Context, app *CreateAppRequest) (*App, error)
    UpdateApp(ctx context.Context, id string, app *UpdateAppRequest) (*App, error)
    DeleteApp(ctx context.Context, id string, opts DeleteOptions) error
    StartApp(ctx context.Context, id string, opts StartOptions) error
    StopApp(ctx context.Context, id string, opts StopOptions) error
    
    // Services
    ListServices(ctx context.Context, opts ListOptions) ([]Service, error)
    GetService(ctx context.Context, id string) (*Service, error)
    CreateService(ctx context.Context, svc *CreateServiceRequest) (*Service, error)
    UpdateService(ctx context.Context, id string, svc *UpdateServiceRequest) (*Service, error)
    DeleteService(ctx context.Context, id string, opts DeleteOptions) error
    StartService(ctx context.Context, id string, opts StartOptions) error
    StopService(ctx context.Context, id string, opts StopOptions) error
    RestartService(ctx context.Context, id string, opts RestartOptions) error
    GetServiceLogs(ctx context.Context, id string, opts LogOptions) (io.ReadCloser, error)
    
    // Deployments
    DeployBlueGreen(ctx context.Context, req *BlueGreenRequest) (*Deployment, error)
    DeployRolling(ctx context.Context, req *RollingRequest) (*Deployment, error)
    GetDeploymentStatus(ctx context.Context, id string) (*DeploymentStatus, error)
    Rollback(ctx context.Context, id string, opts RollbackOptions) (*Deployment, error)
    
    // System
    GetSystemStatus(ctx context.Context) (*SystemStatus, error)
    GetSystemHealth(ctx context.Context) (*HealthStatus, error)
    GetSystemMetrics(ctx context.Context) (*SystemMetrics, error)
}
```

### Retry Logic

```go
// Retry configuration
type RetryConfig struct {
    MaxRetries     int
    InitialBackoff time.Duration
    MaxBackoff     time.Duration
    Multiplier     float64
    RetryOn        []int  // HTTP status codes to retry
}

// Default retry config
var DefaultRetryConfig = RetryConfig{
    MaxRetries:     3,
    InitialBackoff: 100 * time.Millisecond,
    MaxBackoff:     5 * time.Second,
    Multiplier:     2.0,
    RetryOn:        []int{429, 500, 502, 503, 504},
}
```

---

## Deployment Commands Design

### Blue-Green Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Blue-Green Deployment Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  mc deploy blue-green my-service --target /new/path --health-check /health  │
│                                                                             │
│  Step 1: Validate                                                           │
│  ├── Check service exists                                                   │
│  ├── Check target path accessible                                           │
│  └── Validate health-check endpoint                                         │
│                                                                             │
│  Step 2: Create Green Instance                                              │
│  ├── Create temporary service (my-service-green)                            │
│  ├── Configure with new target path                                         │
│  └── Start green instance                                                   │
│                                                                             │
│  Step 3: Health Check Green                                                 │
│  ├── Wait for process to start                                              │
│  ├── Poll health endpoint                                                   │
│  ├── Retry with backoff                                                     │
│  └── If failed → Rollback                                                   │
│                                                                             │
│  Step 4: Switch Traffic                                                     │
│  ├── Stop blue instance                                                     │
│  ├── Update service config with new path                                    │
│  ├── Rename green → original name                                           │
│  └── Delete blue instance                                                   │
│                                                                             │
│  Step 5: Verify                                                             │
│  ├── Confirm service running                                                │
│  └── Confirm health check passes                                            │
│                                                                             │
│  Output:                                                                    │
│  ✓ Deployment successful                                                    │
│  • Previous: /old/path (v1.0.0)                                             │
│  • Current:  /new/path (v2.0.0)                                             │
│  • Health:   Healthy (200 OK)                                               │
│  • Duration: 45s                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Progress Display

```bash
$ mc deploy blue-green api-service --target /opt/api-v2 --health-check http://localhost:5000/health

Deploying api-service (blue-green)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✓ Validating configuration
  ✓ Creating green instance
  ◐ Starting green instance (12s)
    └── Waiting for process to be ready...
  ○ Running health checks
  ○ Switching traffic
  ○ Cleaning up blue instance

Press Ctrl+C to cancel (will trigger rollback)
```

---

## Log Streaming Design

### Log Command

```bash
mc service logs <service> [flags]

Flags:
  -f, --follow          Stream logs continuously
  -n, --tail int        Number of lines to show (default 100)
      --since string    Show logs since (timestamp or duration like "1h")
      --until string    Show logs until timestamp
      --timestamps      Show timestamps
      --no-color        Disable log coloring
      --filter string   Filter logs by pattern
```

### Implementation

```go
func streamLogs(ctx context.Context, serviceID string, opts LogOptions) error {
    // Use Server-Sent Events or WebSocket for real-time streaming
    req, err := http.NewRequestWithContext(ctx, "GET", 
        fmt.Sprintf("%s/api/services/%s/logs/stream", serverURL, serviceID), nil)
    
    q := req.URL.Query()
    if opts.Follow {
        q.Set("follow", "true")
    }
    if opts.Tail > 0 {
        q.Set("tail", strconv.Itoa(opts.Tail))
    }
    req.URL.RawQuery = q.Encode()
    
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        line := scanner.Text()
        if opts.NoColor {
            fmt.Println(line)
        } else {
            fmt.Println(colorize(line))
        }
    }
    return scanner.Err()
}
```

---

## Configuration File Support

### YAML Schema for Apps

```yaml
# my-app.yaml
apiVersion: minicluster/v1
kind: App
metadata:
  name: production-api
  description: Production API services
  icon: "🚀"
  color: "#3b82f6"
spec:
  services:
    - name: api-gateway
      executable: /usr/bin/dotnet
      arguments:
        - Gateway.dll
        - --urls
        - http://localhost:5000
      workingDirectory: /opt/apps/gateway
      environment:
        ASPNETCORE_ENVIRONMENT: Production
        LOG_LEVEL: Information
        DATABASE_URL: ${DATABASE_URL}     # Variable expansion
      autoStart: true
      captureOutput: true
      accessLink: http://localhost:5000

    - name: auth-service
      executable: /usr/bin/dotnet
      arguments: [Auth.dll]
      workingDirectory: /opt/apps/auth
      environment:
        ASPNETCORE_ENVIRONMENT: Production
      autoStart: true
```

### Import/Export Commands

```bash
# Export current state
mc config export my-app -o my-app.yaml

# Import from file (dry-run first)
mc config import my-app.yaml --dry-run
mc config import my-app.yaml --create-missing

# Diff file vs live
mc config diff my-app.yaml --live
```

---

## Shell Completion

### Bash Completion

```bash
# Install
mc completion bash > /etc/bash_completion.d/mc

# Or add to .bashrc
source <(mc completion bash)
```

### Zsh Completion

```bash
# Install
mc completion zsh > "${fpath[1]}/_mc"

# Or add to .zshrc
source <(mc completion zsh)
```

### PowerShell Completion

```powershell
# Add to profile
mc completion powershell | Out-String | Invoke-Expression
```

### Dynamic Completions

```go
// Complete app names
func completeAppNames(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
    apps, err := client.ListApps(context.Background(), ListOptions{})
    if err != nil {
        return nil, cobra.ShellCompDirectiveError
    }
    
    var names []string
    for _, app := range apps {
        if strings.HasPrefix(app.Name, toComplete) {
            names = append(names, app.Name)
        }
    }
    return names, cobra.ShellCompDirectiveNoFileComp
}
```

---

## Build & Distribution

### Build Matrix

| OS | Arch | Binary Name |
|----|------|-------------|
| Linux | amd64 | minicluster-linux-amd64 |
| Linux | arm64 | minicluster-linux-arm64 |
| macOS | amd64 | minicluster-darwin-amd64 |
| macOS | arm64 | minicluster-darwin-arm64 |
| Windows | amd64 | minicluster-windows-amd64.exe |

### Makefile Targets

```makefile
VERSION ?= $(shell git describe --tags --always --dirty)
LDFLAGS := -X main.version=$(VERSION) -X main.buildTime=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)

.PHONY: build
build:
	go build -ldflags "$(LDFLAGS)" -o bin/minicluster ./main.go

.PHONY: build-all
build-all:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/minicluster-linux-amd64 ./main.go
	GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/minicluster-linux-arm64 ./main.go
	GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/minicluster-darwin-amd64 ./main.go
	GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/minicluster-darwin-arm64 ./main.go
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/minicluster-windows-amd64.exe ./main.go

.PHONY: test
test:
	go test -v ./...

.PHONY: lint
lint:
	golangci-lint run
```

### Installation Methods

1. **Direct Download**
   ```bash
   curl -Lo mc https://github.com/innovatek/minicluster/releases/latest/download/minicluster-$(uname -s)-$(uname -m)
   chmod +x mc
   sudo mv mc /usr/local/bin/
   ```

2. **Homebrew (macOS/Linux)**
   ```bash
   brew install innovatek/tap/minicluster
   ```

3. **Scoop (Windows)**
   ```powershell
   scoop bucket add innovatek https://github.com/innovatek/scoop-bucket
   scoop install minicluster
   ```

4. **APT (Debian/Ubuntu)**
   ```bash
   echo "deb [trusted=yes] https://apt.innovatek.com/ /" | sudo tee /etc/apt/sources.list.d/minicluster.list
   sudo apt update
   sudo apt install minicluster
   ```

---

## Testing Strategy

### Unit Tests

```go
func TestAppListCommand(t *testing.T) {
    // Mock API client
    mockClient := &MockClient{
        ListAppsFunc: func(ctx context.Context, opts ListOptions) ([]App, error) {
            return []App{
                {ID: "1", Name: "app-1", Status: "running"},
                {ID: "2", Name: "app-2", Status: "stopped"},
            }, nil
        },
    }
    
    cmd := NewAppListCmd(mockClient)
    buf := new(bytes.Buffer)
    cmd.SetOut(buf)
    
    err := cmd.Execute()
    assert.NoError(t, err)
    assert.Contains(t, buf.String(), "app-1")
    assert.Contains(t, buf.String(), "app-2")
}
```

### Integration Tests

```go
func TestDeployBlueGreen_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    
    // Requires running MiniCluster instance
    client := NewClient(os.Getenv("MC_TEST_SERVER_URL"))
    
    // Create test service
    svc, err := client.CreateService(ctx, &CreateServiceRequest{
        Name: "test-service",
        // ...
    })
    require.NoError(t, err)
    defer client.DeleteService(ctx, svc.ID, DeleteOptions{Force: true})
    
    // Deploy
    deployment, err := client.DeployBlueGreen(ctx, &BlueGreenRequest{
        ServiceID:   svc.ID,
        TargetPath:  "/tmp/test-v2",
        HealthCheck: "http://localhost:5000/health",
    })
    require.NoError(t, err)
    assert.Equal(t, "success", deployment.Status)
}
```

---

## Security Considerations

### Credential Security

1. **Never log credentials**
   ```go
   // Bad
   log.Printf("Using token: %s", token)
   
   // Good
   log.Printf("Using token: %s...%s", token[:4], token[len(token)-4:])
   ```

2. **Mask in error messages**
   ```go
   // Bad
   return fmt.Errorf("auth failed with password: %s", password)
   
   // Good
   return fmt.Errorf("authentication failed")
   ```

3. **Secure memory**
   - Clear sensitive strings after use
   - Use OS keychain where available

### Input Validation

- Validate all user inputs
- Escape shell characters in arguments
- Validate URLs before connecting
- Validate file paths (no path traversal)

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| CLI startup | <100ms | Cold start to command parsing |
| `mc version` | <150ms | Basic command with no API |
| `mc app list` (cached) | <200ms | With config loaded |
| `mc app list` (network) | <500ms | Depends on API response |
| Binary size | <25MB | Compressed release binary |

---

## References

- [Goals Document](goals.md) - Strategic goals and vision
- [CLI_SPECIFICATION.md](../CLI_SPECIFICATION.md) - Command reference
- [Cobra Documentation](https://cobra.dev/)
- [Viper Documentation](https://github.com/spf13/viper)
- [12-Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46)
