# 010: Multi-Node Cluster (Revised v2.0)

**Status:** 📋 Spec Ready (0% Complete)
**Phase:** 6 - Scale & Distribute
**Priority:** 🟡 HIGH
**Effort:** ~8 weeks (v1), ~14 weeks (v2 additions)
**Full Spec:** [spec/010-multi-node-cluster/spec.md](../../spec/010-multi-node-cluster/spec.md)

---

## Summary

Control multiple machines from a single MiniCluster instance via API-based **stateful** agents. The agent IS MiniCluster — same binary in agent mode. Key design changes from v1 spec:

- **Stateful agents** (not stateless) — survive controller outages
- **API-key auth for v1** — mTLS deferred to v2
- **Env-var service discovery** — DNS deferred to v2
- **Notification-only on failure** — auto-failover deferred to v2
- **Impersonation deferred** — orthogonal feature
- **Config drift detection** — hash-based comparison

## v1 Implementation Phases ⬜

### Phase 0: Machine Entity Wiring (1 week)
- ⬜ Wire `Machine` entity into `DbSet<Machine>` in AppDbContext
- ⬜ Add `Service.MachineId` FK to entity
- ⬜ Extend Machine with cluster fields (AgentEndpoint, Labels, etc.)
- ⬜ Create `IMachineService` / `MachineService`
- ⬜ Create `MachinesController` (CRUD + ping)
- ⬜ Auto-register local machine on startup

### Phase 1: Agent Mode & Heartbeat (1.5 weeks)
- ⬜ `--agent` flag and `Agent` config section
- ⬜ `AgentRegistrationService` (BackgroundService)
- ⬜ Heartbeat loop (30s interval, configurable)
- ⬜ `HeartbeatMonitorService` on controller (detect offline >90s)
- ⬜ `AgentApiKeyMiddleware` for cluster endpoints
- ⬜ Offline node notification policy (SignalR + webhook)
- ⬜ `ClusterController` (register, heartbeat, nodes)

### Phase 2: Remote Execution (1.5 weeks)
- ⬜ `INodeClient` interface (Apps, Services, Logs, Metrics, System)
- ⬜ `NodeClient` HTTP implementation
- ⬜ `NodeClientFactory` (create from Machine records)
- ⬜ `IClusterService` (ExecuteOnNode, ExecuteOnAll)
- ⬜ Polly resilience (retry, circuit breaker)

### Phase 3: Deploy to Node (1.5 weeks)
- ⬜ `AppDeployment` entity (tracks what's deployed where)
- ⬜ `ConfigHasher` (SHA256 deterministic hash)
- ⬜ `IDeploymentService` (deploy, sync, undeploy, drift check)
- ⬜ Deploy by machine IDs or label selector
- ⬜ Cross-node service discovery via env-var injection
- ⬜ `DeploymentsController`

### Phase 4: Cluster Dashboard UI (1 week)
- ⬜ Cluster sidebar section (Overview, Nodes, Deployments)
- ⬜ Node cards with status, resources, app count
- ⬜ Node detail page with metrics and deployments
- ⬜ Deploy-to-cluster modal with label filtering
- ⬜ Drift alert badges
- ⬜ SignalR real-time cluster events
- ⬜ React Query hooks for cluster data

### Phase 5: Cross-Node Operations (1 week)
- ⬜ `ClusterAppsController` (start/stop/restart on all nodes)
- ⬜ Per-node success/failure reporting
- ⬜ Aggregate status view across nodes
- ⬜ Aggregate log view with node attribution
- ⬜ UI: cross-node status table

### Phase 6: CLI Parity (0.5 weeks)
- ⬜ `mc node list/get/add/remove/ping/labels`
- ⬜ `mc deploy <app> --to <nodes>` / `--label env=prod`
- ⬜ `mc deploy list/status/sync/remove/drift`
- ⬜ `mc cluster status`
- ⬜ `mc cluster apps <app> start/stop/restart`

## v2 Deferred Features

| Feature | Effort | Reason Deferred |
|---------|--------|-----------------|
| mTLS authentication | 2 weeks | API keys sufficient for v1 |
| Impersonation contexts | 2 weeks | Orthogonal, useful even single-node |
| DNS-based discovery | 1-2 weeks | Env-vars cover 90% of cases |
| Automatic failover | 3-4 weeks | Split-brain risk, needs operational experience |
| Rolling/blue-green deploys | 2 weeks | Depends on App Versioning (007) |
| Service replication | 3 weeks | Requires load balancer orchestration |

## Architecture

```
Controller (Primary)
  │ HTTPS + API Key
  ├── Node A (Agent) — Own DB ✓, Own API ✓
  ├── Node B (Agent) — Own DB ✓, Own API ✓
  └── Node C (Agent) — Own DB ✓, Own API ✓

Controller DOWN → Agents still work locally
Controller UP   → Agents sync pending changes
```

## Dependencies

- **Required:** 003 Authentication (JWT ✅ + API keys 📋)
- **Recommended:** 005 Reliability (health checks)
- **v2 only:** 007 App Versioning (rolling deploys)

---

For complete implementation details, data models, API endpoints, UI components, and testing strategy, see the [full spec](../../spec/010-multi-node-cluster/spec.md).
