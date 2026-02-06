# MiniCluster Specifications Index

> **Version:** 4.0 (Consolidated)  
> **Last Updated:** February 2, 2026  
> **Product Vision:** Enterprise-grade DevOps orchestration without Kubernetes complexity

---

## 📊 Executive Summary

MiniCluster is a **lightweight DevOps orchestration platform** designed for:
- Windows-first environments
- Small to medium teams (1-50 users)
- Edge/IoT deployments
- MSPs managing multiple client environments

### Quick Stats

| Metric | Value |
|--------|-------|
| Total Features | 19 |
| Implemented | 5 (26%) |
| In Progress | 1 (5%) |
| Planned | 13 (69%) |
| Estimated Completion | 12-18 months |

---

## 🗂️ Specification Structure

```
spec4/
├── INDEX.md                    ← You are here
│
├── 00-overview/
│   ├── PRODUCT_VISION.md       ← Business positioning & target market
│   ├── ARCHITECTURE.md         ← Technical architecture overview
│   └── ROADMAP.md              ← Release timeline & priorities
│
├── 01-core-platform/
│   ├── PROCESS_MANAGEMENT.md   ← Service/process lifecycle
│   ├── FILE_EXPLORER.md        ← ✅ File browsing & editing
│   ├── CORE_FEATURES.md        ← ✅ Service, app, metrics (implemented)
│   ├── REVERSE_PROXY.md        ← ✅ YARP + 📋 Nginx/Caddy/Traefik/HAProxy/Varnish
│   └── ROUTING_NAVIGATION.md   ← ✅ React Router UI navigation
│
├── 02-security/
│   ├── AUTHENTICATION.md       ← 🔶 JWT, API keys, RBAC
│   └── SECRETS_MANAGEMENT.md   ← Encrypted secrets storage
│
├── 03-organization/
│   ├── APPS_AND_SERVICES.md    ← ✅ App tabs & service grouping
│   ├── HIERARCHICAL_APPS.md    ← Nested apps & tree structure
│   └── VARIABLE_GROUPS.md      ← ✅ Template variables
│
├── 04-reliability/
│   ├── HEALTH_CHECKS.md        ← HTTP/TCP/exec probes
│   ├── AUTO_RESTART.md         ← Restart policies & backoff
│   ├── STARTUP_PLANS.md        ← Dependency-based startup
│   └── OBSERVABILITY.md        ← OTLP, logs, metrics, traces
│
├── 05-deployment/
│   ├── VERSIONING.md           ← App & service versioning
│   ├── BLUE_GREEN.md           ← Zero-downtime deployments
│   ├── ROLLBACK.md             ← One-click rollback
│   └── GIT_INTEGRATION.md      ← Webhook-triggered deploys
│
├── 06-scaling/
│   ├── MULTI_NODE.md           ← Agent-based cluster
│   ├── CONTAINER_SUPPORT.md    ← Docker/Podman integration
│   └── CRON_SCHEDULING.md      ← Scheduled tasks
│
├── 07-extensibility/
│   ├── PLUGIN_SYSTEM.md        ← Backend & frontend SDK
│   ├── MARKETPLACE.md          ← Plugin discovery & install
│   └── TEMPLATES.md            ← App marketplace templates
│
├── 08-intelligence/
│   ├── ANALYTICS.md            ← Resource usage insights
│   ├── DECISION_SUPPORT.md     ← AI-powered recommendations
│   └── UPDATE_MANAGER.md       ← Staged rollouts
│
├── 09-cli/
│   └── CLI_SPECIFICATION.md    ← Command-line interface
│
└── 10-implemented/
    ├── FILE_EXPLORER.md        ← Implementation notes
    ├── REVERSE_PROXY.md        ← Implementation notes
    ├── ROUTING_NAVIGATION.md   ← Implementation notes
    ├── APPS_SERVICES.md        ← Implementation notes
    └── AUTHENTICATION.md       ← Implementation notes (partial)
```

---

## 🚦 Feature Status Overview

### Legend
| Symbol | Status |
|--------|--------|
| ✅ | Implemented |
| 🔶 | Partially Implemented |
| 📋 | Specified (Ready to Build) |
| 💡 | Planned (Needs Spec) |

### By Category

#### 01 - Core Platform
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Process Management | ✅ | - | Done |
| File Explorer | ✅ | - | Done |
| Reverse Proxy (YARP) | ✅ | - | Done |
| External Proxy (Nginx, Caddy, Traefik, HAProxy, Varnish) | 📋 | HIGH | 3 weeks |
| Routing & Navigation | ✅ | - | Done |

#### 02 - Security
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Authentication (JWT) | ✅ | - | Done |
| Authentication (API Keys) | 📋 | HIGH | 1 week |
| RBAC | 📋 | HIGH | 2 weeks |
| Secrets Management | 💡 | LOW | 3 weeks |

#### 03 - Organization
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Apps & Services | ✅ | - | Done |
| Variable Groups | ✅ | - | Done |
| Hierarchical Apps | 📋 | MEDIUM | 3 weeks |

#### 04 - Reliability
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Health Checks | 📋 | HIGH | 2 weeks |
| Auto-Restart | 📋 | HIGH | 2 weeks |
| Startup Plans | 📋 | MEDIUM | 2 weeks |
| Observability (OTLP) | 📋 | MEDIUM | 4 weeks |

#### 05 - Deployment
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Versioning | 📋 | HIGH | 3 weeks |
| Blue-Green Deploy | 📋 | HIGH | 2 weeks |
| Rollback | 📋 | HIGH | 1 week |
| Git Integration | 💡 | LOW | 2 weeks |

#### 06 - Scaling
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Multi-Node Cluster | 📋 | HIGH | ~8 weeks (v1) |
| Container Support | 📋 | LOW | 6 weeks |
| Cron Scheduling | 📋 | LOW | 2 weeks |

#### 07 - Extensibility
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Plugin System | 📋 | MEDIUM | 12 weeks |
| Marketplace | 📋 | LOW | 4 weeks |
| Templates | 💡 | LOW | 2 weeks |

#### 08 - Intelligence
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Analytics | 💡 | LOW | 6 weeks |
| Decision Support | 💡 | LOW | 8 weeks |
| Update Manager | 💡 | LOW | 4 weeks |

#### 09 - CLI
| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| CLI Tool | 📋 | HIGH | 4 weeks |

---

## 🎯 Recommended Implementation Order

### Phase 1: Production Ready (Q1 2026) - 8 weeks
1. **CLI Tool** (4 weeks) - DevOps automation essential
2. **API Keys + RBAC** (3 weeks) - Security for production
3. **Health Checks** (1 week) - Basic reliability

### Phase 2: Reliability (Q2 2026) - 8 weeks
4. **Auto-Restart Policies** (2 weeks)
5. **Blue-Green Deployment** (2 weeks)
6. **Versioning + Rollback** (4 weeks)

### Phase 3: Organization (Q2-Q3 2026) - 5 weeks
7. **Hierarchical Apps** (3 weeks)
8. **Startup Plans** (2 weeks)

### Phase 4: Scale (Q3-Q4 2026) - 10 weeks
9. **Multi-Node Cluster** (~8 weeks v1, stateful agents, API-key auth)
10. **Cron Scheduling** (2 weeks)

### Phase 5: Ecosystem (Q4 2026+) - 16 weeks
11. **Plugin System** (12 weeks)
12. **Marketplace** (4 weeks)

### Future
- Container Support
- Analytics & AI
- Git Integration

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              MINICLUSTER                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                           CLIENTS                                     │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │ │
│  │  │   CLI   │  │ Web UI  │  │ CI/CD   │  │  Agent  │                 │ │
│  │  │  (mc)   │  │ (React) │  │ Webhook │  │ (Node)  │                 │ │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                 │ │
│  └───────┼────────────┼────────────┼────────────┼────────────────────────┘ │
│          │            │            │            │                          │
│          └────────────┴────────────┴────────────┘                          │
│                              │                                             │
│                         REST API + SignalR                                 │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────────────────────┐ │
│  │                        BACKEND (ASP.NET Core)                         │ │
│  │                                                                       │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │ Process Manager │  │  Health Check   │  │    Scheduler    │       │ │
│  │  │  (Services)     │  │    Service      │  │   (Cron Jobs)   │       │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │ │
│  │                                                                       │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │  YARP Proxy     │  │   Deployment    │  │    Metrics      │       │ │
│  │  │  (Routing)      │  │    Engine       │  │   Collector     │       │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │ │
│  │                                                                       │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │ │
│  │  │  Plugin Host    │  │  Auth Provider  │  │  File Service   │       │ │
│  │  │  (Extensible)   │  │  (JWT/API Key)  │  │  (Explorer)     │       │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                             │
│              ┌───────────────┼───────────────┐                             │
│              │               │               │                             │
│  ┌───────────┴───────┐ ┌─────┴─────┐ ┌───────┴───────┐                    │
│  │    SQLite         │ │ Optional  │ │   File        │                    │
│  │  (Config/State)   │ │TimescaleDB│ │   System      │                    │
│  │  - Apps           │ │ (Telemetry│ │  - Configs    │                    │
│  │  - Services       │ │  at scale)│ │  - Logs       │                    │
│  │  - Users          │ │           │ │  - Artifacts  │                    │
│  └───────────────────┘ └───────────┘ └───────────────┘                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Cross-References

### From Previous Specs
| Old Location | New Location |
|--------------|--------------|
| spec/000-product-positioning | spec4/00-overview/PRODUCT_VISION.md |
| spec/001-file-explorer | spec4/10-implemented/FILE_EXPLORER.md |
| spec/002-routing-navigation | spec4/10-implemented/ROUTING_NAVIGATION.md |
| spec/003-authentication | spec4/02-security/AUTHENTICATION.md |
| spec/004-reverse-proxy | spec4/10-implemented/REVERSE_PROXY.md |
| spec/005-reliability-orchestration | spec4/04-reliability/*.md |
| spec/006-container-support | spec4/06-scaling/CONTAINER_SUPPORT.md |
| spec/007-app-versioning | spec4/05-deployment/VERSIONING.md |
| spec/008-hierarchical-apps | spec4/03-organization/HIERARCHICAL_APPS.md |
| spec/009-service-versioning | spec4/05-deployment/VERSIONING.md |
| spec/010-multi-node-cluster | spec4/06-scaling/MULTI_NODE.md |
| spec/011-cron-scheduling | spec4/06-scaling/CRON_SCHEDULING.md |
| spec/012-plugin-system | spec4/07-extensibility/PLUGIN_SYSTEM.md |
| spec/013-analytics | spec4/08-intelligence/ANALYTICS.md |
| spec/014-app-update-manager | spec4/08-intelligence/UPDATE_MANAGER.md |
| spec/CLI_SPECIFICATION.md | spec4/09-cli/CLI_SPECIFICATION.md |
| spec3/015-simple-app-tabs | spec4/10-implemented/APPS_SERVICES.md |

---

## 📝 Contributing

### Adding a New Feature Spec
1. Identify the category (security, reliability, etc.)
2. Create `spec4/XX-category/FEATURE_NAME.md`
3. Use template from `spec4/00-overview/TEMPLATE.md`
4. Update this INDEX.md with status
5. Create feature branch: `feature/feature-name`

### Updating Implementation Status
1. Move completed spec to `10-implemented/`
2. Update status in this INDEX.md
3. Add implementation notes to the spec file

---

*This consolidated specification index is the source of truth for MiniCluster feature planning.*
