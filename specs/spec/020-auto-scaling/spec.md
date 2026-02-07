# 020 — Auto-Scaling

> **Status:** 💡 Planned  
> **Priority:** Medium — High-value feature after platform core is complete  
> **Effort:** 6-8 weeks (phased)  
> **Dependencies:** 010 Cluster, 016 Discovery, 017 Identity, 018 Config, 019 Registry  
> **Last Updated:** February 7, 2026

---

## Overview

Auto-scaling lets MiniCluster acquire new VMs from cloud providers, install agents automatically, and expand capacity based on load. When demand drops, nodes are drained and terminated. **Pay only for what you use.**

This is the feature that turns MiniCluster from "manage servers you already have" into "manage servers that appear and disappear based on need."

```
┌──────────────────────────────────────────────────────────────────┐
│                      AUTO-SCALING MODEL                           │
│                                                                   │
│  Load increases                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Node 1  │    │  Node 2  │    │  Node 3  │    │  Node 4  │   │
│  │ (always) │    │ (always) │    │ (scaled) │    │ (scaled) │   │
│  │  CPU 85% │    │  CPU 82% │    │  CPU 40% │    │  CPU 35% │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘   │
│                                   ▲ Created by     ▲ Created by  │
│                                   │ auto-scale     │ auto-scale  │
│                                                                   │
│  Load decreases                                                   │
│  ┌──────────┐    ┌──────────┐                                    │
│  │  Node 1  │    │  Node 2  │    Node 3: drained, terminated    │
│  │ (always) │    │ (always) │    Node 4: drained, terminated    │
│  │  CPU 25% │    │  CPU 20% │    → VMs deleted, no more cost    │
│  └──────────┘    └──────────┘                                    │
│                                                                   │
│  Billing: Pay for Node 3+4 only during the hours they ran        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Why This Matters

The target MiniCluster audience (small teams, MSPs, edge deployments) currently has two bad options:

| Option | Problem |
|--------|---------|
| **Over-provision** — keep extra VMs running "just in case" | Paying 24/7 for capacity used 2 hours/day |
| **Manual scaling** — SSH in, set up new server, deploy apps | Takes 30-60 min per server, error-prone |

MiniCluster auto-scaling gives them what only Kubernetes users have: elastic infrastructure. But without Kubernetes.

```
Kubernetes user:  HPA + Cluster Autoscaler + cloud provider integration
                  → Elastic, but complex to configure and operate

MiniCluster user: mc scale web-frontend --add 2 --provider hetzner
                  → Same result, one command, no YAML manifests
```

---

## Phased Implementation

### Phase 1: One-Liner Agent Install (1 week)

The foundation. Make it trivial to add a new node to the cluster.

```
┌──────────────────────────────────────────────────────────────────┐
│                 PHASE 1: ONE-LINER INSTALL                        │
│                                                                   │
│  On any fresh VM:                                                 │
│                                                                   │
│  curl -sL https://controller:5147/install | bash                 │
│                                                                   │
│  What happens:                                                    │
│  1. Downloads MiniCluster binary for current OS/arch             │
│  2. Installs to /usr/local/bin/minicluster                       │
│  3. Creates systemd service (Linux) or Windows Service           │
│  4. Configures agent mode with controller URL                    │
│  5. Starts agent                                                  │
│  6. Agent discovers → authenticates → pulls config → runs apps   │
│                                                                   │
│  Time from fresh VM to running apps: ~60 seconds                 │
│                                                                   │
│  The install script is generated per-cluster:                    │
│  GET /install?token=one-time-token                               │
│  → Embeds controller URL, agent credentials, labels              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Install Script Endpoint:**

```
GET /api/cluster/install-script
Authorization: Bearer {admin-token}

Query params:
  ?labels=role:web,env:production
  ?one-time=true         (token expires after first use)

Response: shell script with embedded config
```

This alone is a selling point. Most PM2/Supervisor users spend 30+ minutes setting up each new server.

---

### Phase 2: Cloud Provider Plugins (3-4 weeks)

Semi-automatic scaling via CLI or API.

```
┌──────────────────────────────────────────────────────────────────┐
│             PHASE 2: PROVIDER PLUGINS                             │
│                                                                   │
│  CLI:                                                             │
│  mc scale web-frontend --add 2 --provider hetzner                │
│                                                                   │
│  What happens:                                                    │
│  1. MiniCluster calls Hetzner API                                │
│     POST /servers { type: cx21, image: ubuntu-22.04 }            │
│  2. Waits for VM to be ready (~30s on Hetzner)                   │
│  3. Runs install script via cloud-init / SSH                     │
│  4. Agent starts, registers with controller                      │
│  5. Config Service assigns apps to new node (via labels)         │
│  6. Agent pulls config, downloads packages, starts apps          │
│  7. Load balancer / proxy updated automatically                  │
│                                                                   │
│  Time: VM creation + install + convergence ≈ 90-120 seconds      │
│                                                                   │
│  Scale down:                                                      │
│  mc scale web-frontend --remove 1                                │
│  1. Select least-loaded scaled node                              │
│  2. Drain: stop routing new requests                             │
│  3. Wait for in-flight requests to complete (30s timeout)        │
│  4. Stop apps, deregister agent                                  │
│  5. Delete VM via provider API                                   │
│  6. No more billing                                              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Supported Providers (Priority Order):**

| Provider | Why | Typical Users |
|----------|-----|---------------|
| **Hetzner** | Cheapest, popular with indie devs/SMBs | EU teams, cost-conscious |
| **DigitalOcean** | Simple API, popular with small teams | US startups, agencies |
| **Vultr** | Global, competitive pricing | Edge deployments |
| **AWS EC2** | Enterprise standard | Larger teams |
| **Azure VMs** | Windows shops | .NET teams (your core market) |
| **Linode/Akamai** | Good API, competitive | General |

**Provider Plugin Interface:**

```csharp
public interface ICloudProvider
{
    string Name { get; }                           // "hetzner", "digitalocean"
    
    Task<ProviderNode> CreateNodeAsync(
        CreateNodeRequest request,                 // size, region, labels
        CancellationToken ct = default);
    
    Task DestroyNodeAsync(
        string providerNodeId,
        CancellationToken ct = default);
    
    Task<NodeStatus> GetNodeStatusAsync(
        string providerNodeId,
        CancellationToken ct = default);
    
    Task<List<NodeSize>> ListSizesAsync(           // cx21, s-2vcpu-4gb, etc.
        CancellationToken ct = default);
    
    Task<List<NodeRegion>> ListRegionsAsync(
        CancellationToken ct = default);
}

public record CreateNodeRequest(
    string Size,                                   // "cx21", "s-2vcpu-4gb"
    string Region,                                 // "fsn1", "nyc1"
    string Name,                                   // auto-generated
    Dictionary<string, string> Labels,             // role=web, env=prod
    string InstallScriptUrl                        // one-liner install
);
```

**Configuration:**

```json
{
  "Scaling": {
    "Providers": {
      "hetzner": {
        "ApiToken": "xxx",
        "DefaultSize": "cx21",
        "DefaultRegion": "fsn1",
        "DefaultImage": "ubuntu-22.04",
        "SshKeyId": "12345"
      },
      "digitalocean": {
        "ApiToken": "xxx",
        "DefaultSize": "s-2vcpu-4gb",
        "DefaultRegion": "nyc1"
      }
    }
  }
}
```

---

### Phase 3: Rule-Based Auto-Scaling (2-3 weeks)

Fully automatic. Define rules, MiniCluster handles the rest.

```
┌──────────────────────────────────────────────────────────────────┐
│            PHASE 3: AUTO-SCALE RULES                              │
│                                                                   │
│  Rule definition:                                                 │
│  {                                                                │
│    "name": "web-frontend-autoscale",                             │
│    "appName": "web-frontend",                                    │
│    "provider": "hetzner",                                        │
│    "nodeSize": "cx21",                                           │
│    "region": "fsn1",                                             │
│    "labels": { "role": "web", "env": "production" },             │
│                                                                   │
│    "scaleUp": {                                                   │
│      "metric": "cpu",                                            │
│      "threshold": 80,                     ← CPU > 80%            │
│      "duration": "5m",                    ← for 5 minutes        │
│      "increment": 1,                      ← add 1 node           │
│      "maxNodes": 10,                      ← never exceed 10      │
│      "cooldown": "10m"                    ← wait 10m before next │
│    },                                                             │
│                                                                   │
│    "scaleDown": {                                                 │
│      "metric": "cpu",                                            │
│      "threshold": 20,                     ← CPU < 20%            │
│      "duration": "15m",                   ← for 15 minutes       │
│      "decrement": 1,                      ← remove 1 node        │
│      "minNodes": 2,                       ← never go below 2     │
│      "cooldown": "15m"                                           │
│    },                                                             │
│                                                                   │
│    "schedule": {                           ← optional             │
│      "scaleUp": "0 8 * * 1-5",            ← 8 AM weekdays        │
│      "scaleDown": "0 20 * * 1-5"          ← 8 PM weekdays        │
│    }                                                              │
│  }                                                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Scaling Decision Flow:**

```
Every 60 seconds:

  1. Collect metrics from all nodes running target app
     ├── CPU average across nodes
     ├── Memory average across nodes
     └── Custom metrics (request rate, queue depth)

  2. Evaluate scale-up rules
     ├── cpu_avg > 80% for 5m AND nodes < maxNodes AND cooldown expired?
     │   → YES: Create 1 new VM via provider
     └── NO: check scale-down

  3. Evaluate scale-down rules
     ├── cpu_avg < 20% for 15m AND nodes > minNodes AND cooldown expired?
     │   → YES: Select least-loaded auto-scaled node
     │          Drain → stop → terminate VM
     └── NO: no action

  4. Log decision (scale up / scale down / no action)
  5. Update dashboard
```

**Scale-to-Zero Support:**

```json
{
  "scaleDown": {
    "threshold": 0,
    "duration": "30m",
    "minNodes": 0          ← scale to zero!
  },
  "scaleUp": {
    "metric": "http_requests",
    "threshold": 1,        ← any request triggers scale-up
    "minNodes": 1
  }
}
```

When minNodes=0 and no traffic for 30 minutes, ALL auto-scaled VMs are terminated. First incoming request triggers a scale-up (with a cold-start delay of ~90s).

---

## Data Model

```
┌──────────────────────┐     ┌──────────────────────┐
│  ScalingRule          │     │  ScaledNode           │
│                       │     │                       │
│  Id (Guid)            │     │  Id (Guid)            │
│  Name                 │     │  ScalingRuleId        │
│  AppName              │────>│  MachineId            │
│  Provider             │     │  ProviderNodeId       │
│  NodeSize             │     │  ProviderName         │
│  Region               │     │  Status               │
│  Labels (JSON)        │     │  CreatedAt            │
│  ScaleUpConfig (JSON) │     │  TerminatedAt         │
│  ScaleDownConfig (JSON)│    │  CostEstimate         │
│  ScheduleConfig (JSON)│     │  LastMetricValue      │
│  MaxNodes             │     └──────────────────────┘
│  MinNodes             │
│  IsEnabled            │     ┌──────────────────────┐
│  LastScaleAction      │     │  ScalingEvent         │
│  LastScaleAt          │     │                       │
│  CooldownEndsAt       │     │  Id (Guid)            │
│  CreatedAt            │     │  RuleId               │
└──────────────────────┘     │  Action (up/down)     │
                              │  Reason               │
                              │  NodesBefore          │
                              │  NodesAfter           │
                              │  MetricValue          │
                              │  Timestamp            │
                              └──────────────────────┘
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/scaling/rules` | mc:admin | List scaling rules |
| POST | `/api/scaling/rules` | mc:admin | Create scaling rule |
| PUT | `/api/scaling/rules/{id}` | mc:admin | Update rule |
| DELETE | `/api/scaling/rules/{id}` | mc:admin | Delete rule |
| POST | `/api/scaling/rules/{id}/enable` | mc:admin | Enable/disable rule |
| GET | `/api/scaling/nodes` | mc:admin | List auto-scaled nodes |
| POST | `/api/scaling/scale-up` | mc:admin, mc:operator | Manual scale-up |
| POST | `/api/scaling/scale-down` | mc:admin, mc:operator | Manual scale-down |
| GET | `/api/scaling/events` | mc:admin | Scaling event history |
| GET | `/api/scaling/providers` | mc:admin | List configured providers |
| GET | `/api/scaling/providers/{name}/sizes` | mc:admin | List VM sizes |
| GET | `/api/scaling/providers/{name}/regions` | mc:admin | List regions |
| GET | `/api/cluster/install-script` | mc:admin | Generate install script |

---

## CLI Commands

```bash
# === MANUAL SCALING ===

# Scale up: add 2 nodes for web-frontend on Hetzner
mc scale up web-frontend --count 2 --provider hetzner --size cx21

# Scale down: remove 1 auto-scaled node
mc scale down web-frontend --count 1

# === RULES ===

# Create auto-scale rule
mc scale rule create web-frontend \
  --provider hetzner \
  --size cx21 \
  --scale-up-cpu 80 --scale-up-duration 5m --max-nodes 10 \
  --scale-down-cpu 20 --scale-down-duration 15m --min-nodes 2

# List rules
mc scale rules

# Disable a rule
mc scale rule disable web-frontend-autoscale

# === STATUS ===

# View scaling status
mc scale status
# APP              NODES  AUTO-SCALED  RULE          STATUS
# web-frontend     4      2            autoscale-1   stable (CPU: 45%)
# api-backend      2      0            none          -

# View scaling events
mc scale events
# TIME   ACTION    APP             NODES  REASON
# 14:30  scale-up  web-frontend    3→4    CPU 84% > 80% for 5m
# 09:00  scale-up  web-frontend    2→3    Scheduled (weekday morning)
# 22:15  scale-dn  web-frontend    4→3    CPU 15% < 20% for 15m

# === INSTALL SCRIPT ===

# Generate install script for manual use
mc cluster install-script --labels role=web,env=production
# → Prints curl command to run on new VM
```

---

## Cost Visibility

```
┌──────────────────────────────────────────────────────────────────┐
│            SCALING DASHBOARD                                      │
│                                                                   │
│  Auto-Scaled Nodes                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Node          Provider   Size   Since     Est. Cost/hr   │    │
│  │ auto-web-01   Hetzner    cx21   2h ago    €0.0070        │    │
│  │ auto-web-02   Hetzner    cx21   45m ago   €0.0070        │    │
│  │                                                           │    │
│  │ Today's auto-scale cost: €0.18                            │    │
│  │ This month estimate:     €12.40                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Scaling Activity (24h)                                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Nodes  5 ┤          ████                                 │    │
│  │        4 ┤       ████    ████                             │    │
│  │        3 ┤    ███            █████                        │    │
│  │        2 ┤████                    ████████████████        │    │
│  │          └────────────────────────────────────────────    │    │
│  │           00   04   08   12   16   20   24               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### Phase 1: One-Liner Install
- [ ] `GET /api/cluster/install-script` generates working install script
- [ ] Script works on Ubuntu 22.04+ and Debian 12+
- [ ] Script works on Windows Server 2019+ (PowerShell variant)
- [ ] Fresh VM to running apps in < 120 seconds
- [ ] One-time tokens expire after use

### Phase 2: Provider Plugins
- [ ] `ICloudProvider` interface implemented for at least 2 providers
- [ ] `mc scale up` creates VM, installs agent, waits for convergence
- [ ] `mc scale down` drains and terminates VM
- [ ] Provider credentials stored securely (encrypted in config)
- [ ] VM creation errors handled gracefully with retry

### Phase 3: Auto-Scale Rules
- [ ] Rule engine evaluates metrics every 60 seconds
- [ ] Scale-up triggers when threshold exceeded for duration
- [ ] Scale-down triggers with graceful drain
- [ ] Cooldown period prevents flapping
- [ ] Min/max node limits enforced
- [ ] Schedule-based scaling works
- [ ] Scale-to-zero supported
- [ ] All scaling events logged with reason + metrics
- [ ] Dashboard shows scaling activity and cost estimates

---

## Related Specs

| Spec | Relationship |
|------|-------------|
| [010 — Multi-Node Cluster](../010-multi-node-cluster/spec.md) | Scaling creates/removes cluster nodes |
| [016 — Discovery](../016-discovery-services/spec.md) | New nodes discover services via well-known endpoint |
| [017 — Identity/OIDC](../017-identity-oidc/spec.md) | Install script embeds agent credentials |
| [018 — Config Service](../018-config-service/spec.md) | New nodes pull desired state automatically |
| [019 — Registry](../019-registry/spec.md) | New nodes download packages on first convergence |
