# MiniCluster Feature Specifications

> **Last Updated:** May 2, 2026  
> **Single source of truth for all feature specs**

---

## 📋 Quick Status Overview

| # | Feature | Status | Effort |
|---|---------|--------|--------|
| 000 | [Product Positioning](#000-product-positioning) | 📄 Reference | - |
| 001 | [File Explorer](#001-file-explorer) | ✅ Implemented | - |
| 002 | [Routing & Navigation](#002-routing-navigation) | ✅ Implemented | - |
| — | Console / Terminal | ✅ Implemented | - |
| 003 | [Authentication](#003-authentication) | ✅ Implemented | - |
| 004 | [Reverse Proxy](#004-reverse-proxy) | ✅ Implemented | - |
| 005 | [Reliability & Orchestration](#005-reliability-orchestration) | 🔶 Part 1 Done | Parts 4→022, 5 future |
| 006 | [Container Support](#006-container-support) | ✅ Implemented | — |
| 007 | [Service Versioning & Deployment](#007-service-versioning) | ✅ Implemented | — |
| 008 | [Hierarchical Apps](#008-hierarchical-apps) | ✅ Implemented | — |
| 009 | [~~Service-Level Versioning~~](#009-service-versioning) | ➡️ Merged → 007 | — |
| 010 | [Multi-Node Cluster](#010-multi-node-cluster) | 🚧 Phase 0+1 Done | ~8 weeks |
| 011 | [Cron Scheduling](#011-cron-scheduling) | ✅ Implemented | — |
| 012 | [Plugin System](#012-plugin-system) | 📋 Spec Ready | 12 weeks |
| 013 | [Analytics & Decision Support](#013-analytics-decision-support) | 📋 Spec Ready | 6 weeks |
| 014 | [App Update Manager](#014-app-update-manager) | 📋 Spec Ready | 4 weeks |
| 015 | [CLI](#015-cli) | ✅ Implemented | - |
| 016 | [Discovery & Services Architecture](#016-discovery-services) | 📋 Spec Ready | 2 weeks |
| 017 | [Identity / OIDC](#017-identity-oidc) | 📋 Spec Ready | 3 weeks |
| 018 | [Config Service](#018-config-service) | 📋 Spec Ready | 3 weeks |
| 019 | [Registry & Packages](#019-registry) | 📋 Spec Ready | 3 weeks |
| 020 | [Auto-Scaling](#020-auto-scaling) | 📋 Spec Ready | 6-8 weeks |
| 021 | [Simple App Tabs](#021-simple-app-tabs) | ✅ Implemented | — |
| 022 | [mc-telemetry (OTLP Companion)](#022-otlp-telemetry) | 📋 Spec Ready | 4-5 weeks |
| 023 | [Alerting & Threshold Rules](#023-alerting) | 📋 Spec Ready | 2-3 weeks |
| 027 | [Operations Cockpit UX, Realtime & Route Alignment](#027-operations-cockpit-ux-realtime-route-alignment) | 📋 Spec Ready | 4-6 weeks |

### Legend
- ✅ **Implemented** — Feature is complete and in production
- 🔶 **Partial** — Some components implemented
- 🚧 **In Progress** — Currently being developed
- 📋 **Spec Ready** — Specification complete, not started
- 📄 **Reference** — Documentation, not a feature

## 🎯 Product Roadmap

> **Canonical roadmap:** [specs/roadmap/roadmap.md](../roadmap/roadmap.md)  
> **Vision:** [specs/roadmap/vision.md](../roadmap/vision.md)  
> **Mission:** [specs/roadmap/mission.md](../roadmap/mission.md)

Four shipping stages: **Run** (PM2 killer) → **Watch** (observability) → **Scale** (multi-server) → **Fleet** (auto-scaling). See the roadmap for full phase breakdown.

---

## 📁 Feature Details

### 000 Product Positioning
**Status:** 📄 Reference  
**Spec:** [000-product-positioning/spec.md](000-product-positioning/spec.md)  
**Business Model:** [000-product-positioning/business-model.md](000-product-positioning/business-model.md)

**Summary:**  
MiniCluster competitive positioning, target market, and differentiation from Kubernetes and alternatives.

**Key Points:**
- Target: Windows shops, small teams, edge/IoT, SMB, MSPs
- Differentiator: Native processes, no containers required, Windows-first, open plugin ecosystem
- Position: "Ship to bare metal like you ship to the cloud"
- Two entry points: simple (vs PM2/Supervisor) and platform (vs Coolify/CapRover/Dokku)
- Key differentiator: same binary scales from 1 server to 100 — zero migration
- Business Model: Open core + plugin marketplace + managed cloud + enterprise support

---

### 001 File Explorer
**Status:** ✅ Implemented  
**Spec:** [001-file-explorer/spec.md](001-file-explorer/spec.md)

**Summary:**  
Browse and edit configuration files for managed applications directly from the web UI.

**Key Features:**
- [x] File tree navigation
- [x] File content viewing
- [x] File editing with syntax highlighting
- [x] Create/delete files and folders
- [x] File upload support

---

### 002 Routing & Navigation
**Status:** ✅ Implemented  
**Spec:** [002-routing-navigation/spec.md](002-routing-navigation/spec.md)

**Summary:**  
React Router based navigation with proper URL structure and deep linking.

**Key Features:**
- [x] Client-side routing
- [x] Nested routes
- [x] Navigation sidebar
- [x] URL state management

---

### 003 Authentication
**Status:** 🔶 Partial  
**Spec:** [003-authentication/spec.md](003-authentication/spec.md)

**Summary:**  
Secure the MiniCluster API and UI with authentication and authorization.

**Key Features:**
- [x] JWT token authentication
- [x] Login/logout UI
- [ ] API key management
- [ ] Role-based access control (RBAC)
- [ ] Session management
- [ ] OAuth2/OIDC integration

**Remaining Work:**
- API key generation and validation
- User management UI
- Role definitions and enforcement

---

### 004 Reverse Proxy
**Status:** ✅ Implemented  
**Spec:** [004-reverse-proxy/spec.md](004-reverse-proxy/spec.md)

**Summary:**  
Proxy internal services (Seq, Grafana, RabbitMQ, etc.) through MiniCluster with authentication.

**Key Features:**
- [x] YARP-based reverse proxy
- [x] Path prefix routing (`/proxy/seq/...`)
- [x] Subdomain routing (nip.io/sslip.io)
- [x] Database-driven configuration
- [x] Dynamic route reload
- [x] Health check endpoints
- [x] Proxy settings management UI

---

### 005 Reliability & Orchestration
**Status:** � Part 1 Done  
**Spec:** [005-reliability-orchestration/spec.md](005-reliability-orchestration/spec.md)

**Summary:**  
Mega-spec covering reliability, orchestration, observability, and marketplace. Part 1 (auto-restart + health checks) is implemented. Parts 2 & 3 superseded by dedicated specs.

**Part Status:**
- [x] **Part 1: Reliability** — Auto-restart policies, health checks, exponential backoff (**✅ Done in MVP**)
- [ ] **Part 2: Orchestration** — ➡️ Superseded by [Spec 008](008-hierarchical-apps/spec.md)
- [ ] **Part 3: Scheduled Tasks** — ➡️ Superseded by [Spec 011](011-cron-scheduling/spec.md)
- [ ] **Part 4: Observability** — OTLP + TimescaleDB (**Future**)
- [ ] **Part 5: Marketplace** — Template ecosystem (**Future**)

**Remaining Effort:** Parts 4+5 (6-8 weeks, future)

---

### 006 Container Support
**Status:** 📋 Spec Ready  
**Spec:** [006-container-support/spec.md](006-container-support/spec.md)

**Summary:**  
Add optional container (Docker/Podman) support alongside native process management. Enables hybrid deployments where some services run as containers and others as native processes.

**Key Features:**
- [ ] Docker Engine API integration
- [ ] Podman support (rootless containers)
- [ ] Container lifecycle management (create, start, stop, remove)
- [ ] Image pull and management
- [ ] Volume and network management
- [ ] Container logs integration
- [ ] Port mapping configuration
- [ ] Environment variable injection
- [ ] Health checks for containers
- [ ] Hybrid apps (mix of processes and containers)

**Why Optional Containers:**
- Native processes are simpler for many workloads
- Windows containers are problematic (large, slow)
- Linux containers add value for standardized deployments
- User choice: use containers where they make sense

**Estimated Effort:** 6-8 weeks

---

### 007 Service Versioning & Deployment
**Status:** 📋 Spec Ready  
**Spec:** [007-app-versioning/spec.md](007-app-versioning/spec.md)

**Summary:**  
Track **Service** configuration history, enable rollbacks, and support deployment strategies. We version `Service` configs (not `App` groups). App-level snapshots capture all service versions at a point in time.

**Key Features:**
- [ ] **ServiceVersion** — Config snapshots per service, auto-versioned on save
- [ ] **Version diffs** — JSON diff between versions
- [ ] **One-click rollback** — Stop → apply old config → start
- [ ] **AppSnapshot** — Capture all service versions in an app
- [ ] **DeploymentConfig** — Per-service deployment preferences
- [ ] **Audit trail** — Who deployed what and when

**Deferred to later phases:**
- Blue-green / canary deployments
- Git integration (webhooks)

**Estimated Effort:** 3-4 weeks

> **Note:** Old spec 009 (Service-Level Versioning) has been merged into this spec.

---

### 008 Hierarchical Apps
**Status:** 📋 Spec Ready  
**Spec:** [008-hierarchical-apps/spec.md](008-hierarchical-apps/spec.md)

**Summary:**  
Allow apps to be nested inside other apps by adding `ParentAppId` to the existing `App` entity. No new entities — uses existing `App`, `Service`, and `ServiceGroup`.

**Key Features:**
- [ ] `ParentAppId` on `App` for nesting
- [ ] Tree view API (`/api/apps/tree`)
- [ ] Cascade start/stop/restart through subtree
- [ ] Cycle detection on move
- [ ] Tree view sidebar UI with drag-and-drop
- [ ] Breadcrumb navigation

**Estimated Effort:** 3-4 weeks

---

### 009 Service-Level Versioning
**Status:** ➡️ Merged into Spec 007  
**Spec:** [009-service-versioning/spec.md](009-service-versioning/spec.md)

**Summary:**  
~~Extend versioning to individual services.~~ This spec has been **merged into [Spec 007](#007-service-versioning)** since we version `Service` configs directly. There is no separate app-vs-service versioning distinction.

---

### 010 Multi-Node Cluster
**Status:** 📋 Spec Ready (v2.0 — Revised)  
**Spec:** [010-multi-node-cluster/spec.md](010-multi-node-cluster/spec.md)  
**Original:** [010-multi-node-cluster/spec-v1-original.md](010-multi-node-cluster/spec-v1-original.md)

**Summary:**  
Scale MiniCluster across machines via stateful agents. Same binary runs in `--agent` mode with its own SQLite DB. API-key auth for v1, env-var discovery, notification-only failure policy, SHA256 config drift detection.

**v1 Key Features (7 Phases):**
- [ ] Phase 0: Machine entity wiring + DB migration
- [ ] Phase 1: Agent mode (`minicluster --agent`) with own SQLite
- [ ] Phase 2: Controller ↔ Agent heartbeat & sync protocol
- [ ] Phase 3: Cross-node app deployment via controller
- [ ] Phase 4: UI cluster dashboard + multi-node views
- [ ] Phase 5: CLI cluster commands (`mc cluster add/status/deploy`)
- [ ] Phase 6: Config drift detection via SHA256 hashing

**Deferred to v2:**
- mTLS certificate auth (v1 uses API keys)
- Impersonation contexts (separate spec)
- DNS-based discovery (v1 uses env vars)
- Auto-failover (v1 uses notification-only policy)
- Rolling deployments & replication

**Estimated Effort:** ~8 weeks (v1 scope)

---

### 011 Cron Scheduling
**Status:** 📋 Spec Ready  
**Spec:** [011-cron-scheduling/spec.md](011-cron-scheduling/spec.md)

**Summary:**  
Run apps and services on cron schedules with dependency chains and missed schedule handling.

**Key Features:**
- [ ] Cron expression-based scheduling
- [ ] Target apps, services, or groups
- [ ] Actions: start, run, restart, stop
- [ ] Dependency chains (job A runs after job B)
- [ ] Missed schedule policies
- [ ] Run history with output capture

**Estimated Effort:** 2 weeks

---

### 012 Plugin System
**Status:** 📋 Spec Ready  
**Spec:** [012-plugin-system/spec.md](012-plugin-system/spec.md)

**Summary:**  
**Open plugin architecture** for backend (.NET) and frontend (React) plugins. Third-party developers can create and distribute plugins through the marketplace.

**SDKs:**
- **Backend SDK:** `IPlugin` interface, `IPluginContext`, service/route registration, isolated `AssemblyLoadContext`
- **Frontend SDK:** `FrontendPlugin` type, React components, route registration, UI extension points
- **CLI:** `@minicluster/plugin-cli` for scaffolding, building, and publishing

**Plugin Categories:**
- **Proxy:** [Caddy](012-plugin-system/examples/proxy/caddy.md), [Nginx](012-plugin-system/examples/proxy/nginx.md), [Traefik](012-plugin-system/examples/proxy/traefik.md), [HAProxy](012-plugin-system/examples/proxy/haproxy.md)
- **Cache:** [Varnish](012-plugin-system/examples/cache/varnish.md), [Redis](012-plugin-system/examples/cache/redis.md)
- **Auth:** [Pomerium](012-plugin-system/examples/auth/pomerium.md)
- **Monitoring:** [Prometheus](012-plugin-system/examples/monitoring/prometheus.md)
- **Database:** [PostgreSQL](012-plugin-system/examples/database/postgresql.md)

**Key Features:**
- [ ] **Backend plugin SDK** (IPlugin, IPluginContext, services, routes)
- [ ] **Frontend plugin SDK** (React components, routes, nav items)
- [ ] **Plugin isolation** (AssemblyLoadContext per plugin)
- [ ] **Permission system** (filesystem, process, network, config)
- [ ] **Plugin manifest** (JSON with schema, config, actions)
- [ ] **Marketplace** (browse, install, publish)
- [ ] **Plugin CLI** (new, build, dev, pack, publish)
- [ ] **UI extension points** (dashboard widgets, settings, tabs)

**Estimated Effort:** 12 weeks

---

### 013 Analytics & Decision Support
**Status:** 📋 Spec Ready  
**Spec:** [013-analytics-decision-support/spec.md](013-analytics-decision-support/spec.md)  
**Automation:** [013-analytics-decision-support/automation.md](013-analytics-decision-support/automation.md)

**Summary:**  
Resource usage analytics, error reporting, network activity monitoring, and AI-powered decision support. Includes anomaly detection, predictive insights, and automated remediation.

**Estimated Effort:** 6 weeks

---

### 014 App Update Manager
**Status:** 📋 Spec Ready  
**Spec:** [014-app-update-manager/spec.md](014-app-update-manager/spec.md)

**Summary:**  
Staged rollouts, approval workflows, update scheduling, and audit logging for application updates.

**Estimated Effort:** 4 weeks

---

### 015 CLI
**Status:** 📋 Spec Ready  
**Spec:** [015-cli/spec.md](015-cli/spec.md)  
**Goals:** [015-cli/goals.md](015-cli/goals.md)  
**Design:** [015-cli/design.md](015-cli/design.md)

**Summary:**  
Command-line interface for managing MiniCluster from the terminal. Enables DevOps automation, CI/CD integration, configuration-as-code, and zero-downtime deployments.

**Command Reference:** See [CLI_SPECIFICATION.md](CLI_SPECIFICATION.md) for detailed command documentation.

**Key Commands:**
- `mc app` - Manage applications (list, create, start, stop)
- `mc service` - Manage services (CRUD, logs, metrics)
- `mc deploy` - Zero-downtime deployments (blue-green, rolling)
- `mc config` - Export/import configuration as YAML

**Key Features:**
- [ ] **App/Service management** - Full CRUD from terminal
- [ ] **Log streaming** - Real-time `mc service logs -f`
- [ ] **Blue-green deployments** - Zero-downtime updates
- [ ] **Configuration as code** - YAML export/import
- [ ] **CI/CD integration** - Predictable exit codes, JSON output
- [ ] **Shell completion** - Bash, Zsh, Fish, PowerShell

**Technology:** Go + Cobra/Viper (single binary, <20MB)

**Estimated Effort:** 6-8 weeks

---

## � Platform Evolution

### 020 Auto-Scaling
**Status:** 💡 Planned  
**Spec:** [020-auto-scaling/spec.md](020-auto-scaling/spec.md)  
**Priority:** Medium  
**Effort:** 6-8 weeks

**Summary:**  
Scale infrastructure based on load. Acquire new VMs from cloud providers, auto-install MiniCluster agents, expand capacity. Scale down when idle — pay only for what you use.

**Phased Approach:**
- **Phase 1: One-liner install** — `curl -s https://ctrl:5147/install | bash` → agent running in 60s
- **Phase 2: Provider plugins** — `mc scale web --add 2 --provider hetzner` → VMs created + agents deployed
- **Phase 3: Auto-scale rules** — "If CPU > 80% for 5min, add node (max 10). If < 20% for 15min, remove (min 2)"

**Key Features:**
- [ ] One-liner agent install script
- [ ] Cloud provider plugins (Hetzner, DigitalOcean, Vultr, AWS, Azure)
- [ ] Scale-up rules (CPU, memory, request rate thresholds)
- [ ] Scale-down with graceful drain
- [ ] Scale-to-zero (terminate idle VMs)
- [ ] Cost-aware decisions (spot instances, reserved capacity)

---

### 006 Container Support (Later Stage)

Container support becomes a **runtime type** in the existing `.mcpkg` manifest — not a separate system.

```json
// manifest.json — container runtime (future)
{
  "runtime": {
    "type": "docker",
    "image": "myapp:1.2.3"
  }
}
```

Everything above the runtime layer stays identical: Registry stores the package, Config assigns it to nodes, agents pull and converge. Only the last step changes — `docker run` instead of `Process.Start()`.

---

### 021 Simple App Tabs
**Status:** 📋 Spec Ready  
**Spec:** [021-simple-app-tabs/spec.md](021-simple-app-tabs/spec.md)

**Summary:**  
Group services into app tabs for visual organization. Adds App entity with tabs, drag-and-drop service assignment, cascade start/stop, and per-tab overview. Foundation for hierarchical apps.

**Estimated Effort:** 1-2 weeks

---

### 027 Operations Cockpit UX, Realtime & Route Alignment
**Status:** 📋 Spec Ready  
**Spec:** [027-operations-cockpit-ux-realtime/spec.md](027-operations-cockpit-ux-realtime/spec.md)

**Summary:**  
Unifies MiniCluster into a clearer operations cockpit, aligns SignalR event contracts across .NET, Go, and React, reduces unnecessary REST polling, and standardizes frontend/backend route naming with compatibility redirects.

**Key Features:**
- [ ] Navigation rail and mobile drawer with clear page ownership
- [ ] Canonical frontend routes for apps, services, machines, monitor, explorer, automation, proxy, and settings
- [ ] SignalR contract parity for logs, status, metrics, lifecycle, and terminal events
- [ ] Reduced polling with HTTP snapshot/reconnect fallback
- [ ] Page-by-page UX requirements and shared style primitives

**Estimated Effort:** 4-6 weeks

---

## 💡 Future Features (Not Specified)

### 022 Secrets Management
Secure storage and injection of sensitive configuration.
- Encrypted secret storage
- Environment variable injection
- Secret rotation
- Integration with external vaults (HashiCorp, Azure Key Vault)

### 023 Backup & Restore
Protect application data and configurations.
- Scheduled backups
- Configuration export/import
- Data volume backups
- Disaster recovery

### 024 Windows Service Integration
Deep integration with Windows Service Control Manager.
- Register apps as Windows Services
- Service recovery options
- Event Log integration
- Service dependencies

---

## 🏗️ Services Architecture (NEW)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    MINICLUSTER — THREE-SERVICE MODEL                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  All three services run in the same binary by default.                     │
│  Discovery endpoint makes splitting transparent.                           │
│                                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐              │
│  │   Identity   │   │    Config    │   │    Registry      │              │
│  │   (017)      │   │    (018)     │   │    (019)         │              │
│  │              │   │              │   │                  │              │
│  │  WHO can     │   │  WHAT should │   │  HOW to get      │              │
│  │  do things   │   │  run WHERE   │   │  the bits        │              │
│  │              │   │              │   │                  │              │
│  │  • OIDC      │   │  • Desired   │   │  • .mcpkg        │              │
│  │  • Users     │   │    state     │   │    bundles       │              │
│  │  • JWT/JWKS  │   │  • Env vars  │   │  • Versions      │              │
│  │  • Scopes    │   │  • Labels    │   │  • Downloads     │              │
│  └──────────────┘   └──────────────┘   └──────────────────┘              │
│         │                  │                    │                          │
│         └──────────────────┼────────────────────┘                          │
│                            ▼                                               │
│          GET /.well-known/minicluster-configuration  (016)                 │
│                                                                            │
│  Clients: Agent → Client Credentials (JWT)                                 │
│           CLI   → Device Authorization Flow                                │
│           UI    → Authorization Code + PKCE                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 016 Discovery & Services Architecture
**Status:** 📋 Spec Ready  
**Spec:** [016-discovery-services/spec.md](016-discovery-services/spec.md)

**Summary:**  
Well-known discovery endpoint (`/.well-known/minicluster-configuration`) that exposes Identity, Config, and Registry service URLs. Agents, CLI, and UI bootstrap from a single URL. All three services run in the same binary by default but can be split to separate hosts.

**Key Features:**
- [ ] **Discovery endpoint** — single URL for all client bootstrap
- [ ] **Three-service model** — Identity, Config, Registry (same binary by default)
- [ ] **Service separation** — can point endpoints to different hosts
- [ ] **Agent bootstrap** — discover → authenticate → pull config → download packages
- [ ] **CLI/UI bootstrap** — discover → authenticate → use services

**Estimated Effort:** 2 weeks

---

### 017 Identity / OIDC
**Status:** 📋 Spec Ready  
**Spec:** [017-identity-oidc/spec.md](017-identity-oidc/spec.md)

**Summary:**  
Full OpenID Connect provider built on OpenIddict. Replaces custom JWT implementation with standards-based authentication. Three OIDC flows: Authorization Code+PKCE (UI), Client Credentials (agents), Device Authorization (CLI).

**Key Features:**
- [ ] **OpenIddict integration** — standard OIDC provider
- [ ] **Three auth flows** — Auth Code+PKCE, Client Credentials, Device Auth
- [ ] **JWKS endpoint** — automatic key rotation
- [ ] **Custom scopes** — mc:admin, mc:operator, mc:read, mc:agent
- [ ] **User management API** — CRUD, password reset, roles
- [ ] **External IdP support** — delegate to corporate OIDC (Keycloak, Entra ID)
- [ ] **Migration path** — backward-compatible transition from custom JWT

**Estimated Effort:** 3 weeks

---

### 018 Config Service
**Status:** 📋 Spec Ready  
**Spec:** [018-config-service/spec.md](018-config-service/spec.md)

**Summary:**  
Single source of truth for desired state. Agents pull their desired state (app definitions, versions, env vars) on a polling interval and self-converge. Replaces push-based deployment with pull-based model. Environment variable inheritance: global → app → node.

**Key Features:**
- [ ] **Desired state per node** — what apps/versions should run where
- [ ] **Pull-based convergence** — agents poll, diff, and self-converge
- [ ] **Version hashing** — SHA-256 hash for change detection
- [ ] **Env var inheritance** — global → app → node override
- [ ] **Label-based placement** — assign apps by node labels
- [ ] **Config history** — versioned changes with rollback
- [ ] **SignalR optimization** — push notifications for faster convergence

**Estimated Effort:** 3 weeks

---

### 019 Registry & Packages
**Status:** 📋 Spec Ready  
**Spec:** [019-registry/spec.md](019-registry/spec.md)

**Summary:**  
Artifact store for versioned application packages. Developers push `.mcpkg` bundles (ZIP files with `manifest.json`), agents download them when Config says a new version is needed. Includes package lifecycle, integrity verification, retention policies, and CLI commands.

**Key Features:**
- [ ] **Package format** — `.mcpkg` (ZIP + manifest.json)
- [ ] **Manifest spec** — runtime, ports, health checks, env vars, scripts
- [ ] **Upload/download API** — multipart upload, streamed download with hash
- [ ] **Version management** — semver, tagging (stable, canary), retention
- [ ] **CLI commands** — mc registry push/pull/list/inspect/init
- [ ] **Agent integration** — cache, hash verification, upgrade with rollback
- [ ] **.mcignore** — exclude files from packages (like .gitignore)

**Estimated Effort:** 3 weeks

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MINICLUSTER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │  Apps   │ │  Files  │ │  Logs   │ │  Proxy  │ │ Marketplace │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                              REST API                                       │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        BACKEND (ASP.NET Core)                        │   │
│  │                                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │ Process Mgr   │  │ Health Check  │  │ YARP Reverse Proxy    │   │   │
│  │  │ (native apps) │  │ Service       │  │                       │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │ Container Mgr │  │ Scheduler     │  │ OTLP Receiver         │   │   │
│  │  │ (Docker)      │  │ (cron jobs)   │  │                       │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    │                               │                       │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐     │
│  │        SQLite               │  │        TimescaleDB              │     │
│  │  (Config & State)           │  │  (Logs, Metrics, Traces)        │     │
│  │  - Apps, Services           │  │  - High-volume telemetry        │     │
│  │  - Proxy routes             │  │  - Compression                  │     │
│  │  - Schedules                │  │  - Retention policies           │     │
│  │  - Users                    │  │  - Continuous aggregates        │     │
│  └─────────────────────────────┘  └─────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Backend | ASP.NET Core 9 | Cross-platform, high performance |
| Frontend | React + TypeScript | Vite, React Router |
| Config DB | SQLite | Embedded, zero-config |
| Telemetry DB | TimescaleDB | Optional, for high-volume logs |
| Reverse Proxy | YARP | Microsoft's official proxy |
| Process Mgmt | System.Diagnostics.Process | Native OS processes |
| Container Mgmt | Docker.DotNet | Docker Engine API |
| Real-time | SignalR | WebSocket updates |

---

## 📝 How to Add a New Feature

1. Create folder: `spec/NNN-feature-name/`
2. Create `spec.md` with:
   - Overview and business value
   - Technical design
   - Entity/database changes
   - API endpoints
   - UI components
   - Implementation phases
3. Update this `INDEX.md` with summary
4. Create git branch: `feature/NNN-feature-name`

---

## 🔗 Quick Links

- **Repository:** (internal)
- **API Docs:** http://localhost:5147/swagger
- **UI:** http://localhost:5173

---

*This index is the source of truth for MiniCluster feature planning. Update it when feature status changes.*
