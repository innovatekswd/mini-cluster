# 019 — Registry Service & Package Format

> **Status:** 📋 Spec Ready  
> **Priority:** HIGH — Required for pull-based deployment  
> **Effort:** 3 weeks  
> **Dependencies:** 016 Discovery, 017 Identity  
> **Last Updated:** February 7, 2026

---

## Overview

The Registry is MiniCluster's **artifact store** — the equivalent of Docker Registry, but for application bundles. Developers push versioned ZIP packages with a manifest, and agents pull them when the Config Service says a new version is needed.

```
┌──────────────────────────────────────────────────────────────┐
│                      Registry Service                         │
│                                                               │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                    Package Store                      │   │
│   │                                                      │   │
│   │  web-frontend                                        │   │
│   │  ├── 1.0.0  (234 KB)  2026-01-15  sha256:a1b2...     │   │
│   │  ├── 1.1.0  (240 KB)  2026-01-22  sha256:c3d4...     │   │
│   │  └── 1.2.3  (245 KB)  2026-02-01  sha256:e5f6...  ★  │   │
│   │                                                      │   │
│   │  api-backend                                         │   │
│   │  ├── 1.0.0  (8.2 MB)  2026-01-10  sha256:1122...     │   │
│   │  └── 2.0.0  (8.5 MB)  2026-02-05  sha256:3344...  ★  │   │
│   │                                                      │   │
│   │  worker                                              │   │
│   │  └── 1.0.1  (1.1 MB)  2026-02-07  sha256:5566...  ★  │   │
│   │                                                      │   │
│   │  ★ = current/latest version                          │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                               │
│   Storage: Local filesystem (data/registry/)                  │
│   Future:  S3-compatible, Azure Blob, etc.                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Package Format

A MiniCluster package is a **ZIP file** containing:

```
my-app-1.2.3.mcpkg
├── manifest.json          ← required: app metadata
├── app/                   ← application files
│   ├── server.js
│   ├── package.json
│   ├── node_modules/      ← (optional: bundled deps)
│   └── ...
├── scripts/               ← optional: lifecycle scripts
│   ├── pre-install.sh
│   ├── post-install.sh
│   ├── pre-start.sh
│   └── health-check.sh
└── config/                ← optional: default config files
    ├── app.config.json
    └── .env.template
```

### File Extension

`.mcpkg` — MiniCluster Package. It's a standard ZIP file with a different extension for clarity.

---

## Manifest (manifest.json)

The manifest is the **only required file** in a package. It describes what the package contains and how to run it.

```json
{
  "name": "web-frontend",
  "version": "1.2.3",
  "description": "React frontend for the web application",
  "author": "team@company.com",
  
  "runtime": {
    "type": "process",
    "command": "node",
    "arguments": "server.js",
    "workingDirectory": "app/",
    "shell": false
  },

  "ports": [
    {
      "name": "http",
      "port": 3000,
      "protocol": "tcp",
      "expose": true
    }
  ],

  "healthCheck": {
    "type": "http",
    "path": "/health",
    "port": 3000,
    "intervalSeconds": 30,
    "timeoutSeconds": 5,
    "retries": 3,
    "startPeriodSeconds": 10
  },

  "env": {
    "NODE_ENV": {
      "default": "production",
      "description": "Node.js environment"
    },
    "PORT": {
      "default": "3000",
      "description": "HTTP listen port",
      "required": true
    },
    "API_URL": {
      "description": "Backend API URL",
      "required": true
    }
  },

  "scripts": {
    "preInstall": "scripts/pre-install.sh",
    "postInstall": "scripts/post-install.sh",
    "preStart": "scripts/pre-start.sh",
    "healthCheck": "scripts/health-check.sh"
  },

  "resources": {
    "minMemoryMB": 128,
    "maxMemoryMB": 512,
    "minDiskMB": 100
  },

  "labels": {
    "team": "frontend",
    "tier": "web"
  },

  "platform": {
    "os": ["linux", "windows"],
    "arch": ["amd64", "arm64"]
  },

  "dependencies": [],

  "minicluster": {
    "minVersion": "1.0.0"
  }
}
```

### Manifest Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Package name (lowercase, alphanumeric + hyphens) |
| `version` | Yes | SemVer version string |
| `description` | No | Human-readable description |
| `author` | No | Author or team |
| `runtime` | Yes | How to run the application |
| `runtime.type` | Yes | `process` (exec) or `docker` (container) |
| `runtime.command` | Yes* | Command to execute (*required for process type) |
| `runtime.arguments` | No | Command arguments |
| `runtime.workingDirectory` | No | Working dir relative to extraction path |
| `runtime.shell` | No | Run in shell (default: false) |
| `ports` | No | Ports the app listens on |
| `healthCheck` | No | Health check configuration |
| `env` | No | Environment variable declarations with defaults |
| `scripts` | No | Lifecycle scripts (pre-install, post-install, etc.) |
| `resources` | No | Resource requirements / limits |
| `labels` | No | Metadata labels for the package |
| `platform` | No | OS/arch compatibility |
| `dependencies` | No | Other packages this depends on (future) |
| `minicluster.minVersion` | No | Minimum MiniCluster version required |

---

## Runtime Types

### Process (Default)

Direct process execution. This is how most MiniCluster apps run.

```json
{
  "runtime": {
    "type": "process",
    "command": "dotnet",
    "arguments": "MyApp.dll",
    "workingDirectory": "app/",
    "shell": false
  }
}
```

### Docker (Future)

Container-based execution for apps that ship as images.

```json
{
  "runtime": {
    "type": "docker",
    "image": "myapp:1.2.3",
    "dockerfile": "Dockerfile",
    "buildContext": "app/"
  }
}
```

### Script

Shell script execution (for simple tools, cron-like tasks).

```json
{
  "runtime": {
    "type": "script",
    "command": "bash",
    "arguments": "app/run.sh",
    "shell": true
  }
}
```

---

## Package Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                    PACKAGE LIFECYCLE                           │
│                                                               │
│  Developer                   Registry              Agent      │
│     │                           │                     │       │
│     │  1. Build app             │                     │       │
│     │  2. Create manifest.json  │                     │       │
│     │  3. mc registry push      │                     │       │
│     │     ./my-app              │                     │       │
│     │ ────────────────────────> │                     │       │
│     │                           │  4. Validate        │       │
│     │                           │     manifest        │       │
│     │                           │  5. Compute hash    │       │
│     │                           │  6. Store ZIP       │       │
│     │                           │  7. Index metadata  │       │
│     │ <──────────────────────── │                     │       │
│     │  Package ID + version     │                     │       │
│     │                           │                     │       │
│     │  8. Assign to nodes       │                     │       │
│     │     (via Config Service)  │                     │       │
│     │                           │                     │       │
│     │                           │  9. Agent polls     │       │
│     │                           │     Config: new     │       │
│     │                           │     app version     │       │
│     │                           │ <─────────────────  │       │
│     │                           │                     │       │
│     │                           │  10. Download       │       │
│     │                           │      package        │       │
│     │                           │ ──────────────────> │       │
│     │                           │                     │       │
│     │                           │     ZIP bundle      │       │
│     │                           │ <────────────────── │       │
│     │                           │                     │       │
│     │                           │  11. Extract        │       │
│     │                           │  12. Run scripts    │       │
│     │                           │  13. Start app      │       │
│     │                           │                     │       │
└──────────────────────────────────────────────────────────────┘
```

---

## Package Build (mc registry push)

The CLI builds the package automatically from a directory:

```
┌──────────────────────────────────────────────────────────────┐
│                    PACKAGE BUILD                              │
│                                                               │
│  Input: Directory with manifest.json                          │
│                                                               │
│  my-app/                                                      │
│  ├── manifest.json                                            │
│  ├── server.js                                                │
│  ├── package.json                                             │
│  └── node_modules/                                            │
│                                                               │
│  Steps:                                                       │
│  1. Read & validate manifest.json                             │
│  2. Check required fields (name, version, runtime)            │
│  3. Apply .mcignore rules (like .gitignore)                   │
│  4. Create ZIP with manifest.json + all included files        │
│  5. Compute SHA-256 of final ZIP                              │
│  6. Name: {name}-{version}.mcpkg                              │
│  7. Upload to registry                                        │
│                                                               │
│  Output:                                                      │
│  ┌─────────────────────────────────────────────────┐          │
│  │ ✓ Package built: web-frontend-1.2.3.mcpkg       │          │
│  │   Size: 245 KB                                   │          │
│  │   Hash: sha256:e5f6a7b8c9d0...                   │          │
│  │   Files: 142                                     │          │
│  │                                                   │          │
│  │ ✓ Uploaded to registry                            │          │
│  │   Package ID: 3fa85f64-5717-4562-b3fc-2c963f66afa6│         │
│  └─────────────────────────────────────────────────┘          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### .mcignore

Like `.gitignore`, excludes files from the package:

```
# .mcignore
.git/
.env
*.log
*.tmp
__pycache__/
.vscode/
.idea/
tests/
docs/
```

---

## Storage Layout

```
data/
└── registry/
    ├── packages/
    │   ├── web-frontend/
    │   │   ├── 1.0.0/
    │   │   │   ├── package.mcpkg            (ZIP file)
    │   │   │   └── metadata.json            (cached manifest + hash)
    │   │   ├── 1.1.0/
    │   │   │   ├── package.mcpkg
    │   │   │   └── metadata.json
    │   │   └── 1.2.3/
    │   │       ├── package.mcpkg
    │   │       └── metadata.json
    │   ├── api-backend/
    │   │   ├── 1.0.0/
    │   │   └── 2.0.0/
    │   └── worker/
    │       └── 1.0.1/
    └── index.json                           (package index cache)
```

### Agent-Side Cache

Agents cache downloaded packages to avoid re-downloading on restart:

```
data/
└── cache/
    └── packages/
        ├── web-frontend-1.2.3.mcpkg
        ├── api-backend-2.0.0.mcpkg
        └── worker-1.0.1.mcpkg
```

---

## API Endpoints

### Package Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/registry/packages` | mc:read | List all packages |
| GET | `/api/registry/packages/{name}` | mc:read | List versions of a package |
| GET | `/api/registry/packages/{name}/{version}` | mc:read | Get package metadata |
| POST | `/api/registry/packages` | mc:admin, mc:operator | Upload package (multipart) |
| DELETE | `/api/registry/packages/{name}/{version}` | mc:admin | Delete a package version |
| GET | `/api/registry/packages/{name}/{version}/download` | mc:agent, mc:admin | Download package ZIP |
| GET | `/api/registry/packages/{name}/{version}/manifest` | mc:read | Get manifest only |
| GET | `/api/registry/packages/{name}/latest` | mc:read | Get latest version metadata |

### Package Search

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/registry/search?q=frontend` | mc:read | Search packages by name/label |
| GET | `/api/registry/packages/{name}/tags` | mc:read | List tags for a package |
| POST | `/api/registry/packages/{name}/{version}/tag` | mc:admin | Add tag (e.g., "stable", "canary") |

---

## Upload Flow

### POST `/api/registry/packages`

Multipart form upload:

```
POST /api/registry/packages
Content-Type: multipart/form-data
Authorization: Bearer {token}

------boundary
Content-Disposition: form-data; name="package"; filename="web-frontend-1.2.3.mcpkg"
Content-Type: application/zip

{binary ZIP data}
------boundary--
```

Or upload from directory (CLI builds the ZIP):

```bash
# Push a directory (CLI creates .mcpkg automatically)
mc registry push ./my-app

# Push a pre-built package
mc registry push ./web-frontend-1.2.3.mcpkg

# Push with specific version override
mc registry push ./my-app --version 1.2.4
```

### Server-Side Validation

```
┌──────────────────────────────────────────────────────────────┐
│                 UPLOAD VALIDATION                             │
│                                                               │
│  1. Receive multipart upload                                  │
│  2. Verify ZIP is valid                                       │
│  3. Extract manifest.json from ZIP                            │
│  4. Validate manifest:                                        │
│     ├── name: required, valid format [a-z0-9-]                │
│     ├── version: required, valid semver                       │
│     ├── runtime.type: required, known type                    │
│     └── runtime.command: required for process type            │
│  5. Check for duplicate (name + version)                      │
│     ├── If exists: 409 Conflict                               │
│     └── If new: continue                                      │
│  6. Compute SHA-256 of ZIP                                    │
│  7. Store ZIP in data/registry/packages/{name}/{version}/     │
│  8. Store metadata (manifest + hash + size + upload date)     │
│  9. Return package metadata with ID                           │
│                                                               │
│  Validation Errors:                                           │
│  • 400: No manifest.json in ZIP                               │
│  • 400: Invalid manifest (missing required fields)            │
│  • 400: Invalid semver version                                │
│  • 400: Invalid package name format                           │
│  • 409: Package {name}@{version} already exists               │
│  • 413: Package exceeds size limit (default 500MB)            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Download Flow

### GET `/api/registry/packages/{name}/{version}/download`

```
GET /api/registry/packages/web-frontend/1.2.3/download
Authorization: Bearer {agent-token}

Response:
  Status: 200
  Content-Type: application/zip
  Content-Disposition: attachment; filename="web-frontend-1.2.3.mcpkg"
  X-Package-Hash: sha256:e5f6a7b8c9d0...
  Content-Length: 250880

  {binary ZIP data}
```

Agents verify the hash after download:
```
1. Download ZIP
2. Compute SHA-256 of downloaded file
3. Compare with X-Package-Hash header
4. If match: extract and use
5. If mismatch: retry download (corruption)
```

---

## Agent Package Extraction

```
┌──────────────────────────────────────────────────────────────┐
│               AGENT PACKAGE EXTRACTION                        │
│                                                               │
│  1. Download web-frontend-1.2.3.mcpkg                         │
│  2. Verify hash                                               │
│  3. Cache in data/cache/packages/                             │
│                                                               │
│  4. Extract to app directory:                                 │
│     data/apps/web-frontend/                                   │
│     ├── manifest.json                                         │
│     ├── app/                                                  │
│     │   ├── server.js                                         │
│     │   └── ...                                               │
│     ├── scripts/                                              │
│     │   └── post-install.sh                                   │
│     └── config/                                               │
│                                                               │
│  5. Run pre-install script (if defined)                       │
│  6. Run post-install script (if defined)                      │
│  7. Create/update MiniCluster app entry from manifest         │
│  8. Apply environment variables from Config Service           │
│  9. Run pre-start script (if defined)                         │
│  10. Start the service process                                │
│                                                               │
│  UPGRADE PATH:                                                │
│  - If app already running with older version:                 │
│    a. Stop current service gracefully                         │
│    b. Back up current directory to data/apps/.backup/         │
│    c. Extract new version                                     │
│    d. Run install scripts                                     │
│    e. Start new version                                       │
│    f. Health check                                            │
│    g. If healthy: remove backup                               │
│    h. If unhealthy: rollback to backup, report error          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## DTOs

```csharp
// Package metadata response
public record PackageDto(
    Guid Id,
    string Name,
    string Version,
    string Description,
    string Author,
    string Hash,            // SHA-256 of the ZIP
    long SizeBytes,
    DateTime UploadedAt,
    string UploadedBy,
    RuntimeDto Runtime,
    List<PortDto> Ports,
    HealthCheckDto? HealthCheck,
    Dictionary<string, EnvVarDefinitionDto> Env,
    Dictionary<string, string> Labels,
    List<string> Tags
);

public record RuntimeDto(
    string Type,
    string? Command,
    string? Arguments,
    string? WorkingDirectory,
    bool Shell
);

public record PortDto(
    string Name,
    int Port,
    string Protocol,
    bool Expose
);

public record EnvVarDefinitionDto(
    string? Default,
    string? Description,
    bool Required
);

// Package list response
public record PackageListDto(
    string Name,
    string LatestVersion,
    int VersionCount,
    DateTime LastUpdated,
    string Description
);

// Package version list
public record PackageVersionDto(
    string Version,
    string Hash,
    long SizeBytes,
    DateTime UploadedAt,
    List<string> Tags
);
```

---

## Data Model

```
┌──────────────────────┐     ┌──────────────────────┐
│  RegistryPackage     │     │  PackageVersion      │
│                      │     │                      │
│  Id (Guid)           │     │  Id (Guid)           │
│  Name                │────>│  PackageId           │
│  Description         │     │  Version (SemVer)    │
│  Author              │     │  Hash (SHA-256)      │
│  CreatedAt           │     │  SizeBytes           │
│  UpdatedAt           │     │  ManifestJson        │
│  LatestVersion       │     │  StoragePath         │
│                      │     │  UploadedAt          │
└──────────────────────┘     │  UploadedBy          │
                             │  IsLatest            │
                             └──────────────────────┘

                             ┌──────────────────────┐
                             │  PackageTag          │
                             │                      │
                             │  Id (Guid)           │
                             │  VersionId           │
                             │  Tag                 │
                             │  CreatedAt           │
                             └──────────────────────┘
```

---

## Configuration

```json
{
  "Registry": {
    "StoragePath": "data/registry",
    "MaxPackageSizeMB": 500,
    "RetentionPolicy": {
      "MaxVersionsPerPackage": 10,
      "DeleteUntaggedAfterDays": 30
    },
    "AllowOverwrite": false,
    "RequireManifest": true
  }
}
```

---

## CLI Commands

```bash
# === PUSH ===

# Push a directory (builds .mcpkg from directory with manifest.json)
mc registry push ./my-app
# ✓ Built: web-frontend-1.2.3.mcpkg (245 KB, 142 files)
# ✓ Uploaded to registry
# Package ID: 3fa85f64-5717-4562-b3fc-2c963f66afa6

# Push with version override
mc registry push ./my-app --version 1.2.4

# Push a pre-built .mcpkg file
mc registry push ./web-frontend-1.2.3.mcpkg

# === LIST ===

# List all packages
mc registry list
# NAME             LATEST    VERSIONS  UPDATED
# web-frontend     1.2.3     3         2026-02-01
# api-backend      2.0.0     2         2026-02-05
# worker           1.0.1     1         2026-02-07

# List versions of a package
mc registry versions web-frontend
# VERSION  HASH           SIZE    DATE        TAGS
# 1.2.3    sha256:e5f6..  245 KB  2026-02-01  latest, stable
# 1.1.0    sha256:c3d4..  240 KB  2026-01-22
# 1.0.0    sha256:a1b2..  234 KB  2026-01-15

# === PULL ===

# Download a package to current directory
mc registry pull web-frontend
# ✓ Downloaded web-frontend-1.2.3.mcpkg (245 KB)

# Download specific version
mc registry pull web-frontend --version 1.1.0

# === INSPECT ===

# View package manifest
mc registry inspect web-frontend
mc registry inspect web-frontend --version 1.1.0

# === TAG ===

# Tag a version
mc registry tag web-frontend 1.2.3 stable

# === DELETE ===

# Delete a version (admin only)
mc registry delete web-frontend 1.0.0

# === INIT ===

# Initialize a manifest.json in current directory
mc registry init
# Creates manifest.json with interactive prompts:
# Package name: my-app
# Version: 1.0.0
# Runtime command: node server.js
# Port: 3000
# ✓ Created manifest.json
```

---

## Example: Full Workflow

```
┌──────────────────────────────────────────────────────────────┐
│              COMPLETE DEPLOYMENT WORKFLOW                      │
│                                                               │
│  Developer's machine:                                         │
│  ┌────────────────────────────────────────────────┐           │
│  │  1. Build the app                              │           │
│  │     npm run build                              │           │
│  │                                                │           │
│  │  2. Write manifest.json (or mc registry init)  │           │
│  │     {                                          │           │
│  │       "name": "web-frontend",                  │           │
│  │       "version": "1.2.3",                      │           │
│  │       "runtime": {                             │           │
│  │         "command": "node",                     │           │
│  │         "arguments": "server.js"               │           │
│  │       },                                       │           │
│  │       "ports": [{ "port": 3000 }]              │           │
│  │     }                                          │           │
│  │                                                │           │
│  │  3. Push to registry                           │           │
│  │     mc registry push ./dist                    │           │
│  │     ✓ Uploaded web-frontend-1.2.3.mcpkg        │           │
│  └────────────────────────────────────────────────┘           │
│                                                               │
│  Admin (CLI or UI):                                           │
│  ┌────────────────────────────────────────────────┐           │
│  │  4. Assign to nodes                            │           │
│  │     mc config assign web-frontend \            │           │
│  │       --selector role=web                      │           │
│  │                                                │           │
│  │  5. Set env vars                               │           │
│  │     mc config env set \                        │           │
│  │       --app web-frontend \                     │           │
│  │       API_URL=http://api:5000                  │           │
│  └────────────────────────────────────────────────┘           │
│                                                               │
│  Automatic (Agents):                                          │
│  ┌────────────────────────────────────────────────┐           │
│  │  6. Agent polls desired state                  │           │
│  │     → sees web-frontend 1.2.3 assigned         │           │
│  │                                                │           │
│  │  7. Downloads web-frontend-1.2.3.mcpkg         │           │
│  │                                                │           │
│  │  8. Extracts, runs post-install, starts        │           │
│  │                                                │           │
│  │  9. Reports: "converged, web-frontend running" │           │
│  └────────────────────────────────────────────────┘           │
│                                                               │
│  Dashboard shows:                                             │
│  ┌────────────────────────────────────────────────┐           │
│  │  web-frontend  v1.2.3  2/2 nodes  ✓ converged │           │
│  └────────────────────────────────────────────────┘           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Security

### Package Integrity

```
Upload:
  ZIP → SHA-256 → stored as package hash
  
Download:
  Agent receives ZIP + X-Package-Hash header
  Agent computes SHA-256 of downloaded ZIP
  Compare → match: trust, mismatch: reject + retry
```

### Access Control

```
Upload:     mc:admin or mc:operator (only authorized users push packages)
Download:   mc:agent or mc:admin    (agents pull, admins can download)
Delete:     mc:admin only           (prevent accidental deletion)
Read/List:  mc:read                 (anyone authenticated can browse)
```

### Manifest Signing (Future)

```json
{
  "name": "web-frontend",
  "version": "1.2.3",
  "signature": {
    "algorithm": "RS256",
    "keyId": "signing-key-2026",
    "value": "base64-encoded-signature"
  }
}
```

---

## Size Limits & Cleanup

```
┌──────────────────────────────────────────────────────────────┐
│                 RETENTION POLICY                              │
│                                                               │
│  MaxPackageSizeMB: 500                                        │
│  ├── Individual upload limit                                  │
│  └── Reject with 413 if exceeded                              │
│                                                               │
│  MaxVersionsPerPackage: 10                                    │
│  ├── Keep latest 10 versions per package                      │
│  ├── Older versions auto-deleted (FIFO)                       │
│  └── Tagged versions exempt from cleanup                      │
│                                                               │
│  DeleteUntaggedAfterDays: 30                                  │
│  ├── Untagged versions older than 30 days                     │
│  ├── Deleted by background cleanup service                    │
│  └── "latest" tag is always auto-applied to newest            │
│                                                               │
│  Storage Monitoring:                                          │
│  ├── Total registry size exposed via /api/registry/stats      │
│  ├── Alert when disk usage > 80%                              │
│  └── Dashboard shows storage utilization                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] `POST /api/registry/packages` accepts multipart ZIP upload
- [ ] Manifest validation rejects invalid packages with clear error messages
- [ ] SHA-256 hash computed and stored for every package
- [ ] `GET /packages/{name}/{version}/download` serves ZIP with hash header
- [ ] Version uniqueness enforced (409 Conflict on duplicate name+version)
- [ ] Package listing and search work with pagination
- [ ] `.mcignore` respected during CLI package build
- [ ] `mc registry push ./dir` builds and uploads package
- [ ] `mc registry pull name` downloads latest version
- [ ] `mc registry init` creates template manifest.json
- [ ] Tags work (add, list, delete)
- [ ] Retention policy auto-cleans old untagged versions
- [ ] Storage layout organized by name/version
- [ ] Agent download includes hash verification
- [ ] Agent caches packages locally
- [ ] Upgrade path: stop → backup → extract → start → health check → cleanup/rollback
- [ ] Size limits enforced (413 on oversized uploads)
- [ ] Access control: upload requires mc:admin/mc:operator, download allows mc:agent

---

## Related Specs

| Spec | Relationship |
|------|-------------|
| [016 — Discovery](../016-discovery-services/spec.md) | Registry endpoint advertised via discovery |
| [017 — Identity/OIDC](../017-identity-oidc/spec.md) | Auth for upload/download access control |
| [018 — Config Service](../018-config-service/spec.md) | Config references packages by ID, agents download from Registry |
| [010 — Multi-Node Cluster](../010-multi-node-cluster/spec.md) | Agents use Registry for package downloads |
