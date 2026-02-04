# Deployment & Zero-Downtime Updates

> **Version:** 1.0  
> **Status:** 📋 Planned  
> **Priority:** HIGH  
> **Effort:** 4 weeks

---

## Overview

Enterprise-grade deployment capabilities for MiniCluster, focusing on zero-downtime updates, atomic deployments, and easy rollbacks.

---

## Deployment Modes

### 1. Basic Deployment
Simple stop-update-start for development/testing.

```bash
mc deploy basic myapp-api --artifact ./api.zip
```

**Steps:**
1. Stop service
2. Backup current version
3. Deploy new artifact
4. Start service
5. Verify health

**Downtime:** Yes (seconds to minutes)  
**Use case:** Development, non-critical services

---

### 2. Rolling Deployment
Update instances one at a time with health checks.

```bash
mc deploy rolling myapp-api \
  --artifact ./api.zip \
  --batch-size 1 \
  --health-check-path /health \
  --health-timeout 30s
```

**Steps:**
1. For each instance:
   - Remove from load balancer
   - Stop service
   - Deploy new artifact  
   - Start service
   - Health check
   - Add back to load balancer
2. Verify overall health

**Downtime:** Zero (with multiple instances)  
**Use case:** Production services with redundancy

---

### 3. Blue-Green Deployment
Run two parallel environments, switch traffic atomically.

```bash
mc deploy blue-green myapp-api \
  --artifact ./api.zip \
  --warmup 30s \
  --switch-at-health 100%
```

**Architecture:**
```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │    (YARP)       │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
       ┌──────▼──────┐              ┌───────▼─────┐
       │ Blue (Live) │              │ Green (New) │
       │   v1.2.3    │              │   v1.2.4    │
       │  :5001      │              │  :5002      │
       └─────────────┘              └─────────────┘
```

**Steps:**
1. Deploy to inactive slot (Green)
2. Start and health check Green
3. Optionally warm up (synthetic traffic)
4. Switch load balancer to Green
5. Monitor for issues
6. Blue becomes inactive (ready for next deploy)
7. Optionally cleanup old Blue

**Downtime:** Zero  
**Use case:** Critical production services

---

### 4. Canary Deployment
Gradually shift traffic to new version.

```bash
mc deploy canary myapp-api \
  --artifact ./api.zip \
  --stages "10%,25%,50%,100%" \
  --stage-duration 5m \
  --rollback-on-error-rate 5%
```

**Traffic Progression:**
```
[======----]  10%  ←  Monitor 5 min
[=========-]  25%  ←  Monitor 5 min
[==========]  50%  ←  Monitor 5 min
[==========] 100%  ←  Complete
```

**Auto-rollback triggers:**
- Error rate exceeds threshold
- Latency increases significantly
- Health check failures
- Memory/CPU anomalies

**Downtime:** Zero  
**Use case:** Large-scale production, risk-averse

---

## Deployment Configuration

### Service Definition
```yaml
# service.yaml
deployment:
  strategy: blue-green           # basic, rolling, blue-green, canary
  
  healthCheck:
    type: http                   # http, tcp, command
    path: /health
    interval: 10s
    timeout: 5s
    successThreshold: 3
    failureThreshold: 2
  
  warmup:
    enabled: true
    duration: 30s
    requests:                    # Synthetic requests for warmup
      - path: /api/warmup
        method: GET
  
  rollback:
    automatic: true
    triggers:
      - errorRate: 5%
      - p99Latency: 500ms
      - healthChecksFailing: 2
    keepVersions: 5              # Keep last 5 versions for rollback
  
  slots:                         # Blue-green slots
    blue:
      port: 5001
    green:
      port: 5002
```

---

## Artifact Management

### Supported Artifact Types

| Type | Extension | Handler |
|------|-----------|---------|
| ZIP Archive | `.zip` | Extract to destination |
| TAR Archive | `.tar.gz` | Extract to destination |
| Single Executable | `.exe`, no ext | Copy to destination |
| .NET Publish | `publish/` dir | Copy folder structure |
| Docker Image | `docker://` | Pull and run |

### Artifact Storage
```
/var/minicluster/
  artifacts/
    myapp-api/
      v1.2.3/                    # Version directory
        artifact.zip             # Original artifact
        extracted/               # Extracted contents
        metadata.json            # Version metadata
      v1.2.4/
      current -> v1.2.4/         # Symlink to active
      previous -> v1.2.3/        # Symlink for rollback
```

### Version Metadata
```json
{
  "version": "1.2.4",
  "deployedAt": "2024-01-15T10:30:00Z",
  "deployedBy": "ci-pipeline",
  "gitCommit": "abc123",
  "gitBranch": "main",
  "buildNumber": "456",
  "checksum": "sha256:xxxxx"
}
```

---

## Load Balancer Integration (YARP)

### Dynamic Route Updates
```csharp
// Update YARP routes without restart
await _routeManager.UpdateRoute("myapp-api", new RouteConfig
{
    Destinations = new Dictionary<string, DestinationConfig>
    {
        ["blue"] = new() { Address = "http://localhost:5001", Health = "healthy" },
        ["green"] = new() { Address = "http://localhost:5002", Health = "healthy" }
    },
    LoadBalancingPolicy = "RoundRobin"
});
```

### Traffic Splitting (Canary)
```csharp
// Configure weighted traffic
await _routeManager.SetTrafficWeights("myapp-api", new Dictionary<string, int>
{
    ["v1.2.3"] = 90,   // 90% to old version
    ["v1.2.4"] = 10    // 10% to canary
});
```

---

## Rollback

### Manual Rollback
```bash
# Rollback to previous version
mc rollback myapp-api

# Rollback to specific version
mc rollback myapp-api --to v1.2.2
```

### Automatic Rollback
Configured triggers:
```yaml
rollback:
  automatic: true
  triggers:
    - errorRate: 5%              # >5% HTTP 5xx responses
    - p99Latency: 500ms          # p99 exceeds threshold
    - healthChecksFailing: 2     # 2 consecutive failures
    - memoryUsage: 90%           # Memory exceeds threshold
```

### Rollback Steps
1. Stop traffic to new version
2. Route all traffic to previous version
3. Stop new version
4. Mark rollback in audit log
5. Alert operators

---

## CLI Commands

```bash
# Deploy commands
mc deploy <strategy> <service> --artifact <path> [options]
mc deploy status <deployment-id>
mc deploy cancel <deployment-id>
mc deploy list [--app <app>] [--status active|completed|failed]

# Rollback commands
mc rollback <service> [--to <version>]
mc rollback history <service>

# Version management
mc version list <service>
mc version info <service> <version>
mc version delete <service> <version>
mc version promote <service> <version>  # Make version active

# Slot management (blue-green)
mc slot status <service>
mc slot switch <service>                # Switch active slot
mc slot warmup <service> <slot>        # Manually warm up slot
```

---

## API Endpoints

```
# Deployments
POST   /api/services/{id}/deploy              Start deployment
GET    /api/services/{id}/deployments         List deployments
GET    /api/services/{id}/deployments/{did}   Get deployment status
POST   /api/services/{id}/deployments/{did}/cancel
POST   /api/services/{id}/rollback

# Versions
GET    /api/services/{id}/versions
GET    /api/services/{id}/versions/{version}
DELETE /api/services/{id}/versions/{version}

# Slots (blue-green)
GET    /api/services/{id}/slots
POST   /api/services/{id}/slots/switch
```

---

## Deployment Events

Real-time deployment progress via SignalR:

```typescript
// Subscribe to deployment events
connection.on("deployment:progress", (event) => {
  // { deploymentId, step, progress, message }
  updateDeploymentUI(event);
});

connection.on("deployment:completed", (event) => {
  showSuccess(`Deployment ${event.version} completed`);
});

connection.on("deployment:failed", (event) => {
  showError(`Deployment failed: ${event.error}`);
});

connection.on("deployment:rollback", (event) => {
  showWarning(`Rolling back to ${event.previousVersion}`);
});
```

---

## UI Components

### Deployment Modal
```
┌─────────────────────────────────────────────────────────┐
│  Deploy myapp-api                               [×]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Artifact:  [Browse...] api-v1.2.4.zip                 │
│                                                         │
│  Strategy:  ○ Basic  ○ Rolling  ● Blue-Green  ○ Canary │
│                                                         │
│  Health Check:                                          │
│    Path: [/health          ]                           │
│    Timeout: [30] seconds                               │
│                                                         │
│  ☑ Enable warmup (30s)                                 │
│  ☑ Automatic rollback on errors                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                          [Cancel]  [Deploy]            │
└─────────────────────────────────────────────────────────┘
```

### Deployment Progress
```
┌─────────────────────────────────────────────────────────┐
│  Deploying myapp-api v1.2.4                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✓ Uploaded artifact                                   │
│  ✓ Extracted to /var/minicluster/artifacts/...         │
│  ✓ Started service on Green slot (:5002)               │
│  ● Running health checks... (2/3)                      │
│  ○ Switch traffic                                       │
│  ○ Cleanup old version                                  │
│                                                         │
│  ████████████░░░░░░░░░░░░░░░░  45%                     │
│                                                         │
│  [Cancel Deployment]                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Basic & Rolling (Week 1-2)
1. Artifact upload and storage
2. Version management API
3. Basic deployment with backup
4. Health check infrastructure
5. Rolling deployment logic
6. Deployment status tracking

### Phase 2: Blue-Green (Week 3)
1. Slot management
2. YARP dynamic route updates
3. Traffic switching logic
4. Warmup mechanism
5. UI for slot status

### Phase 3: Canary & Rollback (Week 4)
1. Traffic splitting in YARP
2. Canary progression logic
3. Metric-based auto-rollback
4. Rollback API and CLI
5. Complete deployment UI

---

## References

- CLI deploy commands: `spec4/09-cli/CLI_SPECIFICATION.md#deploy`
- YARP configuration: `ControlCenter.Api/Configuration/YarpConfiguration.cs`
- Health checks: `ControlCenter.Api/Services/HealthCheckService.cs`
