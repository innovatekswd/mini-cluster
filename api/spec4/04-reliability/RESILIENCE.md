# Reliability & Resilience

> **Version:** 1.0  
> **Status:** 🔶 Partially Implemented  
> **Priority:** HIGH  
> **Effort:** 2 weeks remaining

---

## Overview

MiniCluster incorporates comprehensive reliability features to ensure services remain available and recoverable from failures.

---

## Current Implementation (✅)

### Process Supervision
- Automatic restart on crash (configurable)
- Grace period before restart
- Maximum restart attempts
- Process health monitoring

### Service Recovery
- Graceful shutdown handling
- State persistence across restarts
- Pending service restoration on API startup

### Error Handling
- Structured error responses
- Exception middleware
- Validation error formatting

---

## Reliability Features

### 1. Health Checks (✅ Partial)

#### Types
| Type | Description | Use Case |
|------|-------------|----------|
| **Process** | Check if process is running | All services |
| **HTTP** | GET endpoint returns 2xx | Web services |
| **TCP** | Port is accepting connections | Network services |
| **Command** | Script returns exit code 0 | Custom checks |

#### Configuration
```yaml
services:
  myapp-api:
    healthCheck:
      type: http
      endpoint: /health
      interval: 10s
      timeout: 5s
      retries: 3
      startPeriod: 30s        # Ignore failures during startup
```

#### Health Status
```csharp
public enum HealthStatus
{
    Unknown,
    Starting,      // Within startPeriod
    Healthy,       // Passing checks
    Degraded,      // Some checks failing
    Unhealthy      // Critical checks failing
}
```

---

### 2. Auto-Restart & Recovery (✅ Implemented)

#### Restart Policies
```yaml
services:
  myapp-api:
    restart:
      policy: on-failure      # always, on-failure, never
      maxAttempts: 3          # 0 = unlimited
      window: 60s             # Reset counter after success window
      backoff:
        initial: 1s
        max: 30s
        multiplier: 2
```

#### Restart Behavior
```
Crash #1 → Wait 1s → Restart
Crash #2 → Wait 2s → Restart  
Crash #3 → Wait 4s → Restart
Crash #4 → Give up (maxAttempts reached)

After 60s of healthy running → Reset crash counter
```

---

### 3. Graceful Shutdown (✅ Implemented)

#### Shutdown Sequence
```
1. Send SIGTERM (or Windows equivalent)
2. Wait for gracePeriod (default 10s)
3. Process should cleanup and exit
4. If still running after gracePeriod:
   - Send SIGKILL (force kill)
5. Update status to Stopped
```

#### Configuration
```yaml
services:
  myapp-api:
    shutdown:
      gracePeriod: 30s        # Time to wait for graceful exit
      preStopCommand: null    # Optional pre-stop hook
```

---

### 4. Dependency Management (📋 Planned)

#### Service Dependencies
```yaml
services:
  myapp-api:
    dependsOn:
      - name: database
        condition: healthy    # started, healthy, completed
      - name: redis
        condition: started
    
  database:
    # Starts first, API waits
```

#### Startup Order
```
1. Start services with no dependencies
2. Wait for conditions to be met
3. Start dependent services
4. Repeat until all started
```

#### Circular Dependency Detection
```csharp
// Throws at configuration time
throw new InvalidOperationException(
    "Circular dependency detected: api -> cache -> api");
```

---

### 5. Circuit Breaker (📋 Planned)

Prevent cascading failures when dependent services are unhealthy.

```yaml
services:
  myapp-api:
    circuitBreaker:
      enabled: true
      failureThreshold: 5     # Failures before opening
      successThreshold: 3     # Successes to close
      timeout: 30s            # Time in open state before half-open
```

#### States
```
┌─────────┐  failures >= threshold  ┌─────────┐
│ CLOSED  │ ───────────────────────▶│  OPEN   │
│         │                         │         │
└────┬────┘                         └────┬────┘
     │ ▲                                 │
     │ │                          timeout│
     │ │ successes >= threshold          │
     │ │                                 ▼
     │ │                          ┌───────────┐
     │ └──────────────────────────│ HALF-OPEN │
     │         success            │           │
     └────────────────────────────└───────────┘
              failure ────────────▶ OPEN
```

---

### 6. Rate Limiting (📋 Planned)

Protect services from overload.

```yaml
services:
  myapp-api:
    rateLimit:
      enabled: true
      requestsPerSecond: 100
      burstSize: 20
      responseCode: 429
```

---

### 7. Resource Limits (📋 Planned)

Prevent runaway services from affecting the system.

```yaml
services:
  myapp-api:
    resources:
      memory:
        limit: 512Mi
        warning: 400Mi        # Alert when exceeded
      cpu:
        limit: 200%           # 2 cores max
      fileDescriptors: 1024
```

#### Actions on Limit Breach
- Log warning at warning threshold
- Restart service at hard limit
- Send alert notification

---

### 8. Watchdog (📋 Planned)

System-level reliability for the MiniCluster API itself.

```bash
# Systemd watchdog integration
[Service]
WatchdogSec=30
Restart=always

# MiniCluster periodically notifies systemd
sd_notify(0, "WATCHDOG=1");
```

---

## Alerting & Notifications

### Alert Configuration
```yaml
alerts:
  channels:
    - name: email
      type: smtp
      config:
        server: smtp.example.com
        to: ops@example.com
    
    - name: slack
      type: webhook
      config:
        url: https://hooks.slack.com/...
  
  rules:
    - name: service-down
      condition: service.status == 'stopped' && service.restart.failed
      severity: critical
      channels: [email, slack]
    
    - name: high-memory
      condition: service.memory > service.resources.memory.warning
      severity: warning
      channels: [slack]
```

### Alert Types
| Alert | Trigger | Severity |
|-------|---------|----------|
| Service Down | Service stopped unexpectedly | Critical |
| Restart Failed | Max restart attempts exceeded | Critical |
| Health Degraded | Health checks failing | Warning |
| Resource Warning | Memory/CPU near limit | Warning |
| Deployment Failed | Deployment error | Critical |
| Rollback Triggered | Auto-rollback activated | Warning |

---

## Monitoring Integration

### Prometheus Metrics
```
# Service health
minicluster_service_health_status{service="myapp-api"} 1

# Restart counts
minicluster_service_restarts_total{service="myapp-api"} 3

# Resource usage
minicluster_service_memory_bytes{service="myapp-api"} 104857600
minicluster_service_cpu_percent{service="myapp-api"} 25.5

# API health
minicluster_api_healthy 1
minicluster_api_uptime_seconds 86400
```

### Health Endpoint
```
GET /health
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "latency": "5ms" },
    "diskSpace": { "status": "healthy", "free": "50GB" }
  },
  "services": {
    "healthy": 15,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

---

## Backup & Recovery

### Configuration Backup
```bash
# Automated backup
mc backup create --output /backup/minicluster-$(date +%Y%m%d).tar.gz

# Includes:
# - Database (services, apps, users)
# - Configuration files
# - Service definitions
```

### Disaster Recovery
```bash
# Restore from backup
mc backup restore /backup/minicluster-20240115.tar.gz

# Steps:
# 1. Stop all services
# 2. Restore database
# 3. Restore configuration
# 4. Start services according to dependency order
```

---

## Implementation Plan

### Phase 1: Health & Dependencies (1 week)
1. Implement HTTP/TCP/Command health checks
2. Health status tracking and history
3. Service dependency graph
4. Startup order orchestration
5. Health dashboard widget

### Phase 2: Protection Features (1 week)
1. Circuit breaker implementation
2. Rate limiting middleware
3. Resource limit monitoring
4. Alert configuration system
5. Webhook/email notifications

---

## References

- Process manager: `ControlCenter.Api/Services/ProcessManager.cs`
- Resilience improvements: `../RESILIENCE_IMPROVEMENTS.md`
- Service entity: `ControlCenter.Core/Entities/Service.cs`
