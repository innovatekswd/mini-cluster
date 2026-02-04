# 005: Reliability & Orchestration

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 3 - Reliability  
**Priority:** 🔴 CRITICAL  
**Effort:** 12-16 weeks  
**Original Spec:** [../spec/005-reliability-orchestration/spec.md](../../spec/005-reliability-orchestration/spec.md)

---

## Summary

Transform MiniCluster from a simple process manager into a production-grade DevOps orchestration platform with reliability, health monitoring, and observability.

## Key Features ⬜

### 1. Auto-Restart Policies (2 weeks)
- ⬜ **Never** - Don't restart automatically
- ⬜ **OnFailure** - Restart only if exit code != 0
- ⬜ **Always** - Always restart, even on success
- ⬜ **UnlessStopped** - Restart unless manually stopped
- ⬜ **Exponential backoff** with jitter (prevent restart storms)
- ⬜ **Max restart attempts** with cooldown periods

### 2. Health Checks (3 weeks)
- ⬜ **HTTP health checks** - GET endpoint, expect 200 OK
- ⬜ **TCP port checks** - Verify port is listening
- ⬜ **Exec checks** - Run command, check exit code
- ⬜ **Process checks** - Verify process is running
- ⬜ **Configurable intervals** - Check frequency
- ⬜ **Failure thresholds** - How many failures before action
- ⬜ **Actions on failure** - Restart, stop, alert

### 3. App/Service/Process Hierarchy (2 weeks)
- ⬜ **Apps** - Logical grouping of services
- ⬜ **Services** - Individual processes within app
- ⬜ **Processes** - Actual OS process instances
- ⬜ **Dependencies** between services
- ⬜ **Start order enforcement**

### 4. Startup Plans (2 weeks)
- ⬜ **Dependency graphs** - Service A requires Service B
- ⬜ **Parallel startup** - Start independent services concurrently
- ⬜ **Sequential startup** - Wait for dependencies
- ⬜ **Startup timeout** - Fail if service doesn't start
- ⬜ **Rollback on failure** - Stop all if one fails

### 5. OpenTelemetry Integration (3 weeks)
- ⬜ **OTLP receiver** - Ingest logs, metrics, traces
- ⬜ **Automatic instrumentation** - Capture process metrics
- ⬜ **TimescaleDB storage** - High-volume time-series data
- ⬜ **Prometheus export** - Metrics endpoint
- ⬜ **Trace correlation** - Link logs, metrics, traces

### 6. Marketplace & Templates (2-3 weeks)
- ⬜ **Template system** - Pre-configured app blueprints
- ⬜ **One-click deployment** - Deploy PostgreSQL, Redis, Node.js apps
- ⬜ **Template variables** - Customize during deployment
- ⬜ **Community marketplace** - Share templates
- ⬜ **Version management** - Template versioning

## Why This Matters

**Current State:**
- ❌ Apps crash and stay down
- ❌ No health monitoring
- ❌ Manual restarts required
- ❌ No insight into why failures happen
- ❌ Complex apps hard to manage

**After Implementation:**
- ✅ Self-healing (auto-restart)
- ✅ Proactive health monitoring
- ✅ Automatic recovery from failures
- ✅ Full observability (logs, metrics, traces)
- ✅ Manage complex multi-service apps

## Technical Design

### Database Schema
```sql
-- Restart policies
ALTER TABLE Apps ADD RestartPolicy VARCHAR(50) DEFAULT 'OnFailure';
ALTER TABLE Apps ADD MaxRestartAttempts INT DEFAULT 3;
ALTER TABLE Apps ADD RestartDelay INT DEFAULT 5; -- seconds

-- Health checks
CREATE TABLE HealthChecks (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER,
  Type VARCHAR(20), -- HTTP, TCP, Exec, Process
  Config TEXT, -- JSON config
  Interval INT, -- seconds
  FailureThreshold INT,
  Action VARCHAR(20) -- Restart, Stop, Alert
);

-- Dependencies
CREATE TABLE AppDependencies (
  AppId INTEGER,
  DependsOnAppId INTEGER,
  StartDelay INT -- seconds to wait after dependency starts
);
```

### Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Auto-restart policies, backoff | 2 |
| 2 | Health checks (HTTP, TCP, Exec) | 3 |
| 3 | App/Service hierarchy | 2 |
| 4 | Startup plans & dependencies | 2 |
| 5 | OTLP integration & TimescaleDB | 3 |
| 6 | Marketplace & templates | 2-3 |

**Total:** 12-16 weeks

## Dependencies

- **Recommended:** 003 Authentication (for secure marketplace)
- **None required** (foundational feature)

## Related Features

- **Required by:** 006 Container Support (health checks)
- **Required by:** 013 Analytics (OTLP data)
- **Enhanced by:** 008 Hierarchical Apps (better organization)

---

For complete details, see the [full reliability & orchestration spec](../../spec/005-reliability-orchestration/spec.md).
