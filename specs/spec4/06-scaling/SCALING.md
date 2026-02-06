# Scaling & Multi-Node Cluster

> **Version:** 2.0 (Revised)
> **Status:** 📋 Spec Ready
> **Priority:** HIGH
> **Effort:** ~8 weeks (v1), ~14 weeks (v2)
> **Full Spec:** [spec/010-multi-node-cluster/spec.md](../../spec/010-multi-node-cluster/spec.md)

---

## Overview

Multi-node clustering enables managing multiple machines from a single MiniCluster controller. The agent IS MiniCluster — same binary running in `--agent` mode with its own local SQLite database.

---

## 1. Multi-Node Cluster (v1 — ~8 weeks)

### Design Principles
- **Stateful agents** — Each agent keeps its own SQLite DB, survives controller outages
- **API-key auth** — Simple, debuggable, sufficient for v1
- **Env-var service discovery** — No DNS server required
- **Notification-only on failure** — No automatic rescheduling
- **Config drift detection** — SHA256 hash-based comparison

### Architecture
```
Controller (Primary)
  │ HTTPS + API Key
  ├── Node A (Agent) — Own DB ✓, Own API ✓
  ├── Node B (Agent) — Own DB ✓, Own API ✓
  └── Node C (Agent) — Own DB ✓, Own API ✓

Controller DOWN → Agents still work locally
Controller UP   → Agents sync pending changes
```

### Implementation Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 0 | Machine entity wiring (DbSet, Controller, Service) | 1 week |
| 1 | Agent mode, heartbeat, API key auth, offline detection | 1.5 weeks |
| 2 | Remote execution (NodeClient, ClusterService, Polly) | 1.5 weeks |
| 3 | Deploy to node (AppDeployment, drift, env-var discovery) | 1.5 weeks |
| 4 | Cluster dashboard UI (nodes, deployments, drift alerts) | 1 week |
| 5 | Cross-node operations (start/stop/restart/logs all nodes) | 1 week |
| 6 | CLI parity (mc node, mc deploy, mc cluster) | 0.5 weeks |

### Key v1 Features
- Agent self-registration and heartbeat (30s interval)
- Offline detection (<90s) with notification
- Deploy apps to nodes by ID or label selector
- Config drift detection and manual sync
- Cross-node start/stop/restart/status/logs
- Cluster dashboard with aggregate metrics
- CLI: `mc node`, `mc deploy`, `mc cluster`

---

## 2. v2 Scaling Features (Deferred)

### 2.1 mTLS Authentication (2 weeks)
Mutual TLS between controller and agents with automatic certificate rotation.

### 2.2 Impersonation Contexts (2 weeks)
Run commands as different user/credentials. Orthogonal feature, useful even single-node.

### 2.3 DNS-Based Service Discovery (1-2 weeks)
Embedded DNS server resolving `app.node.cluster.local`. Env-vars cover 90% of cases for v1.

### 2.4 Automatic Failover (3-4 weeks)
Auto-reschedule apps from offline nodes with quorum-based leader election. Deferred due to split-brain risk — needs operational experience with v1.

### 2.5 Rolling & Blue-Green Deployments (2 weeks)
Sequential node updates with health check gates. Depends on App Versioning (007).

### 2.6 Service Replication (3 weeks)

```yaml
services:
  myapp-api:
    replicas: 3
    placement:
      strategy: spread        # spread, binpack
      constraints:
        - node.memory > 4GB
```

Load balancing via YARP with auto-configured upstream pools.

---

## 3. Database Scaling (Future)

### PostgreSQL Support
For larger deployments (100+ nodes), SQLite can be replaced with PostgreSQL.

```json
{
  "Database": {
    "Provider": "PostgreSQL",
    "ConnectionString": "Host=localhost;Database=minicluster;..."
  }
}
```

---

## 4. Message Queue Integration (Future)

### Event-Driven Architecture
```yaml
messaging:
  provider: rabbitmq      # rabbitmq, redis, nats
  events:
    - node.online
    - node.offline
    - deployment.completed
    - drift.detected
```

---

## 5. Caching Layer (Future)

### Redis Integration
```yaml
cache:
  provider: redis
  url: redis://localhost:6379
  policies:
    nodeMetrics: { ttl: 5s }
    clusterStatus: { ttl: 10s }
```

---

## References

- Full cluster spec: [spec/010-multi-node-cluster/spec.md](../../spec/010-multi-node-cluster/spec.md)
- Architecture overview: [spec4/INDEX.md](../INDEX.md)
- Multi-node is the enterprise unlock — single-node is a tool, multi-node is a platform
