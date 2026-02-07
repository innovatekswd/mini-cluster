# MiniCluster Roadmap

> **Last Updated:** February 7, 2026

---

## Overview

MiniCluster ships in **three stages**. Each stage is a complete, useful product.
Each stage expands the audience without breaking the previous one.

```
  Stage 1              Stage 2                   Stage 3
  ─────────           ─────────                 ─────────
  PM2 users    ──→    Multi-server teams  ──→   Fleet operators
  1 server            2-10 servers              10-500 servers
  Solo dev            Small team                Growing org
  mc start            mc join                   mc scale

  Same binary. Same CLI. Same UI. Same mental model.
```

---

## Stage 1 — The Runtime

> **Goal:** Be the best process manager on the market. Win PM2 and Supervisor users.

### MVP (go to market)

| Phase | Feature | Spec | Status | Effort |
|-------|---------|------|--------|--------|
| 1 | File Explorer | [001](../spec/001-file-explorer/spec.md) | ✅ Done | — |
| 1 | Console / Terminal | — | ✅ Done | — |
| 2 | Routing & Navigation | [002](../spec/002-routing-navigation/spec.md) | ✅ Done | — |
| 3 | Reverse Proxy (YARP) | [004](../spec/004-reverse-proxy/spec.md) | ✅ Done | — |
| 4 | CLI | [015](../spec/015-cli/spec.md) | ✅ Done | — |
| 5 | Authentication | [003](../spec/003-authentication/spec.md) | ✅ Done | — |
| 6 | Health Checks & Auto-Restart | [005](../spec/005-reliability-orchestration/spec.md) | ✅ Done | — |

**What ships:** Process manager, reverse proxy, web terminal, health checks, auto-restart, auth with API keys, web UI, CLI.

**What it replaces:** PM2, Supervisor, systemd units, manual nginx config.

**Milestone:** First app running in <10 minutes. MVP feature-complete.

### Post-MVP (ship after first users)

| Phase | Feature | Spec | Status | Effort |
|-------|---------|------|--------|--------|
| 7 | Simple App Tabs | [021](../spec/021-simple-app-tabs/spec.md) | 📋 Spec | 1-2 weeks |
| 8 | Cron Scheduling | [011](../spec/011-cron-scheduling/spec.md) | 📋 Spec | 2 weeks |
| 9 | Container Support | [006](../spec/006-container-support/spec.md) | 📋 Spec | 6-8 weeks |
| 10 | App Versioning & Deployment | [007](../spec/007-app-versioning/spec.md) | 📋 Spec | 4-6 weeks |
| 11 | Hierarchical Apps & Grouping | [008](../spec/008-hierarchical-apps/spec.md) | 📋 Spec | 3-4 weeks |
| 12 | Service-Level Versioning | [009](../spec/009-service-versioning/spec.md) | 📋 Spec | 2-3 weeks |
| 13 | Reliability (full) | [005](../spec/005-reliability-orchestration/spec.md) | 📋 Spec | 8-10 weeks |

**What ships:** App grouping, cron scheduling, Docker/Podman containers, versioning with rollback, hierarchical apps, OTLP observability, startup dependency graphs.

**Driven by:** User feedback from MVP. Build what users actually ask for.

---

## Stage 2 — The Platform + Cluster

> **Goal:** Add a second server with one command. Discovery, identity, config, registry, and clustering ship together — they're inseparable.

| Phase | Feature | Spec | Status | Effort |
|-------|---------|------|--------|--------|
| 14 | Discovery & Services | [016](../spec/016-discovery-services/spec.md) | 📋 Spec | 2 weeks |
| 15 | Identity / OIDC | [017](../spec/017-identity-oidc/spec.md) | 📋 Spec | 3 weeks |
| 16 | Config Service | [018](../spec/018-config-service/spec.md) | 📋 Spec | 3 weeks |
| 17 | Registry & Packages | [019](../spec/019-registry/spec.md) | 📋 Spec | 3 weeks |
| 18 | Multi-Node Cluster | [010](../spec/010-multi-node-cluster/spec.md) | 🚧 Phase 0+1 | ~8 weeks |

**What ships:** Discovery endpoint, OIDC identity (users, tokens, SSO), pull-based config with convergence, .mcpkg registry, multi-node clustering with heartbeat/failover.

**What it enables:** `mc join` adds a server. Agent discovers → authenticates → pulls config → downloads packages → converges. Multi-user access control, desired-state deployments, package distribution.

**Milestone:** `mc join` adds a server. Everything activates automatically.

---

## Stage 3 — The Fleet

> **Goal:** Scale infrastructure on demand. Compete with Kubernetes on simplicity, not scope.

| Phase | Feature | Spec | Status | Effort |
|-------|---------|------|--------|--------|
| 19 | Auto-Scaling | [020](../spec/020-auto-scaling/spec.md) | 📋 Spec | 6-8 weeks |
| 20 | Plugin System | [012](../spec/012-plugin-system/spec.md) | 📋 Spec | 12 weeks |

**What ships:** Cloud auto-scaling (Hetzner, DO, AWS), open plugin SDK + marketplace.

**What it enables:** Fleet management, workload placement, auto-scaling with scale-to-zero, community plugins.

**Milestone:** Traffic spikes → MiniCluster adds VMs, deploys apps, routes traffic → scales back to zero.

---

## Future (Unscheduled)

| Feature | Description |
|---------|-------------|
| Secrets Management | Encrypted secrets, rotation, injection into apps |
| Backup & Restore | Scheduled config + data backups, one-click restore |
| Windows Service Integration | Register MiniCluster apps as Windows services |
| Analytics & Decision Support | Resource trends, anomaly detection, AI recommendations |

---

## Guiding Principles

1. **Ship stages, not features.** Each stage must be a complete product someone would pay for.
2. **Never break the previous stage.** Stage 3 users and Stage 1 users run the same binary.
3. **Reveal, don't require.** Features appear when the user's context demands them.
4. **Open standards over proprietary.** OIDC, REST, ZIP-based packages, OpenAPI.
5. **Bare metal first.** Containers are optional. The platform works without Docker.
6. **Latency to value matters.** If it takes more than 10 minutes to get running, we've failed.
