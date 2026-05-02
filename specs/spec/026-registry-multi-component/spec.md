# Feature 026: Registry — Heterogeneous Multi-Component Packages

> **Status:** 🚧 In Progress  
> **Priority:** HIGH  
> **Effort:** 4 weeks (on top of 019 Registry foundation)  
> **Branch:** `feature/container-registry`  
> **Dependencies:** 019 Registry, 025 Container Lifecycle, 006 Container Support  
> **Last Updated:** April 29, 2026

---

## Overview

Extends the `.mcpkg` package format (Spec 019) to support **heterogeneous multi-component applications** — a single package that can mix containers, native processes, and platform-acquired binaries with explicit dependency ordering and cross-platform acquisition strategies.

**Problem Spec 019 doesn't solve:**

> "I want to publish `my-saas` as one installable unit. It needs PostgreSQL as a container, a Node.js API installed from npm/apt/choco, and a background worker as a native binary — all wired together, starting in the right order."

This spec adds the manifest extensions, acquisition providers, component orchestration, and registry API changes needed to make that possible.

---

## Extended Manifest Format

The `.mcpkg` `manifest.json` gains a top-level `components` array. Existing single-component manifests remain fully backward-compatible (they are treated as a single `process` component implicitly).

```json
{
  "schemaVersion": "2.0",
  "name": "my-saas",
  "version": "2.1.0",
  "description": "Full-stack SaaS application",
  "author": "Innovatek",
  "license": "MIT",
  "tags": ["web", "saas", "postgres"],
  "minicluster": { "minVersion": "1.1.0" },

  "components": [
    {
      "name": "database",
      "type": "container",
      "image": "postgres:16",
      "registry": "docker.io",
      "pullPolicy": "IfNotPresent",
      "ports": [{ "host": 5432, "container": 5432, "protocol": "tcp" }],
      "volumes": [
        { "type": "volume", "source": "pgdata", "target": "/var/lib/postgresql/data" }
      ],
      "env": {
        "POSTGRES_DB":       { "default": "myapp", "description": "Database name" },
        "POSTGRES_USER":     { "default": "myapp", "required": true },
        "POSTGRES_PASSWORD": { "required": true, "secret": true }
      },
      "healthCheck": {
        "type": "exec",
        "command": ["pg_isready", "-U", "myapp"],
        "interval": "10s",
        "retries": 5
      }
    },
    {
      "name": "cache",
      "type": "container",
      "image": "redis:7-alpine",
      "registry": "docker.io",
      "ports": [{ "host": 6379, "container": 6379 }]
    },
    {
      "name": "api",
      "type": "process",
      "acquire": {
        "windows": {
          "provider": "chocolatey",
          "package": "my-saas-api",
          "version": "2.1.0",
          "checksum": "sha256:aabbcc..."
        },
        "linux-deb": {
          "provider": "apt",
          "package": "my-saas-api",
          "version": "2.1.0",
          "repository": "https://apt.example.com stable main",
          "key": "https://apt.example.com/key.gpg"
        },
        "linux-rpm": {
          "provider": "dnf",
          "package": "my-saas-api",
          "version": "2.1.0"
        },
        "macos": {
          "provider": "brew",
          "tap": "example/tap",
          "formula": "my-saas-api"
        },
        "direct": {
          "provider": "download",
          "urls": {
            "linux-amd64":   "https://releases.example.com/my-saas-api-2.1.0-linux-amd64.tar.gz",
            "windows-amd64": "https://releases.example.com/my-saas-api-2.1.0-win-x64.zip",
            "darwin-arm64":  "https://releases.example.com/my-saas-api-2.1.0-darwin-arm64.tar.gz"
          },
          "checksums": {
            "linux-amd64":   "sha256:112233...",
            "windows-amd64": "sha256:445566..."
          },
          "extract": { "binary": "my-saas-api" }
        }
      },
      "command": "my-saas-api",
      "arguments": "--port 8080 --db postgres://localhost:5432/myapp",
      "env": {
        "DATABASE_URL": { "fromComponent": "database", "envVar": "CONNECTION_STRING" },
        "REDIS_URL":    { "fromComponent": "cache",    "envVar": "REDIS_URL" },
        "API_SECRET":   { "required": true, "secret": true }
      },
      "ports": [{ "host": 8080, "container": 8080, "expose": true }],
      "healthCheck": {
        "type": "http",
        "path": "/health",
        "port": 8080,
        "interval": "15s"
      },
      "dependsOn": [
        { "component": "database", "condition": "healthy" },
        { "component": "cache",    "condition": "running" }
      ]
    },
    {
      "name": "worker",
      "type": "process",
      "bundled": true,
      "binaryPath": "app/worker",
      "arguments": "--queue redis://localhost:6379",
      "restartPolicy": "always",
      "dependsOn": [
        { "component": "database", "condition": "healthy" },
        { "component": "cache",    "condition": "running" },
        { "component": "api",      "condition": "running" }
      ]
    }
  ],

  "scripts": {
    "preInstall":  "scripts/pre-install.sh",
    "postInstall": "scripts/post-install.sh",
    "preStart":    "scripts/pre-start.sh"
  },

  "volumes": [
    { "name": "pgdata", "description": "PostgreSQL data volume" }
  ]
}
```

---

## Component Types

| Type | Description | Acquisition |
|------|-------------|-------------|
| `process` with `bundled: true` | Binary is inside the `.mcpkg` ZIP | Extracted on install |
| `process` with `acquire` | Binary fetched from external source | Platform-specific provider |
| `container` with `image` | Docker/OCI image from registry | `docker pull` |
| `container` from registry | Pull from private registry | Registry credentials needed |

---

## Acquisition Providers

| Provider | Platform | Description |
|----------|----------|-------------|
| `chocolatey` | Windows | `choco install <pkg> --version <v>` |
| `winget` | Windows | `winget install <pkg>` |
| `apt` | Debian/Ubuntu | `apt-get install <pkg>=<v>` |
| `dnf` | RHEL/Fedora | `dnf install <pkg>-<v>` |
| `pacman` | Arch | `pacman -S <pkg>` |
| `brew` | macOS | `brew install <tap>/<formula>` |
| `download` | All | Direct URL download + extract |
| `mcpkg` | All | Another `.mcpkg` as a dependency |

**Provider resolution order:** MiniCluster detects the platform and selects the best provider in priority order: native package manager → `download` fallback. If no provider matches, installation fails with a clear error.

---

## `dependsOn` Conditions

| Condition | Meaning |
|-----------|---------|
| `running` | Component has status `Running` |
| `healthy` | Component has passed at least one health check |
| `complete` | Component exited with code 0 (for one-shot init containers) |

MiniCluster resolves the `dependsOn` graph, detects cycles, and starts components in topological order. Components at the same depth level start in parallel.

**Example start order for the manifest above:**
```
Depth 0:  database, cache          ← no deps, parallel start
Depth 1:  api                      ← waits for database(healthy) + cache(running)
Depth 2:  worker                   ← waits for api(running)
```

---

## Environment Variable Binding

### `fromComponent` — cross-component env injection

```json
"DATABASE_URL": { "fromComponent": "database", "envVar": "CONNECTION_STRING" }
```

MiniCluster automatically resolves the value from the named component's runtime environment or from a computed value (e.g., the actual host:port after port mapping is applied).

### Built-in computed variables (available in all components)

| Variable | Value |
|----------|-------|
| `MC_COMPONENT_<NAME>_HOST` | Resolved host IP for component |
| `MC_COMPONENT_<NAME>_PORT_<N>` | Host-mapped port N of component |
| `MC_APP_NAME` | App name from manifest |
| `MC_APP_VERSION` | App version from manifest |
| `MC_DATA_DIR` | MiniCluster data directory for this app |

---

## Registry API Extensions

### Package Endpoints (additions to Spec 019)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/registry/packages/{name}/manifest` | Get raw manifest.json |
| GET | `/api/registry/packages/{name}/components` | List components in a package |
| POST | `/api/registry/validate` | Validate a manifest without uploading |
| GET | `/api/registry/packages?type=container` | Filter packages by component type |
| GET | `/api/registry/packages?tag=database` | Filter packages by tag |

### Install Endpoint

```
POST /api/registry/packages/{name}/install
```

**Request:**
```json
{
  "version": "2.1.0",
  "targetAppId": "my-app-group-id",
  "components": ["database", "api"],   // optional: install subset
  "env": {
    "POSTGRES_USER":     "myapp",
    "POSTGRES_PASSWORD": "secret",
    "API_SECRET":        "my-secret"
  }
}
```

**Response:** Server-Sent Events stream of install progress:
```
data: {"phase":"download","component":"api","message":"Downloading my-saas-api 2.1.0...","percent":0}
data: {"phase":"download","component":"api","message":"Downloading...","percent":64}
data: {"phase":"acquire","component":"api","provider":"apt","message":"Installing via apt..."}
data: {"phase":"extract","component":"worker","message":"Extracting bundled binary..."}
data: {"phase":"register","component":"database","message":"Registering container service..."}
data: {"phase":"register","component":"api","message":"Registering process service..."}
data: {"phase":"complete","message":"Installation complete. 4 components registered.","appId":"uuid"}
```

### Manifest Validation Rules

The registry rejects packages where:
- `schemaVersion` is missing or unknown
- A `container` component has no `image`
- A `process` component has neither `acquire` nor `bundled: true`
- `dependsOn` references a component not in the manifest
- `dependsOn` graph contains a cycle
- A `fromComponent` references an undefined component

---

## Installer Service

`internal/services/package_installer.go` — responsible for executing an install from a `.mcpkg`:

```go
type PackageInstaller struct {
    registryClient  *RegistryClient
    acquirer        *AcquisitionService   // handles provider dispatch
    serviceRepo     *ServiceRepository
    appDB           *gorm.DB
    log             *zap.Logger
}

func (i *PackageInstaller) Install(ctx context.Context, name, version string, opts InstallOptions) (<-chan InstallEvent, error)
```

**Steps:**
1. Download `.mcpkg` from registry (or local path)
2. Verify SHA-256 checksum
3. Parse and validate `manifest.json`
4. Build dependency graph — topological sort
5. For each component in order:
   - `container`: validate image reference, register `ContainerConfig` + `Service`
   - `process/bundled`: extract binary to `data/<app>/<component>/`, register `Service`
   - `process/acquire`: run `AcquisitionService.Install(provider, ...)`, register `Service`
6. Run `postInstall` script if present
7. Return registered service IDs to caller

---

## Acquisition Service

`internal/services/acquisition_service.go` — platform-aware package acquisition.

```go
type AcquisitionService struct {
    platform Platform  // detected: windows | linux-deb | linux-rpm | macos
    log      *zap.Logger
}

func (a *AcquisitionService) Install(ctx context.Context, acquire AcquireConfig, onProgress func(string)) error
func (a *AcquisitionService) IsInstalled(name string) bool
func (a *AcquisitionService) Uninstall(ctx context.Context, name string) error
```

Each provider is a small adapter:

```go
type Provider interface {
    Install(ctx context.Context, pkg PackageRef, onProgress func(string)) error
    IsAvailable() bool  // is this provider present on the system?
}

// Implementations:
// ChocolateyProvider, AptProvider, DnfProvider, BrewProvider, DownloadProvider, WingetProvider
```

`DownloadProvider` handles direct URLs: downloads to temp, verifies checksum, extracts archive (`.tar.gz`, `.zip`, `.deb`, `.exe`), places binary in target path.

---

## CLI Commands

```bash
# Install from registry
mc install my-saas                         # latest version
mc install my-saas@2.1.0                  # specific version
mc install my-saas --env POSTGRES_PASSWORD=secret

# Install from local package
mc install ./my-saas-2.1.0.mcpkg

# Inspect before installing
mc inspect my-saas@2.1.0                  # show components + env vars needed

# Build a package
mc package init                           # scaffold manifest.json
mc package validate                       # validate manifest
mc package build                          # create .mcpkg
mc package push                           # build + push to registry

# Registry browsing
mc registry list                          # list all packages
mc registry search postgres               # search packages
mc registry show my-saas                  # show package details
mc registry versions my-saas             # list available versions
```

---

## Data Model

```go
// Package represents a package registered in the local registry index
type Package struct {
    ID          string    `gorm:"type:text;primaryKey" json:"id"`
    Name        string    `gorm:"type:text;not null;uniqueIndex:idx_pkg_name_ver" json:"name"`
    Version     string    `gorm:"type:text;not null;uniqueIndex:idx_pkg_name_ver" json:"version"`
    Description string    `gorm:"type:text" json:"description"`
    Author      string    `gorm:"type:text" json:"author"`
    Tags        string    `gorm:"type:text" json:"tags"`        // JSON []string
    Manifest    string    `gorm:"type:text;not null" json:"manifest"` // raw manifest.json
    FilePath    string    `gorm:"type:text" json:"filePath"`
    Checksum    string    `gorm:"type:text" json:"checksum"`    // sha256:...
    SizeBytes   int64     `json:"sizeBytes"`
    IsLatest    bool      `gorm:"not null;default:false" json:"isLatest"`
    UploadedAt  time.Time `json:"uploadedAt"`
}

// PackageInstallation tracks what was installed from a package
type PackageInstallation struct {
    ID          string    `gorm:"type:text;primaryKey" json:"id"`
    PackageName string    `gorm:"type:text;not null" json:"packageName"`
    Version     string    `gorm:"type:text;not null" json:"version"`
    AppID       string    `gorm:"type:text" json:"appId"`
    Components  string    `gorm:"type:text" json:"components"` // JSON map[componentName]serviceID
    InstalledAt time.Time `json:"installedAt"`
    Status      string    `gorm:"type:text" json:"status"` // installed | failed | uninstalled
}
```

---

## Security

- **Checksums:** All downloads (registry pull + direct URL) must verify SHA-256 before extraction. Installation aborts on mismatch.
- **Script sandboxing:** `preInstall`/`postInstall` scripts run as a restricted user (not root) unless the user explicitly grants elevated permissions via a confirmation prompt.
- **Acquisition permissions:** Chocolatey/apt/dnf installs require confirmation from the user the first time a system-level package manager is invoked.
- **Private registries:** Container image credentials stored in MiniCluster's encrypted credential store; never written to `manifest.json`.
- **Package signing:** Future — manifest signature verification using Ed25519.

---

## Phased Delivery

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase A** | Schema v2.0 (components array), manifest validator, backward compat | 1 week |
| **Phase B** | `bundled` process + `container` image components, install SSE endpoint | 1.5 weeks |
| **Phase C** | `acquire` providers: `download` + `chocolatey` + `apt` | 1.5 weeks |
| **Phase D** | `dependsOn` ordering, `fromComponent` env binding, `brew`/`dnf` | 1 week |
| **Total** | | **~5 weeks** |

---

## Acceptance Criteria

- [ ] A v1.0 manifest (single process component) installs without changes
- [ ] A mixed manifest with 1 container + 1 process installs both components
- [ ] `dependsOn` ordering is respected — containers start before dependent processes
- [ ] `fromComponent` injects correct runtime env vars
- [ ] `acquire.windows.chocolatey` installs via Chocolatey on Windows
- [ ] `acquire.linux-deb.apt` installs via apt on Debian/Ubuntu
- [ ] `acquire.direct.download` downloads, verifies checksum, extracts binary cross-platform
- [ ] Invalid manifests (cycle, missing dep, unknown type) are rejected with a clear error
- [ ] Install progress streams to client via SSE
- [ ] `mc inspect my-saas` shows components and required env vars before installation
- [ ] Installed packages are tracked in `PackageInstallation` for auditing
