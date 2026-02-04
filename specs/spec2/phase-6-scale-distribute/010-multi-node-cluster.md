# 010: Multi-Node Cluster

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 6 - Scale & Distribute  
**Priority:** 🟡 HIGH  
**Effort:** 6-8 weeks  
**Original Spec:** [../spec/010-multi-node-cluster/spec.md](../../spec/010-multi-node-cluster/spec.md)

---

## Summary

Control multiple machines from a single MiniCluster instance via API-based agents. Central dashboard, cross-node deployment, impersonation contexts. Essential for MSPs and multi-server environments.

## Key Features ⬜

### 1. Agent-Based Architecture (2 weeks)
- ⬜ **MiniCluster Agent** - Lightweight agent on each node
- ⬜ **API-driven** - All operations via REST API
- ⬜ **Stateless agents** - No local data, all in central DB
- ⬜ **Auto-registration** - Agents register with controller
- ⬜ **Heartbeat monitoring** - Detect disconnected nodes

### 2. Central Dashboard (1 week)
- ⬜ View all nodes in single UI
- ⬜ Per-node status (online, offline, degraded)
- ⬜ Aggregate metrics (total CPU, memory across cluster)
- ⬜ Per-node drill-down (apps, services, logs)
- ⬜ Search across all nodes

### 3. Cross-Node Deployment (2 weeks)
- ⬜ **Deploy to specific nodes** - Select target machines
- ⬜ **Deploy to groups** - Deploy to "production" group
- ⬜ **Deploy to all** - Broadcast deployment
- ⬜ **Rolling deployments** - Update nodes sequentially
- ⬜ **Parallel deployments** - Update all at once
- ⬜ **Health checks before next node** - Safe rollout

### 4. Node Management (1 week)
- ⬜ Add/remove nodes dynamically
- ⬜ Node labels (environment, region, customer)
- ⬜ Node capacity planning (CPU, memory, disk)
- ⬜ Drain node (stop accepting new apps)
- ⬜ Quarantine node (isolate for maintenance)

### 5. Security (1-2 weeks)
- ⬜ **mTLS authentication** - Mutual TLS between controller & agents
- ⬜ **API key authentication** - Shared secret per node
- ⬜ **Certificate rotation** - Automatic cert renewal
- ⬜ **Authorization** - Which nodes can access which apps
- ⬜ **Impersonation contexts** - Run as different user/credentials

### 6. Cross-Node Service Discovery (1 week)
- ⬜ Services can discover each other across nodes
- ⬜ DNS-based discovery (`api.node1.cluster.local`)
- ⬜ Environment variable injection (`NODE_API_URL`)
- ⬜ Health check across nodes

## Why This Matters

**Single Node:**
- ❌ Can't manage multiple servers
- ❌ Manual SSH to each machine
- ❌ No central visibility
- ❌ Can't distribute workloads

**Multi-Node Cluster:**
- ✅ Manage hundreds of servers from one UI
- ✅ Deploy to multiple machines at once
- ✅ Central dashboard and monitoring
- ✅ Load distribution and failover

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CENTRAL CONTROLLER                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │     UI      │  │     API     │  │   Database  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────┬───────────────────────────────┘
                          │ mTLS / API Key
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼─────┐  ┌──────▼──────┐  ┌────▼──────────┐
│   NODE 1      │  │   NODE 2    │  │   NODE 3      │
│  (Agent)      │  │  (Agent)    │  │  (Agent)      │
│               │  │             │  │               │
│ ┌───────────┐ │  │ ┌─────────┐ │  │ ┌───────────┐ │
│ │  App A    │ │  │ │ App B   │ │  │ │  App C    │ │
│ │  App D    │ │  │ │ App E   │ │  │ │  App F    │ │
│ └───────────┘ │  │ └─────────┘ │  │ └───────────┘ │
└───────────────┘  └─────────────┘  └───────────────┘
```

## Technical Design

### Database Schema
```sql
-- Nodes
CREATE TABLE Nodes (
  Id INTEGER PRIMARY KEY,
  Name VARCHAR(255),
  Hostname VARCHAR(255),
  IpAddress VARCHAR(50),
  ApiKey VARCHAR(512), -- Hashed
  CertificateThumbprint VARCHAR(128),
  Status VARCHAR(20), -- Online, Offline, Degraded
  LastHeartbeat DATETIME,
  Labels TEXT, -- JSON: {env: "prod", region: "us-east"}
  Resources TEXT -- JSON: {cpus: 8, memory: 32GB}
);

-- App deployments (which app on which node)
CREATE TABLE AppDeployments (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER,
  NodeId INTEGER,
  Status VARCHAR(20), -- Pending, Running, Stopped
  DeployedAt DATETIME,
  FOREIGN KEY (AppId) REFERENCES Apps(Id),
  FOREIGN KEY (NodeId) REFERENCES Nodes(Id)
);
```

### API Endpoints

**Controller API** (called by UI):
```
GET    /api/nodes                  - List all nodes
POST   /api/nodes                  - Register new node
PUT    /api/nodes/:id              - Update node
DELETE /api/nodes/:id              - Remove node
POST   /api/deploy                 - Deploy app to nodes
GET    /api/cluster/status         - Cluster overview
```

**Agent API** (on each node):
```
POST   /agent/apps                 - Deploy app on this node
GET    /agent/apps/:id             - App status
POST   /agent/apps/:id/start       - Start app
POST   /agent/apps/:id/stop        - Stop app
GET    /agent/health               - Agent health check
POST   /agent/heartbeat            - Report status to controller
```

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Agent architecture & API | 2 |
| 2 | Central dashboard & node listing | 1 |
| 3 | Cross-node deployment | 2 |
| 4 | Node management & labels | 1 |
| 5 | mTLS/API key security | 1-2 |
| 6 | Service discovery | 1 |
| 7 | Impersonation contexts | 1 |

**Total:** 6-8 weeks

## Use Cases

### MSP Managing Client Servers
```
Nodes:
├── client-a-prod (Windows Server)
├── client-a-dev (Windows Desktop)
├── client-b-prod (Linux Server)
└── client-b-staging (Linux VM)

Deploy CRM app to client-a-prod
Deploy Test App to all dev/staging nodes
```

### Multi-Region Deployment
```
Nodes:
├── us-east-1 (4 nodes)
├── us-west-2 (4 nodes)
└── eu-west-1 (4 nodes)

Deploy API to all regions
Deploy Database to us-east-1 only
```

## Dependencies

- **Required:** 003 Authentication (node authentication)
- **Recommended:** 005 Reliability (health checks)

## Related Features

- **Enhanced by:** 007 App Versioning (version deployments per node)
- **Enhanced by:** 011 Cron Scheduling (scheduled tasks across nodes)

---

For complete details, see the [full multi-node cluster spec](../../spec/010-multi-node-cluster/spec.md).
