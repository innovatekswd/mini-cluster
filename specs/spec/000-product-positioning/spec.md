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
│  │  Process    │  │  Reverse    │  │  Versioning │  │  Hierarchical│       │
│  │  Manager    │  │  Proxy      │  │  & Rollback │  │  Apps        │       │
│  │  ──────────│  │  ──────────│  │  ──────────│  │  ──────────│       │
│  │  Run, stop, │  │  YARP, TLS, │  │  Snapshots, │  │  Tree view,  │       │
│  │  restart,   │  │  domains,   │  │  blue-green, │  │  cascade,    │       │
│  │  health chk │  │  routes     │  │  one-click  │  │  subtree ops │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │  Cron       │  │  Containers │  │  Alerting   │                        │
│  │  Scheduling │  │  ──────────│  │  ──────────│                        │
│  │  ──────────│  │  Docker/    │  │  Threshold  │                        │
│  │  6-field,   │  │  Podman as  │  │  rules on   │                        │
│  │  run history│  │  optional   │  │  CPU/memory │                        │
│  │             │  │  runtime    │  │  /disk      │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                             │
│  STAGE 2 — OBSERVABILITY        (see what your apps are doing)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │  mc-telemetry (Companion App)                   │                        │
│  │  ──────────────────────────────────────────────│                        │
│  │  OTLP receiver (gRPC + HTTP) │ Structured logs │                        │
│  │  Traces & spans              │ App-level metrics│                        │
│  │  Own SQLite DB               │ Embedded web UI  │                        │
│  │  Forward to Seq/Grafana/Loki │ Query API        │                        │
│  └─────────────────────────────────────────────────┘                        │
│                                                                             │
│  STAGE 3 — THE PLATFORM + CLUSTER (add a second server)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Discovery  │  │  Identity   │  │  Config     │  │  Registry   │       │
│  │  ──────────│  │  ──────────│  │  ──────────│  │  ──────────│       │
│  │  .well-     │  │  OIDC,      │  │  Pull-based │  │  .mcpkg     │       │
│  │  known,     │  │  users,     │  │  desired    │  │  storage,   │       │
│  │  bootstrap  │  │  SSO, API   │  │  state,     │  │  download,  │       │
│  │             │  │  tokens     │  │  converge   │  │  lifecycle  │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│  ┌─────────────┐                                                           │
│  │  Clustering │                                                           │
│  │  ──────────│                                                           │
│  │  Multi-node,│                                                           │
│  │  heartbeat, │                                                           │
│  │  failover   │                                                           │
│  └─────────────┘                                                           │
│                                                                             │
│  STAGE 4 — THE FLEET            (scale without switching)                  │
│  ┌─────────────┐  ┌─────────────┐                                          │
│  │  Auto-      │  │  Plugins    │                                          │
│  │  Scaling    │  │  ──────────│                                          │
│  │  ──────────│  │  Open SDK,  │                                          │
│  │  Cloud VMs, │  │  marketplace│                                          │
│  │  scale-to-  │  │  ecosystem  │                                          │
│  │  zero       │  │             │                                          │
│  └─────────────┘  └─────────────┘                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED CONTROL PLANE                             │   │
│  │                                                                      │   │
│  │   Web UI  ←→  CLI  ←→  REST API  ←→  SQLite (embedded)              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Hierarchical Apps** | Apps contain services (processes) and child apps. Tree structure. Cascade operations. ✅ Done |
| **Versioning** | Version apps AND individual services. Rollback anything. Atomic snapshots. ✅ Done |
| **Cron Scheduling** | Run jobs on schedule. 6-field expressions. Run history tracking. ✅ Done |
| **Container Support** | Docker/Podman as optional runtime. Image, ports, volumes, labels. ✅ Done |
| **Alerting** | Threshold rules on CPU/memory/disk/restarts. Webhook/email/SignalR notifications. 📋 Planned |
| **Companion App Observability** | mc-telemetry: standalone OTLP receiver with own DB, UI, and query API. 📋 Planned |
| **Multi-Node Cluster** | Control 5, 50, or 500 servers from one dashboard. API-based agents. 📋 Planned |
| **Open Plugin System** | Anyone can build plugins. Backend (.NET) + Frontend (React) SDKs. Marketplace. 📋 Planned |
| **Integrated Process Metrics** | Real-time CPU, memory, restarts, uptime for all services. Built-in. ✅ Done |
| **Reverse Proxy** | YARP built-in. Domain routing, TLS, per-service proxy rules. ✅ Done |
| **No Containers Required** | Native processes first. Containers optional. Cross-platform. ✅ Done |

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

### 2. Cross-Platform, Windows-Native
Actually works on Windows without Docker Desktop licensing or WSL2 complexity. First-class Windows citizen. Also runs natively on Linux and macOS.

### 3. Hierarchical Applications
Apps contain services. Apps contain child apps. Tree structure mirrors how you think about systems. Cascade start/stop. ✅ Shipped.

### 4. Versioning Everything
Version apps. Version individual services. Rollback with one click. Atomic snapshots. No GitOps toolchain required. ✅ Shipped.

### 5. Companion App Architecture
Observability, identity, config, and registry ship as **companion apps** — separate processes with their own DBs and UIs, managed by MiniCluster like any other service. Same pattern as Seq, Jaeger, or Grafana — but deeply integrated and auto-managed. No manual Docker Compose stacks.

### 6. Progressive Disclosure
Four stages, one binary. Stage 1 is a process manager. Stage 4 is a fleet orchestrator. Users only encounter the complexity they need. No migration friction between stages.

### 7. Pull-Based Deployment
Agents pull their desired state and self-converge. No push failures, no drift, no "what if the target is offline." Same model that won for Kubernetes, Puppet, and GitOps.

### 8. Integrated Process Metrics & Alerting
Real-time CPU, memory, disk, restart tracking built into the runtime. Threshold-based alerting on existing metrics — no external monitoring stack required. OTLP observability available as optional companion app.

### 9. Cron Scheduling
Schedule jobs with UI, not YAML. 6-field cron expressions. Run history tracking. ✅ Shipped.

### 10. Open Plugin Ecosystem
**Anyone can build plugins.** Backend SDK (C#/.NET). Frontend SDK (React/TypeScript). CLI for scaffolding. Marketplace for distribution.

### 11. SQLite-Embedded Storage
No external database dependencies. Control DB + Logs DB + Telemetry DB — all SQLite with WAL mode. Zero infrastructure requirements beyond the binary itself.

---

## Shipping Stages

MiniCluster ships in **four stages**. Each stage is a complete, useful product on its own.
Each stage expands the audience without breaking the previous one.

### Stage 1 — The Runtime ("Better PM2")

**Ship first. Win the bottom of the market.**

| Layer | What it replaces | Status |
|-------|------------------|--------|
| Process manager | PM2, Supervisor, systemd units | ✅ Done |
| Reverse proxy | nginx config, manual Caddy setup | ✅ Done |
| Versioning & rollback | Manual deploy scripts, rsync | ✅ Done |
| Health checks & auto-restart | Monit, custom watchdogs | ✅ Done |
| Web UI + CLI | SSH + PM2 CLI | ✅ Done |
| Hierarchical apps | Flat lists, manual grouping | ✅ Done |
| Cron scheduling | crontab, manual scripts | ✅ Done |
| Container support | Docker Compose (without orchestration) | ✅ Done |
| Alerting & thresholds | External monitoring tools | 📋 Planned |

**Entry story:** "Install one binary. Run `mc deploy myapp`. Get a dashboard, proxy, and health checks in 5 minutes."

**Who this reaches:** Solo devs, small teams, indie hackers, anyone currently using PM2 or bare systemd. They don't need identity, config services, or clustering. They need *something better than what they have now*.

**Exit criteria:** First app running in <10 minutes. No external dependencies. Works on Linux, macOS, Windows.

---

### Stage 2 — Observability ("See what your apps are doing")

**Structured telemetry via a companion app — not embedded, not external.**

| Layer | What it enables | Status |
|-------|----------------|--------|
| mc-telemetry companion app | OTLP receiver, structured logs, traces, metrics | 📋 Planned |
| Embedded telemetry UI | Query logs/traces without external tools | 📋 Planned |
| Forward to external backends | Seq, Grafana, Loki, Jaeger integration | 📋 Planned |

**Entry story:** "Run `mc telemetry enable`. MiniCluster deploys mc-telemetry as a managed companion. Your apps send OTLP — structured logs, traces, and metrics appear instantly."

**Who this reaches:** Teams ready to move beyond stdout logs. They want application-level observability without deploying Prometheus + Grafana + Loki + Jaeger + Seq. One command, zero infra.

**Key property:** mc-telemetry is a **companion app** — a separate .NET process with its own SQLite DB, its own API, its own embedded UI. MiniCluster manages it like any other service but integrates deeply: service details show OTLP data, dashboard shows telemetry widgets, forwarding is configurable.

**Architecture pattern:** This establishes the **companion app pattern** reused in Stage 3 for discovery, identity, config, and registry.

---

### Stage 3 — The Platform + Cluster ("Add a second server")

**Emerge as users add their second server. Platform services and clustering ship together — they're inseparable.**

| Layer | What it enables | Status |
|-------|----------------|--------|
| Discovery | Services find each other automatically | 📋 Planned |
| Identity (OIDC) | Users, API tokens, SSO, team access control | 📋 Planned |
| Config service | Push desired state, agents self-converge | 📋 Planned |
| Registry | Central .mcpkg storage, versioned downloads | 📋 Planned |
| Multi-node clustering | Heartbeat, failover, workload placement | 🚜 In Progress |

**Entry story:** "You added a second server? Run `mc join`. The agent discovers, authenticates, pulls config, downloads packages, and converges — automatically."

**Who this reaches:** Teams growing from 1→5 servers, anyone who needs auth or multi-user access, MSPs managing client servers. They discovered MiniCluster as a PM2 replacement and now need platform features.

**Key property:** Zero migration. No new binary, no new config format, no retraining. The platform was always there — it just wasn't needed yet. Platform services ship as companion apps (same pattern as mc-telemetry).

---

### Stage 4 — The Fleet ("Scale without switching")

**Scale infrastructure on demand.**

| Layer | What it enables | Status |
|-------|----------------|--------|
| Auto-scaling | Cloud VMs on demand (Hetzner, DO, AWS, Azure) | 📋 Planned |
| Plugin ecosystem | Open SDK, marketplace, community extensions | 📋 Planned |

**Entry story:** "Traffic spiked. MiniCluster added two Hetzner VMs, deployed your app, and routed traffic — then scaled back to zero when it was over."

**Who this reaches:** Teams that would otherwise evaluate Kubernetes, Nomad, or managed PaaS. They started with one server and PM2-like simplicity. Now they need fleet management. They never had to switch tools.

---

### The Stage Sequence Is the Strategy

```
  Stage 1              Stage 2              Stage 3                   Stage 4
  ─────────           ─────────            ─────────                 ─────────
  PM2 users    ──→    See everything  ──→  Multi-server teams  ──→   Fleet operators
  1 server            1 server             2-10 servers              10-500 servers
  Solo dev            Solo dev             Small team                Growing org
  mc start            mc telemetry enable  mc join                   mc scale

  Run             →   Watch            →   Scale                →    Fleet

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

## Roadmap

> **Full roadmap with phases, specs, effort estimates, and milestones:**  
> [specs/roadmap/roadmap.md](../../roadmap/roadmap.md)
>
> **Vision:** [specs/roadmap/vision.md](../../roadmap/vision.md)  
> **Mission:** [specs/roadmap/mission.md](../../roadmap/mission.md)
>
> Four stages: **Runtime** → **Observability** → **Platform + Cluster** → **Fleet**. See the roadmap for details.
