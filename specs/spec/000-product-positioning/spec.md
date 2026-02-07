# MiniCluster Product Positioning

> **"Ship to bare metal like you ship to the cloud."**
> 
> **"Start simple. Scale without switching."**

---

## What MiniCluster Is

A **self-hosted application platform** that ships as a single binary and reveals itself in stages.

At the bottom it's a process manager. At the top it's a multi-node, auto-scaling platform runtime with its own package format, identity system, and config service. The user only encounters the complexity they need.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MINICLUSTER PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STAGE 1 — THE RUNTIME          (ship first, win PM2/Supervisor users)     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Process    │  │  Reverse    │  │  Versioning │  │  .mcpkg     │       │
│  │  Manager    │  │  Proxy      │  │  & Rollback │  │  Packages   │       │
│  │  ──────────│  │  ──────────│  │  ──────────│  │  ──────────│       │
│  │  Run, stop, │  │  YARP, TLS, │  │  Snapshots, │  │  Bundle,    │       │
│  │  restart,   │  │  domains,   │  │  blue-green, │  │  version,   │       │
│  │  health chk │  │  routes     │  │  one-click  │  │  distribute │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  STAGE 2 — THE PLATFORM         (emerge as users grow)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Discovery  │  │  Identity   │  │  Config     │  │  Registry   │       │
│  │  ──────────│  │  ──────────│  │  ──────────│  │  ──────────│       │
│  │  .well-     │  │  OIDC,      │  │  Pull-based │  │  .mcpkg     │       │
│  │  known,     │  │  users,     │  │  desired    │  │  storage,   │       │
│  │  bootstrap  │  │  SSO, API   │  │  state,     │  │  download,  │       │
│  │             │  │  tokens     │  │  converge   │  │  lifecycle  │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  STAGE 3 — THE FLEET            (scale without switching)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Clustering │  │  Auto-      │  │  Containers │  │  Plugins    │       │
│  │  ──────────│  │  Scaling    │  │  ──────────│  │  ──────────│       │
│  │  Multi-node,│  │  ──────────│  │  Docker/    │  │  Open SDK,  │       │
│  │  heartbeat, │  │  Cloud VMs, │  │  Podman as  │  │  marketplace│       │
│  │  failover   │  │  scale-to-  │  │  optional   │  │  ecosystem  │       │
│  │             │  │  zero       │  │  runtime    │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED CONTROL PLANE                             │   │
│  │                                                                      │   │
│  │   Web UI  ←→  CLI  ←→  REST API  ←→  SQLite  +  TimescaleDB         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Hierarchical Apps** | Apps contain services (processes) and child apps. Tree structure. Cascade operations. |
| **Versioning** | Version apps AND individual services. Rollback anything. Atomic snapshots. |
| **Multi-Node Cluster** | Control 5, 50, or 500 servers from one dashboard. API-based agents. |
| **Cron Scheduling** | Run jobs on schedule. Dependency chains. Missed schedule handling. |
| **Open Plugin System** | Anyone can build plugins. Backend (.NET) + Frontend (React) SDKs. Marketplace. |
| **Analytics & Decision Support** | Reports on memory, CPU, disk, network, errors, and trends for all apps/services. AI-powered recommendations and anomaly detection. |
| **Integrated Observability** | Logs, metrics, health checks, traces. All built-in. |
| **Reverse Proxy** | YARP built-in, plus plugin support for Nginx, Caddy, Traefik. |
| **No Containers Required** | Native processes. Containers optional. Windows-first. |

---

## Target Market

MiniCluster is for teams who need Kubernetes-like orchestration but can't justify Kubernetes-like complexity.

### Ideal Customers

| Segment | Description |
|---------|-------------|
| **Windows Shops** | .NET teams, legacy Windows apps, no Linux expertise |
| **Small Teams** | 1-5 devs, no dedicated DevOps engineer |
| **Edge/IoT** | Resource-constrained devices, can't run K8s |
| **Dev Environments** | Local development, testing, staging |
| **SMB** | Small business, 5-50 servers, no K8s budget |
| **MSPs** | Managed service providers managing many client servers |
| **Plugin Developers** | Infrastructure tool vendors wanting easy integration |

### Not For

| Scenario | Use Instead |
|----------|-------------|
| 100+ services per app | Kubernetes |
| 1000+ replicas | Kubernetes |
| Multi-cloud federation | Kubernetes |
| Team >20 devs | Kubernetes |
| GPU/ML workloads | Kubernetes |
| Heavy CI/CD pipelines | Kubernetes + ArgoCD |

---

## MiniCluster vs Kubernetes

| Factor | Kubernetes | MiniCluster |
|--------|------------|-------------|
| **Setup Time** | Hours/days | Minutes |
| **Resource Overhead** | 2GB+ RAM (control plane) | ~50MB total |
| **Windows Support** | Painful | Native, first-class |
| **Learning Curve** | 100+ concepts, YAML | Web UI, familiar concepts |
| **Small Scale** | Overkill | Sweet spot |
| **Containers Required** | Yes | No (optional) |
| **Multi-Node** | Complex (etcd, control plane) | Simple API agents |
| **Versioning** | GitOps tools needed | Built-in |
| **Scheduling** | CronJobs require YAML | UI-configured |
| **Plugins/Ecosystem** | Operators (complex) | Simple SDK |
| **Cost** | High (managed) or ops burden | Free, self-contained |

---

## MiniCluster vs Alternatives

| Product | Category | MiniCluster Advantage |
|---------|----------|----------------------|
| **PM2** | Process manager | Multi-language, clustering, UI, versioning, package registry |
| **Supervisor** | Process manager | Cross-platform, UI, clustering, OIDC, package registry |
| **systemd** | Init system | Cross-platform, UI, multi-node, versioning |
| **Coolify** | Self-hosted PaaS | No Docker required, process-native, Windows support |
| **CapRover** | Self-hosted PaaS | No Docker required, Windows, .mcpkg packages |
| **Dokku** | Self-hosted PaaS | No Docker, Windows, multi-node, UI dashboard |
| **Kamal** | Deploy tool | UI, OIDC auth, desired-state config, auto-scaling |
| **Docker Compose** | Container orchestration | No containers needed, clustering, versioning, UI |
| **Kubernetes** | Container orchestration | 10x simpler, Windows-first, no container requirement |
| **HashiCorp Nomad** | Workload orchestration | Simpler setup, better Windows, integrated UI/registry |
| **Portainer** | Container management | Native processes (not just containers), full orchestration |

**Two-level competitive positioning:**
- vs PM2/Supervisor: "Same simplicity, but with UI + proxy + clustering + packages"
- vs Coolify/CapRover/Dokku: "Same deployment platform, but without Docker dependency"

---

## The 30-Minute vs 2-Week Problem

```
┌─────────────────────────────────────────────────────────────────┐
│  "I need to run 10 services on 3 servers with scheduling,      │
│   versioning, monitoring, and a reverse proxy"                  │
│                                                                 │
│  Kubernetes:                                                    │
│  - Install Docker/containerd (licensing issues on Windows)     │
│  - Set up K8s cluster (which distro? where?)                   │
│  - Write Dockerfiles × 10                                       │
│  - Write deployment.yaml × 10                                   │
│  - Write service.yaml × 10                                      │
│  - Set up Ingress controller                                    │
│  - Configure CronJobs in YAML                                   │
│  - Set up Prometheus + Grafana                                  │
│  - Learn kubectl, helm, kustomize, ArgoCD...                   │
│  - Time: 2-4 weeks                                              │
│  - Ongoing: Constant YAML maintenance                           │
│                                                                 │
│  MiniCluster:                                                   │
│  - Install MiniCluster (one binary)                             │
│  - Add apps via UI (drag executables)                           │
│  - Group into hierarchy                                         │
│  - Configure schedules in UI                                    │
│  - Install monitoring plugin (one click)                        │
│  - Click "Start All"                                            │
│  - Time: 30 minutes                                             │
│  - Ongoing: Everything in UI                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Differentiators

### 1. Native Process First
No container overhead. Run `.exe`, `.jar`, Python scripts, Go binaries directly. Containers are optional, not mandatory.

### 2. Windows-Native
Actually works on Windows without Docker Desktop licensing or WSL2 complexity. First-class Windows citizen.

### 3. Hierarchical Applications
Apps contain services. Apps contain child apps. Tree structure mirrors how you think about systems. Cascade start/stop.

### 4. Versioning Everything
Version apps. Version individual services. Rollback with one click. Atomic snapshots. No GitOps toolchain required.

### 5. Application Package Manager
`.mcpkg` is to MiniCluster what `.deb` is to Ubuntu. Not just a process manager — a full application package manager with its own registry, manifest format, and lifecycle.

### 6. Three-Service Architecture
Identity (OIDC), Config (desired state), Registry (packages) — all in one binary. Discovery endpoint makes everything self-configuring. Enterprise-grade auth without enterprise complexity.

### 7. Pull-Based Deployment
Agents pull their desired state and self-converge. No push failures, no drift, no "what if the target is offline." Same model that won for Kubernetes, Puppet, and GitOps.

### 8. Auto-Scaling
Scale infrastructure based on load. Acquire VMs from cloud providers (Hetzner, DigitalOcean, AWS), auto-install agents, expand on demand. Scale to zero when idle. Pay only for what you use.

### 9. Open Plugin Ecosystem
**Anyone can build plugins.** Backend SDK (C#/.NET). Frontend SDK (React/TypeScript). CLI for scaffolding. Marketplace for distribution.

### 10. Integrated Observability
Logs, metrics, health checks built-in. Not 5 separate tools. TimescaleDB for high-volume telemetry.

### 9. Cron Scheduling
Schedule jobs with UI, not YAML. Dependency chains. Missed schedule handling. Run history.

---

## Shipping Stages

MiniCluster ships in three stages. Each stage is a complete, useful product on its own.
Each stage expands the audience without breaking the previous one.

### Stage 1 — The Runtime ("Better PM2")

**Ship first. Win the bottom of the market.**

| Layer | What it replaces |
|-------|------------------|
| Process manager | PM2, Supervisor, systemd units |
| Reverse proxy | nginx config, manual Caddy setup |
| Versioning & rollback | Manual deploy scripts, rsync |
| .mcpkg packages | tar.gz + prayers |
| Health checks & auto-restart | Monit, custom watchdogs |
| Web UI + CLI | SSH + PM2 CLI |

**Entry story:** "Install one binary. Run `mc deploy myapp`. Get a dashboard, proxy, and health checks in 5 minutes."

**Who this reaches:** Solo devs, small teams, indie hackers, anyone currently using PM2 or bare systemd. They don't need identity, config services, or clustering. They need *something better than what they have now*.

**Exit criteria:** First app running in <10 minutes. No external dependencies. Works on Linux, macOS, Windows.

---

### Stage 2 — The Platform ("Grow without switching")

**Emerge as users add their second server or second team member.**

| Layer | What it enables |
|-------|----------------|
| Discovery | Services find each other automatically |
| Identity (OIDC) | Users, API tokens, SSO, team access control |
| Config service | Push desired state, agents self-converge |
| Registry | Central .mcpkg storage, versioned downloads |

**Entry story:** "You added a second server? Run `mc join`. Identity, config, and registry are already built into the binary you installed in Stage 1."

**Who this reaches:** Teams growing from 1→5 servers, anyone who needs auth or multi-user access, MSPs managing client servers. They discovered MiniCluster as a PM2 replacement and now need platform features.

**Key property:** Zero migration. No new binary, no new config format, no retraining. The platform was always there — it just wasn't needed yet.

---

### Stage 3 — The Fleet ("Scale without switching")

**Scale infrastructure on demand.**

| Layer | What it enables |
|-------|----------------|
| Multi-node clustering | Heartbeat, failover, workload placement |
| Auto-scaling | Cloud VMs on demand (Hetzner, DO, AWS, Azure) |
| Containers | Docker/Podman as optional runtime type |
| Plugin ecosystem | Open SDK, marketplace, community extensions |
| Scheduling | Cron jobs, dependency chains, run history |

**Entry story:** "Traffic spiked. MiniCluster added two Hetzner VMs, deployed your app, and routed traffic — then scaled back to zero when it was over."

**Who this reaches:** Teams that would otherwise evaluate Kubernetes, Nomad, or managed PaaS. They started with one server and PM2-like simplicity. Now they need fleet management. They never had to switch tools.

---

### The Stage Sequence Is the Strategy

```
  Stage 1              Stage 2              Stage 3
  ─────────           ─────────           ─────────
  PM2 users    ──→    Platform users  ──→  Fleet operators
  1 server            2-10 servers         10-500 servers
  Solo dev            Small team           Growing org
  mc start            mc join              mc scale

  Same binary. Same CLI. Same UI. Same mental model.
```

The product is revealed, not replaced. Users never hit a wall that requires a different tool.
This is the competitive moat: **the zero-migration path from process manager to platform runtime**.

---

## Strategic Positioning

MiniCluster is NOT competing with Kubernetes head-on.

MiniCluster owns **two underserved segments simultaneously**:

**Segment 1 (Bottom-up):** Teams using PM2/Supervisor/systemd who need more.
They want a UI, clustering, proxy, health checks — but not the jump to Kubernetes.
Stage 1 gives them everything PM2 has, plus everything PM2 doesn't.

**Segment 2 (Top-down):** Teams evaluating Coolify/CapRover/Dokku who can't use Docker.
Windows shops, edge deployments, legacy apps that can't be containerized.
Stage 2+3 give them the same deployment platform experience without Docker.

**The bridge:** Both segments start with the same binary. Segment 1 users grow into
Segment 2 organically — no migration, no new tool, no retraining. The platform
is revealed progressively as they need it.

**Analogy:** SQLite vs PostgreSQL. Different use cases, both valuable. MiniCluster is
the SQLite of orchestration — embedded, zero-config, surprisingly capable.

---

## The Plugin Ecosystem Play

The **open plugin system** is a strategic differentiator:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLUGIN ECOSYSTEM FLYWHEEL                     │
│                                                                  │
│      Users                                                       │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │ Platform │ ──▶ │ Plugin Store │ ──▶ │ Developers   │        │
│  │ Adoption │     │ (value)      │     │ Build Plugins│        │
│  └──────────┘     └──────────────┘     └──────────────┘        │
│        ▲                                       │                │
│        │                                       │                │
│        └───────────────────────────────────────┘                │
│                   More plugins = more users                      │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
1. Infrastructure vendors (Nginx, Redis, PostgreSQL) want easy integration
2. Plugin developers get distribution channel
3. Users get one-click install of best-in-class tools
4. MiniCluster becomes the **universal infrastructure control plane**

---

## One-Line Pitches

| Audience | Pitch |
|----------|-------|
| **Developer** | "Manage all your services from one dashboard - processes, containers, proxies, databases - no Kubernetes required" |
| **IT Admin** | "Turn any Windows server into a managed application host. Add more servers in seconds." |
| **CTO** | "Kubernetes-like orchestration for teams that can't afford Kubernetes complexity. Plugin system for extensibility." |
| **DevOps** | "Native process orchestration with versioning, clustering, scheduling, and an open plugin ecosystem" |
| **MSP** | "Manage 100 client servers from one pane of glass. Deploy apps, schedule jobs, monitor everything." |
| **Plugin Dev** | "Build once, distribute to thousands of MiniCluster users through the marketplace" |

---

## Success Metrics

MiniCluster wins when:
- ✅ New user has first app running in <10 minutes
- ✅ No external dependencies required (no Docker, no K8s)
- ✅ Works on Windows out of the box
- ✅ Team of 1 can manage 50 services across 10 servers
- ✅ Rollback takes <30 seconds
- ✅ Zero YAML written by end user
- ✅ Plugin marketplace has 50+ plugins from community
- ✅ 3rd party infrastructure tools offer MiniCluster plugins

---

## Roadmap Summary

### Stage 1 — The Runtime

| Phase | Focus | Status |
|-------|-------|--------|
| 1. Foundation | File explorer, routing, proxy | ✅ Done |
| 2. Security | Authentication, API keys | 🔶 Partial |
| 3. Reliability | Health checks, auto-restart, dependencies | 📋 Spec |
| 4. Deployment | App versioning, rollback, blue-green | 📋 Spec |
| 5. Hierarchy | Apps as trees, groups, cascade ops | 📋 Spec |
| 6. Service Versioning | Version individual services | 📋 Spec |
| 7. Application Packages | .mcpkg format, manifest, bundling | 📋 Spec |

**Milestone:** "Better PM2" — complete, self-contained process manager with UI, proxy, packages.

### Stage 2 — The Platform

| Phase | Focus | Status |
|-------|-------|--------|
| 8. Discovery | /.well-known/minicluster-configuration, service location | 📋 Spec |
| 9. Identity & OIDC | OpenIddict, users, API tokens, SSO, scopes | 📋 Spec |
| 10. Config Service | Pull-based desired state, convergence loop | 📋 Spec |
| 11. Registry | .mcpkg storage, download, lifecycle, retention | 📋 Spec |

**Milestone:** Multi-user, multi-server platform with zero-migration from Stage 1.

### Stage 3 — The Fleet

| Phase | Focus | Status |
|-------|-------|--------|
| 12. Cluster | Multi-node, heartbeat, failover, workload placement | 📋 Spec |
| 13. Scheduling | Cron jobs, dependency chains, run history | 📋 Spec |
| 14. Containers | Docker/Podman as optional runtime.type | 📋 Spec |
| 15. Auto-Scaling | Cloud provider plugins, scaling rules, scale-to-zero | 📋 Spec |
| 16. Plugins | Open SDK, marketplace, community ecosystem | 📋 Spec |
