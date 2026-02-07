# 018 — Config Service

> **Status:** 📋 Spec Ready  
> **Priority:** HIGH — Core of pull-based deployment model  
> **Effort:** 3 weeks  
> **Dependencies:** 016 Discovery, 017 Identity, 010 Cluster (Phase 0-1)  
> **Last Updated:** February 7, 2026

---

## Overview

The Config Service is the **single source of truth** for what should run where. It stores app definitions, environment variables, and per-node desired state. Agents poll Config to know what they should be running, then converge to that state locally.

This replaces the push-based deployment model. Instead of the controller pushing configurations to agents, agents **pull** their desired state on a schedule and self-converge.

```
┌─────────────────────────────────────────────────────────────┐
│                      Config Service                          │
│                                                              │
│   ┌─────────────────┐   ┌──────────────────────────────┐    │
│   │   App Registry  │   │   Node Desired State         │    │
│   │                 │   │                              │    │
│   │ App definitions │   │  Node: prod-01               │    │
│   │ with services,  │──>│  ├── app: web-frontend       │    │
│   │ env vars, ports │   │  │   version: 1.2.3          │    │
│   │ health checks   │   │  │   env: { PORT: 3000 }     │    │
│   │                 │   │  ├── app: api-backend         │    │
│   │                 │   │  │   version: 2.0.0           │    │
│   │                 │   │  │   env: { DB_URL: ... }     │    │
│   │                 │   │  └── app: worker               │    │
│   │                 │   │      version: 1.0.0            │    │
│   └─────────────────┘   └──────────────────────────────┘    │
│                                                              │
│   ┌─────────────────┐   ┌──────────────────────────────┐    │
│   │  Config Versions│   │   Env Var Templates          │    │
│   │                 │   │                              │    │
│   │ Every change is │   │  Shared variables across     │    │
│   │ versioned with  │   │  nodes and apps.             │    │
│   │ hash + timestamp│   │  Inheritance: global →       │    │
│   │                 │   │  app → node override         │    │
│   └─────────────────┘   └──────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

1. **Desired State, not Commands.** Config describes WHAT should be running, not HOW to deploy. Agents figure out the how.
2. **Pull — never push.** Agents poll on interval. Config never initiates connections to agents.
3. **Versioned Everything.** Every config change gets a version hash. Agents compare hashes to detect changes.
4. **Environment Variable Inheritance.** Global → App → Node. More specific wins.
5. **Idempotent Convergence.** Agents can apply desired state repeatedly. Already-running services are left alone.

---

## Pull-Based Deployment Model

```
┌────────────┐           ┌──────────────┐           ┌──────────────┐
│   Agent    │           │   Config     │           │   Registry   │
│ (prod-01)  │           │   Service    │           │   Service    │
└─────┬──────┘           └──────┬───────┘           └──────┬───────┘
      │                         │                          │
      │  Every 30s:             │                          │
      │                         │                          │
      │  GET /api/config/       │                          │
      │  nodes/{id}/desired-    │                          │
      │  state                  │                          │
      │ ──────────────────────> │                          │
      │                         │                          │
      │  { version: "abc123",   │                          │
      │    apps: [              │                          │
      │      { name: "web",     │                          │
      │        version: "1.2.3",│                          │
      │        packageId: "..." │                          │
      │      }                  │                          │
      │    ],                   │                          │
      │    env_vars: {...}      │                          │
      │  }                      │                          │
      │ <────────────────────── │                          │
      │                         │                          │
      │  Compare with local     │                          │
      │  state hash             │                          │
      │                         │                          │
      │  ─── If hash matches ──>│  No action needed.       │
      │                         │  Sleep 30s.              │
      │                         │                          │
      │  ─── If hash differs ──>│                          │
      │                         │                          │
      │  Diff: "web" needs      │                          │
      │  update from 1.2.2 →    │                          │
      │  1.2.3                  │                          │
      │                         │                          │
      │  GET /api/registry/     │                          │
      │  packages/{pkgId}/      │                          │
      │  download               │                          │
      │ ────────────────────────────────────────────────>  │
      │                         │                          │
      │  ← ZIP bundle           │                          │
      │ <────────────────────────────────────────────────  │
      │                         │                          │
      │  Extract, configure,    │                          │
      │  restart service        │                          │
      │                         │                          │
      │  POST /api/config/      │                          │
      │  nodes/{id}/status      │                          │
      │  { version: "abc123",   │                          │
      │    status: "converged"} │                          │
      │ ──────────────────────> │                          │
      │                         │                          │
```

### Convergence Loop (Agent Side)

```
┌──────────────────────────────────────────────────────────────┐
│                  AGENT CONVERGENCE LOOP                       │
│                                                               │
│  while (running):                                             │
│    1. GET /api/config/nodes/{me}/desired-state                │
│       → desired = { hash, apps[], env_vars }                  │
│                                                               │
│    2. Compare desired.hash with local.hash                    │
│       → if same: sleep(interval), continue                    │
│                                                               │
│    3. Diff desired.apps vs local running apps                 │
│       → to_add:    in desired, not running locally            │
│       → to_remove: running locally, not in desired            │
│       → to_update: version/config differs                     │
│                                                               │
│    4. For each to_add / to_update:                            │
│       a. Check if package exists locally in cache             │
│       b. If not: GET /api/registry/packages/{id}/download     │
│       c. Extract to app directory                             │
│       d. Apply env vars                                       │
│       e. Start/restart service                                │
│                                                               │
│    5. For each to_remove:                                     │
│       a. Stop service gracefully                              │
│       b. Optionally clean up files                            │
│                                                               │
│    6. POST /api/config/nodes/{me}/status                      │
│       Report: hash applied, app statuses, any errors          │
│                                                               │
│    7. Update local.hash = desired.hash                        │
│                                                               │
│    8. sleep(interval)                                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Desired State Model

### Per-Node Desired State

```json
{
  "version": "sha256:a1b2c3d4e5f6...",
  "generatedAt": "2026-02-07T10:30:00Z",
  "node": {
    "machineId": "guid",
    "name": "prod-01",
    "labels": { "env": "production", "role": "web" }
  },
  "apps": [
    {
      "appId": "guid",
      "name": "web-frontend",
      "version": "1.2.3",
      "packageId": "guid",
      "services": [
        {
          "serviceId": "guid",
          "name": "web-frontend",
          "type": "Process",
          "command": "node",
          "arguments": "server.js",
          "workingDirectory": "./",
          "port": 3000,
          "healthCheck": {
            "type": "http",
            "path": "/health",
            "intervalSeconds": 30,
            "timeoutSeconds": 5
          },
          "environmentVariables": {
            "PORT": "3000",
            "NODE_ENV": "production",
            "API_URL": "http://localhost:5000"
          }
        }
      ]
    },
    {
      "appId": "guid",
      "name": "api-backend",
      "version": "2.0.0",
      "packageId": "guid",
      "services": [
        {
          "serviceId": "guid",
          "name": "api-backend",
          "type": "Process",
          "command": "dotnet",
          "arguments": "Api.dll",
          "port": 5000,
          "environmentVariables": {
            "ASPNETCORE_URLS": "http://+:5000",
            "ConnectionStrings__Default": "Host=db;Database=app"
          }
        }
      ]
    }
  ],
  "globalEnv": {
    "CLUSTER_NAME": "production",
    "LOG_LEVEL": "Information"
  }
}
```

### Version Hash

The version is a SHA-256 hash of the entire desired state document. Agents compare this single hash value to detect ANY change — apps added/removed, env vars changed, versions bumped, etc.

```
desired_state_json → SHA-256 → "sha256:a1b2c3d4..."

Agent stores: last_applied_hash = "sha256:a1b2c3d4..."
Next poll:    new desired hash  = "sha256:a1b2c3d4..."  → same → skip
              new desired hash  = "sha256:f7e8d9c0..."  → different → converge
```

---

## Environment Variable Inheritance

```
┌──────────────────────────────────────────────────────────────┐
│              ENVIRONMENT VARIABLE RESOLUTION                  │
│                                                               │
│  Layer 1: Global (cluster-wide)                               │
│  ┌────────────────────────────────┐                           │
│  │ LOG_LEVEL = "Information"      │                           │
│  │ CLUSTER_NAME = "production"    │                           │
│  │ SHARED_SECRET = "xxx"          │                           │
│  └────────────────────────────────┘                           │
│           │ inherited by all apps                             │
│           ▼                                                   │
│  Layer 2: App-level (per app definition)                      │
│  ┌────────────────────────────────┐                           │
│  │ PORT = "3000"                  │  ← overrides nothing      │
│  │ LOG_LEVEL = "Warning"          │  ← overrides global       │
│  └────────────────────────────────┘                           │
│           │ can be overridden per node                        │
│           ▼                                                   │
│  Layer 3: Node override (per app per node)                    │
│  ┌────────────────────────────────┐                           │
│  │ PORT = "3001"                  │  ← overrides app-level    │
│  │ DB_HOST = "db-prod-01.local"   │  ← new, node-specific     │
│  └────────────────────────────────┘                           │
│           │                                                   │
│           ▼                                                   │
│  Resolved for this app on this node:                          │
│  ┌────────────────────────────────┐                           │
│  │ LOG_LEVEL = "Warning"          │  ← from app               │
│  │ CLUSTER_NAME = "production"    │  ← from global            │
│  │ SHARED_SECRET = "xxx"          │  ← from global            │
│  │ PORT = "3001"                  │  ← from node override     │
│  │ DB_HOST = "db-prod-01.local"   │  ← from node override     │
│  └────────────────────────────────┘                           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## App Assignment Model

Apps are assigned to nodes via **labels** or **explicit assignment**.

### Label-Based (Declarative)

```json
{
  "appId": "guid",
  "name": "web-frontend",
  "placement": {
    "type": "label",
    "selector": { "role": "web", "env": "production" }
  }
}
```

All nodes with labels `role=web AND env=production` get this app in their desired state.

### Explicit Assignment

```json
{
  "appId": "guid",
  "name": "special-worker",
  "placement": {
    "type": "explicit",
    "nodeIds": ["machine-guid-1", "machine-guid-2"]
  }
}
```

Only the specified nodes get this app.

### All Nodes

```json
{
  "placement": {
    "type": "all"
  }
}
```

Every node in the cluster runs this app (monitoring agents, log collectors, etc.).

---

## API Endpoints

### Desired State (Agent-facing)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config/nodes/{machineId}/desired-state` | mc:agent | Get desired state for a node |
| POST | `/api/config/nodes/{machineId}/status` | mc:agent | Report convergence status |
| GET | `/api/config/nodes/{machineId}/status` | mc:admin, mc:operator | View node convergence status |

### App Definitions (Admin-facing)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config/apps` | mc:read | List all app definitions |
| POST | `/api/config/apps` | mc:admin | Create app definition |
| GET | `/api/config/apps/{id}` | mc:read | Get app definition |
| PUT | `/api/config/apps/{id}` | mc:admin, mc:operator | Update app definition |
| DELETE | `/api/config/apps/{id}` | mc:admin | Delete app definition |
| POST | `/api/config/apps/{id}/assign` | mc:admin, mc:operator | Assign app to nodes/labels |
| DELETE | `/api/config/apps/{id}/assign/{nodeId}` | mc:admin, mc:operator | Remove assignment |

### Environment Variables

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config/env/global` | mc:admin | Get global env vars |
| PUT | `/api/config/env/global` | mc:admin | Set global env vars |
| GET | `/api/config/env/apps/{appId}` | mc:admin, mc:operator | Get app env vars |
| PUT | `/api/config/env/apps/{appId}` | mc:admin, mc:operator | Set app env vars |
| GET | `/api/config/env/nodes/{nodeId}/apps/{appId}` | mc:admin, mc:operator | Get node override env vars |
| PUT | `/api/config/env/nodes/{nodeId}/apps/{appId}` | mc:admin, mc:operator | Set node override env vars |

### Config History

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config/history` | mc:admin | List config changes |
| GET | `/api/config/history/{version}` | mc:admin | Get config at version |
| POST | `/api/config/rollback/{version}` | mc:admin | Rollback to version |

---

## DTOs

```csharp
// Desired state response
public record DesiredStateDto(
    string Version,               // SHA-256 hash
    DateTime GeneratedAt,
    NodeInfoDto Node,
    List<DesiredAppDto> Apps,
    Dictionary<string, string> GlobalEnv
);

public record DesiredAppDto(
    Guid AppId,
    string Name,
    string Version,
    Guid PackageId,
    List<DesiredServiceDto> Services
);

public record DesiredServiceDto(
    Guid ServiceId,
    string Name,
    string Type,
    string Command,
    string Arguments,
    string WorkingDirectory,
    int? Port,
    HealthCheckDto? HealthCheck,
    Dictionary<string, string> EnvironmentVariables  // fully resolved
);

// Status report from agent
public record NodeStatusReportDto(
    string AppliedVersion,          // hash they converged to
    string Status,                  // "converged" | "converging" | "error"
    List<AppStatusDto> AppStatuses,
    DateTime ReportedAt
);

public record AppStatusDto(
    Guid AppId,
    string Name,
    string Version,
    string Status,      // "running" | "stopped" | "error" | "downloading"
    string? Error
);

// App definition
public record CreateConfigAppDto(
    string Name,
    string Version,
    Guid? PackageId,
    PlacementDto Placement,
    List<ServiceDefinitionDto> Services,
    Dictionary<string, string>? EnvironmentVariables
);

public record PlacementDto(
    string Type,                                    // "label" | "explicit" | "all"
    Dictionary<string, string>? LabelSelector,      // for type=label
    List<Guid>? NodeIds                             // for type=explicit
);
```

---

## Data Model

```
┌─────────────────────┐     ┌─────────────────────┐
│   ConfigApp         │     │  ConfigAppAssignment │
│                     │     │                      │
│  Id (Guid)          │     │  Id (Guid)           │
│  Name               │────>│  ConfigAppId         │
│  Version            │     │  MachineId (nullable) │
│  PackageId          │     │  LabelSelector (JSON)│
│  PlacementType      │     │  PlacementType       │
│  Services (JSON)    │     └─────────────────────┘
│  EnvironmentVars    │
│  CreatedAt          │     ┌─────────────────────┐
│  UpdatedAt          │     │  ConfigEnvVar       │
│  ConfigHash         │     │                      │
└─────────────────────┘     │  Id (Guid)           │
                            │  Scope (global/app/  │
┌─────────────────────┐     │    node)             │
│  ConfigVersion      │     │  AppId (nullable)    │
│                     │     │  NodeId (nullable)   │
│  Id (Guid)          │     │  Key                 │
│  Hash               │     │  Value (encrypted)   │
│  Snapshot (JSON)    │     │  CreatedAt           │
│  ChangedBy          │     └─────────────────────┘
│  ChangeDescription  │
│  CreatedAt          │     ┌─────────────────────┐
│                     │     │  NodeConfigStatus    │
└─────────────────────┘     │                      │
                            │  Id (Guid)           │
                            │  MachineId           │
                            │  AppliedVersion      │
                            │  Status              │
                            │  AppStatuses (JSON)  │
                            │  ReportedAt          │
                            └─────────────────────┘
```

---

## SignalR Notifications

While agents pull on interval, the controller CAN push change notifications over the existing SignalR connection to trigger an immediate pull:

```
Controller (Config Service)
    │
    │  Config change detected
    │  (admin updates app version)
    │
    ├──> SignalR: config_changed
    │    { affectedNodes: ["prod-01", "prod-02"] }
    │
    ▼
Agents listening on SignalR
    │
    │  Receive config_changed
    │  Immediately poll desired state
    │  (instead of waiting for next interval)
    │
    ▼
Faster convergence, still pull-based
(SignalR is an optimization, not required)
```

This means:
- **Without SignalR**: agents discover changes within 30s (polling interval)
- **With SignalR**: agents discover changes immediately after the notification
- **If SignalR disconnects**: agents fall back to polling — no data loss, no stuck state

---

## Cluster Dashboard Integration

The Config Service provides the data for the cluster dashboard:

```
┌────────────────────────────────────────────────────────────┐
│                   Cluster Dashboard                         │
│                                                             │
│  Nodes                      Status     Config Version       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 prod-01 (web)        converged   sha256:a1b2..   │   │
│  │ 🟢 prod-02 (web)        converged   sha256:a1b2..   │   │
│  │ 🟡 prod-03 (worker)     converging  sha256:f7e8..   │   │
│  │ 🔴 prod-04 (worker)     error       sha256:c3d4..   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Apps                     Nodes     Version    Placement    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ web-frontend           2/2       1.2.3      role=web │   │
│  │ api-backend            2/2       2.0.0      role=web │   │
│  │ worker                 1/2       1.0.1      role=wkr │   │
│  │ └─ prod-04: ERROR: port 8080 in use                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent Changes                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 10:30  admin  worker version 1.0.0 → 1.0.1          │   │
│  │ 10:15  admin  Added api-backend to role=web          │   │
│  │ 09:00  admin  Global LOG_LEVEL → Warning             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## CLI Commands

```bash
# View desired state for a node
mc config desired-state prod-01

# Assign app to nodes by label
mc config assign web-frontend --selector role=web,env=production

# Assign app to specific node
mc config assign worker --node prod-03

# Set global env var
mc config env set --global LOG_LEVEL=Warning

# Set app env var
mc config env set --app web-frontend PORT=3000

# Set per-node override
mc config env set --app web-frontend --node prod-01 PORT=3001

# View resolved env for an app on a node
mc config env resolve web-frontend --node prod-01

# View config history
mc config history

# Rollback to a version
mc config rollback sha256:a1b2c3d4

# View node convergence status
mc config status
mc config status prod-01

# Force immediate convergence check
mc config sync prod-01
```

---

## Acceptance Criteria

- [ ] `GET /api/config/nodes/{id}/desired-state` returns complete desired state with version hash
- [ ] Agent convergence loop works: poll → diff → download → apply → report
- [ ] Version hash changes when ANY part of desired state changes
- [ ] Environment variable inheritance works: global → app → node
- [ ] Label-based placement assigns apps to matching nodes
- [ ] Explicit placement assigns apps to specific nodes
- [ ] `placement: all` assigns to every registered node
- [ ] Agent status reports stored and queryable
- [ ] Config history tracks all changes with author and description
- [ ] Config rollback restores a previous version
- [ ] SignalR `config_changed` notification triggers immediate agent poll
- [ ] Dashboard shows node convergence status and app deployment state
- [ ] Env var values encrypted at rest
- [ ] Config diff between versions viewable
- [ ] CLI commands work for all config operations

---

## Related Specs

| Spec | Relationship |
|------|-------------|
| [016 — Discovery](../016-discovery-services/spec.md) | Config endpoint advertised via discovery |
| [017 — Identity/OIDC](../017-identity-oidc/spec.md) | Agent auth via Client Credentials for config pull |
| [019 — Registry](../019-registry/spec.md) | Config references packages by ID, agent downloads from Registry |
| [010 — Multi-Node Cluster](../010-multi-node-cluster/spec.md) | Agents use Config for desired state instead of push |
