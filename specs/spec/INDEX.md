# MiniCluster Feature Specifications Index

> **Last Updated:** February 4, 2026  
> **Product Vision:** The DevOps platform that works on Windows without containers

---

## 📋 Quick Status Overview

| # | Feature | Status | Priority | Effort |
|---|---------|--------|----------|--------|
| 000 | [Product Positioning](#000-product-positioning) | 📄 Reference | - | - |
| 001 | [File Explorer](#001-file-explorer) | ✅ Implemented | - | - |
| 002 | [Routing & Navigation](#002-routing-navigation) | ✅ Implemented | - | - |
| 003 | [Authentication](#003-authentication) | 🔶 Partial | High | 2 weeks |
| 004 | [Reverse Proxy](#004-reverse-proxy) | ✅ Implemented | - | - |
| 005 | [Reliability & Orchestration](#005-reliability-orchestration) | 📋 Spec Ready | High | 12-16 weeks |
| 006 | [Container Support](#006-container-support) | 📋 Spec Ready | Medium | 6-8 weeks |
| 007 | [App Versioning & Deployment](#007-app-versioning) | 📋 Spec Ready | Medium | 4-6 weeks |
| 008 | [Hierarchical Apps & Grouping](#008-hierarchical-apps) | 📋 Spec Ready | High | 3-4 weeks |
| 009 | [Service-Level Versioning](#009-service-versioning) | 📋 Spec Ready | Medium | 2-3 weeks |
| 010 | [Multi-Node Cluster](#010-multi-node-cluster) | 📋 Spec Ready | High | ~8 weeks (v1) |
| 011 | [Cron Scheduling](#011-cron-scheduling) | 📋 Spec Ready | Medium | 2 weeks |
| 012 | [Plugin System](#012-plugin-system) | 📋 Spec Ready | High | 12 weeks |
| 015 | [CLI](#015-cli) | 📋 Spec Ready | High | 6-8 weeks |

### Legend
- ✅ **Implemented** - Feature is complete and in production
- 🔶 **Partial** - Some components implemented
- 🚧 **In Progress** - Currently being developed
- 📋 **Spec Ready** - Specification complete, not started
- 💡 **Planned** - Identified but not specified
- 📄 **Reference** - Documentation, not a feature

---

## 🎯 Product Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MINICLUSTER ROADMAP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VISION: "Kubernetes-like orchestration without Kubernetes complexity"      │
│  TARGET: Windows shops, small teams (1-5), edge/IoT, SMB (5-50 servers)    │
│                                                                             │
│  PHASE 1: Foundation (COMPLETE)                                             │
│  ├── 001 File Explorer ✅                                                   │
│  ├── 002 Routing & Navigation ✅                                            │
│  └── 004 Reverse Proxy ✅                                                   │
│                                                                             │
│  PHASE 2: Security                                                          │
│  └── 003 Authentication 🔶 (JWT done, API keys pending)                     │
│                                                                             │
│  PHASE 3: Reliability (NEXT)                                                │
│  └── 005 Reliability & Orchestration 📋                                     │
│      ├── Auto-restart policies                                              │
│      ├── Health checks                                                      │
│      ├── App/Service/Process hierarchy                                      │
│      ├── Startup plans & dependencies                                       │
│      ├── OTLP & TimescaleDB observability                                   │
│      └── Marketplace templates                                              │
│                                                                             │
│  PHASE 4: Containers                                                        │
│  └── 006 Container Support 📋                                               │
│      ├── Docker/Podman integration                                          │
│      ├── Container lifecycle management                                     │
│      └── Hybrid process + container apps                                    │
│                                                                             │
│  PHASE 5: Deployment                                                        │
│  └── 007 App Versioning 📋                                                  │
│      ├── Version history                                                    │
│      ├── Rollback support                                                   │
│      ├── Blue-green deployments                                             │
│      └── Git integration                                                    │
│                                                                             │
│  PHASE 6: Hierarchy & Grouping                                              │
│  └── 008 Hierarchical Apps 📋                                               │
│      ├── Apps contain services (processes)                                  │
│      ├── Apps contain child apps (tree)                                     │
│      ├── Groups for organization                                            │
│      └── Cascade start/stop operations                                      │
│                                                                             │
│  PHASE 7: Advanced Versioning                                               │
│  └── 009 Service-Level Versioning 📋                                        │
│      ├── Version individual services                                        │
│      ├── Rollback single service                                            │
│      └── App snapshots (atomic versions)                                    │
│                                                                             │
│  PHASE 8: Cluster                                                           │
│  └── 010 Multi-Node Cluster 📋 (v2.0 Spec)                                 │
│      ├── Stateful agents (same binary, --agent mode)                        │
│      ├── API-key auth (mTLS deferred to v2)                                 │
│      ├── Env-var discovery (DNS deferred to v2)                             │
│      ├── Config drift detection (SHA256 hashing)                            │
│      └── 7 implementation phases (0-6)                                      │
│                                                                             │
│  PHASE 9: Scheduling                                                        │
│  └── 011 Cron Scheduling 📋                                                 │
│      ├── Cron-based job execution                                           │
│      ├── Dependency chains                                                  │
│      └── Missed schedule handling                                           │
│                                                                             │
│  PHASE 10: Plugin System                                                    │
│  └── 012 Plugin System 📋                                                   │
│      ├── **OPEN FOR THIRD-PARTY DEVELOPERS**                               │
│      ├── Backend SDK (.NET): IPlugin, IPluginContext                       │
│      ├── Frontend SDK (React): FrontendPlugin, extensions                  │
│      ├── Plugin CLI: new, build, dev, pack, publish                        │
│      ├── Permission & sandboxing system                                    │
│      └── Marketplace (browse, install, publish)                            │
│                                                                             │
│  PHASE 11: CLI & DevOps Tooling                                             │
│  └── 015 CLI 📋                                                             │
│      ├── Full app/service management from terminal                          │
│      ├── Zero-downtime deployments (blue-green)                             │
│      ├── Configuration as code (YAML export/import)                         │
│      ├── CI/CD integration (GitHub Actions, GitLab, etc.)                   │
│      └── Real-time log streaming                                            │
│                                                                             │
│  FUTURE                                                                     │
│  ├── 013 Secrets Management                                                 │
│  ├── 014 Backup & Restore                                                   │
│  └── 016 Windows Service Integration                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
- Position: "Kubernetes-like orchestration without Kubernetes complexity"
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
**Status:** 📋 Spec Ready  
**Spec:** [005-reliability-orchestration/spec.md](005-reliability-orchestration/spec.md)

**Summary:**  
Transform MiniCluster from a process manager into a full DevOps platform with reliability, orchestration, and observability features.

**Key Features:**
- [ ] **Auto-restart policies** (Never, OnFailure, Always, UnlessStopped)
- [ ] **Exponential backoff** with jitter for restart delays
- [ ] **Health checks** (HTTP, TCP, Exec, Process)
- [ ] **App/Service/Process hierarchy** for complex applications
- [ ] **Startup plans** with dependency graphs
- [ ] **Scheduled tasks** (cron-based restarts, maintenance)
- [ ] **OTLP integration** for logs, metrics, traces
- [ ] **TimescaleDB** for high-volume telemetry storage
- [ ] **Marketplace** for one-click template deployments

**Estimated Effort:** 12-16 weeks

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

### 007 App Versioning & Deployment
**Status:** 📋 Spec Ready  
**Spec:** [007-app-versioning/spec.md](007-app-versioning/spec.md)

**Summary:**  
Track application versions, enable rollbacks, and support deployment strategies like blue-green deployments.

**Key Features:**
- [ ] **Version history** - Track every deployment with timestamp and metadata
- [ ] **Configuration snapshots** - Save complete app config per version
- [ ] **Rollback** - One-click revert to previous version
- [ ] **Blue-green deployments** - Zero-downtime updates
- [ ] **Canary deployments** - Gradual traffic shifting
- [ ] **Git integration** - Deploy from git push (webhooks)
- [ ] **Deployment pipelines** - Multi-stage deployments
- [ ] **Audit trail** - Who deployed what and when

**Use Cases:**
- Quick rollback when new version has bugs
- Track configuration drift over time
- Automated deployments from CI/CD
- Compliance and audit requirements

**Estimated Effort:** 4-6 weeks

---

### 008 Hierarchical Apps & Grouping
**Status:** 📋 Spec Ready  
**Spec:** [008-hierarchical-apps/spec.md](008-hierarchical-apps/spec.md)

**Summary:**  
Transform from flat app lists to tree-based hierarchy where apps contain services (processes) and can contain child apps. Groups organize apps logically.

**Key Features:**
- [ ] Apps as composite (contain services/child apps)
- [ ] Services are individual processes within an app
- [ ] Groups for logical organization
- [ ] Cascade operations (start/stop propagate through tree)
- [ ] Variable inheritance (parent → child)
- [ ] Tree view UI

**Estimated Effort:** 3-4 weeks

---

### 009 Service-Level Versioning
**Status:** 📋 Spec Ready  
**Spec:** [009-service-versioning/spec.md](009-service-versioning/spec.md)

**Summary:**  
Extend versioning to individual services within apps, enabling granular rollbacks and atomic app snapshots.

**Key Features:**
- [ ] Version individual services independently
- [ ] Rollback single service without affecting others
- [ ] App snapshots (atomic version of all service versions)
- [ ] Service-level version history and diffs

**Estimated Effort:** 2-3 weeks

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

## 💡 Future Features (Not Specified)

### 016 Secrets Management
Secure storage and injection of sensitive configuration.
- Encrypted secret storage
- Environment variable injection
- Secret rotation
- Integration with external vaults (HashiCorp, Azure Key Vault)

### 017 Backup & Restore
Protect application data and configurations.
- Scheduled backups
- Configuration export/import
- Data volume backups
- Disaster recovery

### 018 Windows Service Integration
Deep integration with Windows Service Control Manager.
- Register apps as Windows Services
- Service recovery options
- Event Log integration
- Service dependencies

### 019 Auth Plugins
Plugin architecture for authentication providers.
- Pomerium (zero-trust)
- Auth0 / Okta integration
- Keycloak
- Custom OIDC providers

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
