# Feature 005: Reliability, Orchestration & Observability

> **⚠️ STATUS UPDATE — This mega-spec has been partially implemented and partially split into dedicated specs.**
>
> | Part | Status | Notes |
> |------|--------|-------|
> | **Part 1: Reliability** (auto-restart, health checks) | **✅ DONE** | Implemented in MVP Phase 1. `Service` entity (table: `ControlledApps`) already has `RestartPolicy`, `MaxRestarts`, `RestartWindowSeconds`, `HealthCheckType`, `HealthCheckTarget`, etc. |
> | **Part 2: Orchestration** (hierarchy) | **⚠️ SUPERSEDED by Spec 008** | This part's entity model conflicts with the codebase. Use [Spec 008](../008-hierarchical-apps/spec.md) instead — it adds `ParentAppId` to `App` without introducing duplicate entities. |
> | **Part 3: Scheduled Tasks** | **⚠️ SUPERSEDED by Spec 011** | Use [Spec 011](../011-cron-scheduling/spec.md) for cron scheduling. |
> | **Part 4: Observability** (OTLP, TimescaleDB) | **⏳ Future** | Separate roadmap item. Content below is still valid as a reference spec. |
> | **Part 5: Marketplace** | **⏳ Future** | Separate roadmap item. Content below is still valid as a reference spec. |
>
> **Entity naming fixes:**
> - This spec uses `App` to mean a runnable process — in the codebase, that's `Service` (table: `ControlledApps`)
> - `App` in the codebase is a flat grouping container only
> - `ServiceGroup` already provides hierarchical tagging with variable inheritance

## Overview

Transform MiniCluster from a process manager into a full DevOps platform with:
- **Reliability**: Auto-restart, health checks, backoff strategies — **✅ Done**
- **Orchestration**: App/Service/Process hierarchy, startup plans, dependencies — **→ Spec 008**
- **Observability**: OTLP integration, TimescaleDB for telemetry, centralized logging — **Future**
- **Marketplace**: Template ecosystem for one-click deployments — **Future**

---

## Business Value

### Target Market Pain Points

| Problem | Current Solution | MiniCluster Solution |
|---------|-----------------|---------------------|
| Windows container overhead | Docker Desktop (slow, licensed) | Native process management |
| Remote Windows management | RDP (doesn't scale) | Web UI, no direct access needed |
| Service crashes | Manual restart / scripts | Auto-restart with policies |
| Log aggregation | SSH + tail -f | Centralized OTLP + TimescaleDB |
| Multi-service startup | Manual ordering | Dependency-aware startup plans |
| Complex deployments | Documentation + manual steps | One-click marketplace templates |

### Positioning

> **"MiniCluster: The DevOps platform that works on Windows without containers"**

- Linux DevOps world has great tools
- Windows world is underserved
- MiniCluster fills the gap with native process support

---

## Part 1: Reliability Features

### 1.1 Auto-Restart Policies

#### Entity Changes

```csharp
public enum RestartPolicy
{
    Never = 0,        // Don't restart on exit
    OnFailure = 1,    // Restart only on non-zero exit code
    Always = 2,       // Always restart (except manual stop)
    UnlessStopped = 3 // Restart unless explicitly stopped
}

public class App
{
    // Existing fields...
    
    // New reliability fields
    public RestartPolicy RestartPolicy { get; set; } = RestartPolicy.Never;
    public int MaxRestarts { get; set; } = 5;           // Max restarts in window
    public int RestartWindowSeconds { get; set; } = 300; // 5 minute window
    public int RestartDelaySeconds { get; set; } = 5;    // Initial delay
    public int MaxRestartDelaySeconds { get; set; } = 300; // Max backoff delay
    public bool UseExponentialBackoff { get; set; } = true;
    
    // Restart tracking
    public int ConsecutiveFailures { get; set; } = 0;
    public DateTime? LastRestartAttempt { get; set; }
    public DateTime? CooldownUntil { get; set; }
}
```

#### Restart State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESTART STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐      exit      ┌────────────────┐                │
│   │ Running │ ─────────────► │ Evaluate Policy │                │
│   └─────────┘                └───────┬────────┘                │
│       ▲                              │                          │
│       │                    ┌─────────┴─────────┐               │
│       │                    ▼                   ▼               │
│       │            ┌──────────────┐    ┌──────────────┐        │
│       │            │ Should       │    │ Should NOT   │        │
│       │            │ Restart      │    │ Restart      │        │
│       │            └──────┬───────┘    └──────┬───────┘        │
│       │                   │                   │                 │
│       │                   ▼                   ▼                 │
│       │            ┌──────────────┐    ┌──────────────┐        │
│       │            │ Check Max    │    │   Stopped    │        │
│       │            │ Restarts     │    │   (final)    │        │
│       │            └──────┬───────┘    └──────────────┘        │
│       │                   │                                     │
│       │         ┌─────────┴─────────┐                          │
│       │         ▼                   ▼                          │
│       │  ┌──────────────┐    ┌──────────────┐                  │
│       │  │ Under Limit  │    │ Over Limit   │                  │
│       │  │ (can restart)│    │ (cooldown)   │                  │
│       │  └──────┬───────┘    └──────┬───────┘                  │
│       │         │                   │                          │
│       │         ▼                   ▼                          │
│       │  ┌──────────────┐    ┌──────────────┐                  │
│       │  │ Apply Backoff│    │ In Cooldown  │                  │
│       │  │ Delay        │    │ (wait)       │                  │
│       │  └──────┬───────┘    └──────────────┘                  │
│       │         │                                               │
│       └─────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Backoff Algorithm

```csharp
public class RestartBackoffCalculator
{
    public TimeSpan CalculateDelay(App app)
    {
        if (!app.UseExponentialBackoff)
            return TimeSpan.FromSeconds(app.RestartDelaySeconds);
        
        // Exponential backoff: delay * 2^failures
        var delay = app.RestartDelaySeconds * Math.Pow(2, app.ConsecutiveFailures);
        delay = Math.Min(delay, app.MaxRestartDelaySeconds);
        
        // Add jitter (±10%) to prevent thundering herd
        var jitter = delay * 0.1 * (Random.Shared.NextDouble() - 0.5);
        
        return TimeSpan.FromSeconds(delay + jitter);
    }
    
    public bool ShouldRestart(App app, int exitCode)
    {
        return app.RestartPolicy switch
        {
            RestartPolicy.Never => false,
            RestartPolicy.OnFailure => exitCode != 0,
            RestartPolicy.Always => true,
            RestartPolicy.UnlessStopped => !app.WasManuallyStopped,
            _ => false
        };
    }
    
    public bool IsInCooldown(App app)
    {
        if (app.CooldownUntil == null) return false;
        return DateTime.UtcNow < app.CooldownUntil;
    }
    
    public bool HasExceededMaxRestarts(App app)
    {
        var windowStart = DateTime.UtcNow.AddSeconds(-app.RestartWindowSeconds);
        // Count restarts in window from RestartHistory
        return app.RestartsInWindow >= app.MaxRestarts;
    }
}
```

---

### 1.2 Health Checks

#### Entity

```csharp
public enum HealthCheckType
{
    None = 0,
    Http = 1,      // HTTP GET returns 2xx
    Tcp = 2,       // TCP port is open
    Exec = 3,      // Command returns exit code 0
    Process = 4    // Process is running (default)
}

public class HealthCheck
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    public App App { get; set; } = null!;
    
    public HealthCheckType Type { get; set; } = HealthCheckType.Process;
    
    // HTTP health check
    public string? HttpUrl { get; set; }           // e.g., "http://localhost:8080/health"
    public string? HttpMethod { get; set; } = "GET";
    public int HttpExpectedStatusCode { get; set; } = 200;
    public string? HttpExpectedBody { get; set; }  // Optional: body must contain this
    
    // TCP health check
    public string? TcpHost { get; set; } = "localhost";
    public int? TcpPort { get; set; }
    
    // Exec health check
    public string? ExecCommand { get; set; }
    public string? ExecArgs { get; set; }
    public int ExecTimeoutSeconds { get; set; } = 10;
    
    // Timing
    public int IntervalSeconds { get; set; } = 30;      // Check every N seconds
    public int TimeoutSeconds { get; set; } = 10;       // Timeout for each check
    public int StartDelaySeconds { get; set; } = 10;    // Wait before first check
    public int FailureThreshold { get; set; } = 3;      // Failures before unhealthy
    public int SuccessThreshold { get; set; } = 1;      // Successes before healthy
    
    // State
    public int ConsecutiveFailures { get; set; } = 0;
    public int ConsecutiveSuccesses { get; set; } = 0;
    public DateTime? LastCheck { get; set; }
    public bool? LastCheckSuccess { get; set; }
    public string? LastCheckMessage { get; set; }
}

public enum HealthStatus
{
    Unknown = 0,
    Starting = 1,   // In start delay period
    Healthy = 2,
    Unhealthy = 3,
    Degraded = 4    // Some checks pass, some fail
}
```

#### Health Check Service

```csharp
public interface IHealthCheckService
{
    Task<HealthCheckResult> CheckAsync(HealthCheck config, CancellationToken ct);
    Task StartMonitoringAsync(Guid appId);
    Task StopMonitoringAsync(Guid appId);
}

public class HealthCheckResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public TimeSpan Duration { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class HealthCheckService : IHealthCheckService
{
    public async Task<HealthCheckResult> CheckAsync(HealthCheck config, CancellationToken ct)
    {
        return config.Type switch
        {
            HealthCheckType.Http => await CheckHttpAsync(config, ct),
            HealthCheckType.Tcp => await CheckTcpAsync(config, ct),
            HealthCheckType.Exec => await CheckExecAsync(config, ct),
            HealthCheckType.Process => CheckProcess(config),
            _ => new HealthCheckResult { Success = true, Message = "No check configured" }
        };
    }
    
    private async Task<HealthCheckResult> CheckHttpAsync(HealthCheck config, CancellationToken ct)
    {
        using var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(config.TimeoutSeconds);
        
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await client.GetAsync(config.HttpUrl, ct);
            sw.Stop();
            
            var success = (int)response.StatusCode == config.HttpExpectedStatusCode;
            
            if (success && !string.IsNullOrEmpty(config.HttpExpectedBody))
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                success = body.Contains(config.HttpExpectedBody);
            }
            
            return new HealthCheckResult
            {
                Success = success,
                Message = $"HTTP {(int)response.StatusCode}",
                Duration = sw.Elapsed
            };
        }
        catch (Exception ex)
        {
            return new HealthCheckResult
            {
                Success = false,
                Message = ex.Message,
                Duration = sw.Elapsed
            };
        }
    }
    
    private async Task<HealthCheckResult> CheckTcpAsync(HealthCheck config, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(config.TcpHost!, config.TcpPort!.Value);
            
            if (await Task.WhenAny(connectTask, Task.Delay(config.TimeoutSeconds * 1000, ct)) == connectTask)
            {
                sw.Stop();
                return new HealthCheckResult
                {
                    Success = true,
                    Message = $"TCP port {config.TcpPort} is open",
                    Duration = sw.Elapsed
                };
            }
            
            return new HealthCheckResult
            {
                Success = false,
                Message = "Connection timeout",
                Duration = sw.Elapsed
            };
        }
        catch (Exception ex)
        {
            return new HealthCheckResult
            {
                Success = false,
                Message = ex.Message,
                Duration = sw.Elapsed
            };
        }
    }
}
```

#### Integration with Restart

```csharp
// In ProcessMonitoringService or new HealthMonitoringService
public class HealthMonitoringService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var apps = await _db.Apps
                .Include(a => a.HealthChecks)
                .Where(a => a.Status == AppStatus.Running)
                .ToListAsync(stoppingToken);
            
            foreach (var app in apps)
            {
                foreach (var check in app.HealthChecks)
                {
                    if (ShouldCheck(check))
                    {
                        var result = await _healthCheckService.CheckAsync(check, stoppingToken);
                        await UpdateHealthStatus(app, check, result);
                        
                        // Trigger restart if unhealthy and policy allows
                        if (!result.Success && 
                            check.ConsecutiveFailures >= check.FailureThreshold &&
                            app.RestartPolicy != RestartPolicy.Never)
                        {
                            _logger.LogWarning("App {AppName} failed health check, triggering restart", app.Name);
                            await _processManager.RestartAppAsync(app.Id, "Health check failed");
                        }
                    }
                }
            }
            
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

---

## Part 2: Orchestration - App/Service/Process Hierarchy

### 2.1 Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        HIERARCHY                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APPLICATION (e.g., "E-Commerce Platform")                      │
│  ├── Metadata (name, description, version)                      │
│  ├── Global variables                                           │
│  ├── Startup plan                                               │
│  │                                                              │
│  ├── SERVICE: "API" (logical group)                             │
│  │   ├── Startup order: 2                                       │
│  │   ├── Dependencies: ["Database"]                             │
│  │   ├── Replicas: 2                                            │
│  │   │                                                          │
│  │   ├── PROCESS: "api-1" (actual OS process)                   │
│  │   │   ├── Command, args, env                                 │
│  │   │   ├── Health checks                                      │
│  │   │   └── Restart policy                                     │
│  │   │                                                          │
│  │   └── PROCESS: "api-2" (replica)                             │
│  │       └── ...                                                │
│  │                                                              │
│  ├── SERVICE: "Database"                                        │
│  │   ├── Startup order: 1                                       │
│  │   ├── Dependencies: []                                       │
│  │   └── PROCESS: "postgres"                                    │
│  │                                                              │
│  └── SERVICE: "Worker"                                          │
│      ├── Startup order: 3                                       │
│      ├── Dependencies: ["API", "Database"]                      │
│      └── PROCESS: "worker-1"                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Entities

```csharp
// Top-level application (group of services)
public class Application
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Version { get; set; }
    
    // Global settings
    public Dictionary<string, string> Variables { get; set; } = new();
    public StartupPlan? StartupPlan { get; set; }
    
    // Metadata
    public bool AutoStart { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Children
    public ICollection<Service> Services { get; set; } = new List<Service>();
}

// Service (logical group of processes)
public class Service
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    
    // Startup configuration
    public int StartupOrder { get; set; } = 0;
    public List<string> DependsOn { get; set; } = new();  // Service names
    public int DesiredReplicas { get; set; } = 1;
    
    // Health check for service level
    public HealthStatus HealthStatus { get; set; } = HealthStatus.Unknown;
    
    // Restart policy (can override at process level)
    public RestartPolicy RestartPolicy { get; set; } = RestartPolicy.OnFailure;
    
    // Children (processes/apps)
    public ICollection<App> Processes { get; set; } = new List<App>();
}

// Modify existing App to be a "Process" in hierarchy
public class App
{
    // Existing fields...
    
    // New: Optional parent service
    public Guid? ServiceId { get; set; }
    public Service? Service { get; set; }
    
    // Replica info
    public int ReplicaIndex { get; set; } = 0;  // 0 = primary, 1+ = replicas
    public bool IsReplica => ReplicaIndex > 0;
}
```

### 2.3 Startup Plans

```csharp
public class StartupPlan
{
    public int Id { get; set; }
    public Guid ApplicationId { get; set; }
    
    public string Name { get; set; } = "";
    public StartupStrategy Strategy { get; set; } = StartupStrategy.Sequential;
    
    public List<StartupStage> Stages { get; set; } = new();
}

public enum StartupStrategy
{
    Sequential = 0,      // One service at a time
    Parallel = 1,        // All at once
    DependencyGraph = 2  // Based on DependsOn
}

public class StartupStage
{
    public int Order { get; set; }
    public List<string> Services { get; set; } = new();  // Services to start in this stage
    public int WaitSeconds { get; set; } = 0;            // Wait after stage
    public bool WaitForHealthy { get; set; } = true;     // Wait for health checks
}
```

#### Startup Executor

```csharp
public class StartupPlanExecutor
{
    public async Task ExecuteAsync(Application application, CancellationToken ct)
    {
        var plan = application.StartupPlan;
        
        if (plan == null || plan.Strategy == StartupStrategy.Parallel)
        {
            // Start all services in parallel
            await StartAllParallelAsync(application.Services, ct);
            return;
        }
        
        if (plan.Strategy == StartupStrategy.DependencyGraph)
        {
            await StartByDependencyGraphAsync(application.Services, ct);
            return;
        }
        
        // Sequential by stages
        foreach (var stage in plan.Stages.OrderBy(s => s.Order))
        {
            var servicesToStart = application.Services
                .Where(s => stage.Services.Contains(s.Name))
                .ToList();
            
            // Start services in this stage
            var tasks = servicesToStart.Select(s => StartServiceAsync(s, ct));
            await Task.WhenAll(tasks);
            
            // Wait for healthy if required
            if (stage.WaitForHealthy)
            {
                await WaitForHealthyAsync(servicesToStart, TimeSpan.FromMinutes(5), ct);
            }
            
            // Wait between stages
            if (stage.WaitSeconds > 0)
            {
                await Task.Delay(TimeSpan.FromSeconds(stage.WaitSeconds), ct);
            }
        }
    }
    
    private async Task StartByDependencyGraphAsync(IEnumerable<Service> services, CancellationToken ct)
    {
        var graph = BuildDependencyGraph(services);
        var started = new HashSet<string>();
        
        while (started.Count < services.Count())
        {
            // Find services whose dependencies are all started
            var ready = services
                .Where(s => !started.Contains(s.Name))
                .Where(s => s.DependsOn.All(d => started.Contains(d)))
                .ToList();
            
            if (!ready.Any())
            {
                throw new InvalidOperationException("Circular dependency detected!");
            }
            
            // Start all ready services in parallel
            var tasks = ready.Select(s => StartServiceAsync(s, ct));
            await Task.WhenAll(tasks);
            
            // Wait for healthy
            await WaitForHealthyAsync(ready, TimeSpan.FromMinutes(5), ct);
            
            foreach (var s in ready)
                started.Add(s.Name);
        }
    }
}
```

---

## Part 3: Scheduled Tasks & Restarts

### 3.1 Schedule Entity

```csharp
public class Schedule
{
    public int Id { get; set; }
    public Guid? AppId { get; set; }
    public Guid? ServiceId { get; set; }
    public Guid? ApplicationId { get; set; }
    
    public string Name { get; set; } = "";
    public ScheduleType Type { get; set; }
    
    // Cron expression (e.g., "0 3 * * *" = daily at 3 AM)
    public string? CronExpression { get; set; }
    
    // Or interval-based
    public int? IntervalMinutes { get; set; }
    
    // Action to perform
    public ScheduleAction Action { get; set; }
    
    // State
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRun { get; set; }
    public DateTime? NextRun { get; set; }
    public string? LastRunResult { get; set; }
}

public enum ScheduleType
{
    Cron = 0,
    Interval = 1
}

public enum ScheduleAction
{
    Restart = 0,       // Restart app/service
    Start = 1,         // Start if stopped
    Stop = 2,          // Stop if running
    HealthCheck = 3,   // Force health check
    RunScript = 4      // Run custom script
}
```

### 3.2 Scheduler Service

```csharp
public class SchedulerService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var dueSchedules = await _db.Schedules
                .Where(s => s.IsEnabled && s.NextRun <= now)
                .ToListAsync(stoppingToken);
            
            foreach (var schedule in dueSchedules)
            {
                try
                {
                    await ExecuteScheduleAsync(schedule, stoppingToken);
                    schedule.LastRunResult = "Success";
                }
                catch (Exception ex)
                {
                    schedule.LastRunResult = $"Failed: {ex.Message}";
                    _logger.LogError(ex, "Schedule {Name} failed", schedule.Name);
                }
                
                schedule.LastRun = now;
                schedule.NextRun = CalculateNextRun(schedule);
            }
            
            await _db.SaveChangesAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
    
    private async Task ExecuteScheduleAsync(Schedule schedule, CancellationToken ct)
    {
        switch (schedule.Action)
        {
            case ScheduleAction.Restart:
                if (schedule.AppId.HasValue)
                    await _processManager.RestartAppAsync(schedule.AppId.Value, "Scheduled");
                else if (schedule.ServiceId.HasValue)
                    await RestartServiceAsync(schedule.ServiceId.Value, ct);
                break;
                
            case ScheduleAction.Start:
                // ...
                break;
                
            case ScheduleAction.Stop:
                // ...
                break;
        }
    }
}
```

---

## Part 4: Observability - OTLP & TimescaleDB

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────┐     OTLP/gRPC      ┌─────────────────┐         │
│   │  Your App │ ─────────────────► │  MiniCluster    │         │
│   │ (OTel SDK)│     :4317          │  OTLP Receiver  │         │
│   └───────────┘                    └────────┬────────┘         │
│                                             │                   │
│   ┌───────────┐     stdout/stderr  ┌────────┴────────┐         │
│   │ Process   │ ─────────────────► │  Log Collector  │         │
│   │ (managed) │                    │                 │         │
│   └───────────┘                    └────────┬────────┘         │
│                                             │                   │
│                                             ▼                   │
│   ┌─────────────────────────────────────────────────────┐      │
│   │                   TimescaleDB                        │      │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │      │
│   │  │  logs   │  │ metrics │  │  spans  │  │ events │ │      │
│   │  └─────────┘  └─────────┘  └─────────┘  └────────┘ │      │
│   └─────────────────────────────────────────────────────┘      │
│                          │                                      │
│            ┌─────────────┴─────────────┐                       │
│            ▼                           ▼                       │
│   ┌─────────────────┐        ┌─────────────────┐              │
│   │  MiniCluster UI │        │  Export to      │              │
│   │  (built-in)     │        │  Seq/Grafana/   │              │
│   │  - Log viewer   │        │  Loki/etc.      │              │
│   │  - Dashboards   │        │                 │              │
│   │  - Trace view   │        │                 │              │
│   └─────────────────┘        └─────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 TimescaleDB Schema

```sql
-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Logs hypertable
CREATE TABLE logs (
    time            TIMESTAMPTZ NOT NULL,
    app_id          UUID NOT NULL,
    service_id      UUID,
    application_id  UUID,
    level           SMALLINT NOT NULL,  -- 0=Trace..5=Fatal
    message         TEXT NOT NULL,
    attributes      JSONB,
    trace_id        TEXT,
    span_id         TEXT,
    exception       TEXT,
    source          TEXT  -- 'stdout', 'stderr', 'otlp'
);
SELECT create_hypertable('logs', 'time');
CREATE INDEX idx_logs_app ON logs (app_id, time DESC);
CREATE INDEX idx_logs_level ON logs (level, time DESC) WHERE level >= 3;

-- Metrics hypertable
CREATE TABLE metrics (
    time            TIMESTAMPTZ NOT NULL,
    app_id          UUID NOT NULL,
    name            TEXT NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    unit            TEXT,
    attributes      JSONB
);
SELECT create_hypertable('metrics', 'time');
CREATE INDEX idx_metrics_app_name ON metrics (app_id, name, time DESC);

-- Traces/Spans hypertable
CREATE TABLE spans (
    time            TIMESTAMPTZ NOT NULL,
    trace_id        TEXT NOT NULL,
    span_id         TEXT NOT NULL,
    parent_span_id  TEXT,
    app_id          UUID,
    name            TEXT NOT NULL,
    kind            SMALLINT,  -- 0=Internal, 1=Server, 2=Client, 3=Producer, 4=Consumer
    status          SMALLINT,  -- 0=Unset, 1=Ok, 2=Error
    duration_ns     BIGINT,
    attributes      JSONB,
    events          JSONB
);
SELECT create_hypertable('spans', 'time');
CREATE INDEX idx_spans_trace ON spans (trace_id, time);

-- Events (app lifecycle, user actions)
CREATE TABLE events (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    app_id          UUID,
    service_id      UUID,
    type            TEXT NOT NULL,  -- 'started', 'stopped', 'crashed', 'restarted', etc.
    message         TEXT,
    details         JSONB,
    user_id         UUID
);
SELECT create_hypertable('events', 'time');

-- Compression policies (huge storage savings)
ALTER TABLE logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'app_id'
);
SELECT add_compression_policy('logs', INTERVAL '1 day');

ALTER TABLE metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'app_id,name'
);
SELECT add_compression_policy('metrics', INTERVAL '1 day');

ALTER TABLE spans SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'trace_id'
);
SELECT add_compression_policy('spans', INTERVAL '1 day');

-- Retention policies (auto-delete old data)
SELECT add_retention_policy('logs', INTERVAL '30 days');
SELECT add_retention_policy('metrics', INTERVAL '90 days');
SELECT add_retention_policy('spans', INTERVAL '7 days');
SELECT add_retention_policy('events', INTERVAL '365 days');

-- Continuous aggregates for dashboards
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS bucket,
    app_id,
    name,
    AVG(value) as avg_value,
    MAX(value) as max_value,
    MIN(value) as min_value,
    COUNT(*) as sample_count
FROM metrics
GROUP BY bucket, app_id, name
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Log level counts per hour
CREATE MATERIALIZED VIEW log_counts_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS bucket,
    app_id,
    level,
    COUNT(*) as count
FROM logs
GROUP BY bucket, app_id, level
WITH NO DATA;

SELECT add_continuous_aggregate_policy('log_counts_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

### 4.3 OTLP Receiver

```csharp
// NuGet: OpenTelemetry.Proto
using OpenTelemetry.Proto.Collector.Logs.V1;
using OpenTelemetry.Proto.Collector.Metrics.V1;
using OpenTelemetry.Proto.Collector.Trace.V1;

public class OtlpReceiverService : 
    LogsService.LogsServiceBase,
    MetricsService.MetricsServiceBase,
    TraceService.TraceServiceBase
{
    private readonly ITelemetryRepository _repository;
    
    public override async Task<ExportLogsServiceResponse> Export(
        ExportLogsServiceRequest request, 
        ServerCallContext context)
    {
        var logs = new List<LogEntry>();
        
        foreach (var resourceLogs in request.ResourceLogs)
        {
            var appId = ExtractAppId(resourceLogs.Resource);
            
            foreach (var scopeLogs in resourceLogs.ScopeLogs)
            {
                foreach (var logRecord in scopeLogs.LogRecords)
                {
                    logs.Add(new LogEntry
                    {
                        Time = DateTimeOffset.FromUnixTimeNanoseconds((long)logRecord.TimeUnixNano).UtcDateTime,
                        AppId = appId,
                        Level = MapSeverity(logRecord.SeverityNumber),
                        Message = logRecord.Body?.StringValue ?? "",
                        Attributes = ConvertAttributes(logRecord.Attributes),
                        TraceId = logRecord.TraceId?.ToBase64(),
                        SpanId = logRecord.SpanId?.ToBase64(),
                        Source = "otlp"
                    });
                }
            }
        }
        
        await _repository.InsertLogsAsync(logs);
        return new ExportLogsServiceResponse();
    }
    
    // Similar for Metrics and Traces...
}
```

### 4.4 Configuration

```json
// appsettings.json
{
  "Telemetry": {
    "Enabled": true,
    "Provider": "TimescaleDB",  // or "SQLite" (current), "None"
    "ConnectionString": "Host=localhost;Port=5432;Database=minicluster_telemetry;Username=minicluster;Password=secret",
    
    "OTLP": {
      "Enabled": true,
      "GrpcPort": 4317,
      "HttpPort": 4318
    },
    
    "Retention": {
      "Logs": "30 days",
      "Metrics": "90 days",
      "Traces": "7 days",
      "Events": "365 days"
    },
    
    "Compression": {
      "Enabled": true,
      "After": "1 day"
    },
    
    "Export": {
      "Enabled": false,
      "Endpoint": "http://seq:5341/ingest/otlp",
      "Protocol": "http"  // or "grpc"
    }
  }
}
```

---

## Part 5: Marketplace

### 5.1 Template Schema

```json
{
  "$schema": "https://minicluster.io/schemas/template-v1.json",
  "id": "seq-logging-stack",
  "name": "Seq Logging Stack",
  "version": "1.0.0",
  "author": {
    "name": "Innovatek",
    "email": "support@innovatek.com",
    "url": "https://innovatek.com"
  },
  "verified": true,
  "description": "Production-ready Seq logging server with OTLP ingestion",
  "longDescription": "Full Seq deployment with...",
  "icon": "https://cdn.minicluster.io/icons/seq.png",
  "screenshots": [],
  "tags": ["logging", "observability", "seq"],
  "category": "Observability",
  "license": "MIT",
  
  "requirements": {
    "minMiniClusterVersion": "1.0.0",
    "platform": ["windows", "linux"],
    "ports": [5341, 8080],
    "diskSpace": "1GB",
    "memory": "512MB"
  },
  
  "variables": {
    "SEQ_ACCEPT_EULA": {
      "type": "boolean",
      "label": "Accept Seq EULA",
      "description": "You must accept the Seq EULA to continue",
      "required": true,
      "default": false
    },
    "SEQ_PORT": {
      "type": "number",
      "label": "Seq Web UI Port",
      "default": 5341
    },
    "SEQ_ADMIN_PASSWORD": {
      "type": "string",
      "label": "Admin Password",
      "secret": true,
      "generate": "password:16"
    }
  },
  
  "application": {
    "name": "Seq Logging",
    "autoStart": true,
    "services": [
      {
        "name": "Seq Server",
        "dependsOn": [],
        "restartPolicy": "always",
        "processes": [
          {
            "name": "seq",
            "type": "container",
            "image": "datalust/seq:latest",
            "ports": [
              { "host": "{{SEQ_PORT}}", "container": 80 }
            ],
            "env": {
              "ACCEPT_EULA": "{{SEQ_ACCEPT_EULA}}",
              "SEQ_FIRSTRUN_ADMINPASSWORDHASH": "{{SEQ_ADMIN_PASSWORD | hash}}"
            },
            "volumes": [
              { "name": "seq-data", "path": "/data" }
            ],
            "healthCheck": {
              "type": "http",
              "url": "http://localhost:{{SEQ_PORT}}/health",
              "interval": 30
            }
          }
        ],
        "proxyRoute": {
          "pathPrefix": "seq",
          "requireAuth": true
        }
      }
    ]
  },
  
  "postInstall": {
    "message": "Seq is ready! Access at /proxy/seq/\n\nAdmin password: {{SEQ_ADMIN_PASSWORD}}",
    "openUrl": "/proxy/seq/"
  }
}
```

### 5.2 Marketplace API

```csharp
// Catalog API (central MiniCluster service)
[ApiController]
[Route("api/marketplace")]
public class MarketplaceController : ControllerBase
{
    // Browse catalog
    [HttpGet("templates")]
    public async Task<ActionResult<PagedResult<TemplateSummary>>> Search(
        [FromQuery] string? query,
        [FromQuery] string? category,
        [FromQuery] string? tag,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        // Search public catalog
    }
    
    // Get template details
    [HttpGet("templates/{id}")]
    public async Task<ActionResult<TemplateDetail>> GetTemplate(string id)
    {
        // Return full template with schema
    }
    
    // Get template file
    [HttpGet("templates/{id}/download")]
    public async Task<ActionResult> DownloadTemplate(string id)
    {
        // Return template JSON
    }
}

// Local installation API (in MiniCluster instance)
[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    // Install from marketplace
    [HttpPost("install")]
    public async Task<ActionResult<InstallResult>> Install(
        [FromBody] InstallRequest request)
    {
        // 1. Download template
        // 2. Validate requirements
        // 3. Prompt for variables
        // 4. Create application/services/processes
        // 5. Start if autoStart
    }
    
    // Export current app as template
    [HttpPost("export/{appId}")]
    public async Task<ActionResult<TemplateJson>> Export(Guid appId)
    {
        // Convert app to template format
    }
    
    // Import template from file
    [HttpPost("import")]
    public async Task<ActionResult<InstallResult>> Import(
        [FromForm] IFormFile template,
        [FromForm] Dictionary<string, string> variables)
    {
        // Install from uploaded file
    }
}
```

### 5.3 UI Components

```tsx
// Marketplace Browser
export function MarketplacePage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  
  return (
    <div className="marketplace">
      <header>
        <h1>Marketplace</h1>
        <SearchInput value={search} onChange={setSearch} />
        <CategoryFilter value={category} onChange={setCategory} />
      </header>
      
      <div className="template-grid">
        {templates.map(t => (
          <TemplateCard 
            key={t.id} 
            template={t}
            onInstall={() => openInstallModal(t)}
          />
        ))}
      </div>
    </div>
  );
}

// Template Card
function TemplateCard({ template, onInstall }) {
  return (
    <div className="template-card">
      <img src={template.icon} alt={template.name} />
      <h3>{template.name}</h3>
      <p>{template.description}</p>
      <div className="meta">
        <span>{template.author.name}</span>
        {template.verified && <Badge>Verified</Badge>}
        <span>⭐ {template.rating}</span>
        <span>📥 {template.installs}</span>
      </div>
      <div className="tags">
        {template.tags.map(t => <Tag key={t}>{t}</Tag>)}
      </div>
      <Button onClick={onInstall}>Install</Button>
    </div>
  );
}

// Install Modal with variable input
function InstallModal({ template, onComplete }) {
  const [variables, setVariables] = useState({});
  
  return (
    <Modal title={`Install ${template.name}`}>
      <form onSubmit={handleInstall}>
        {Object.entries(template.variables).map(([key, config]) => (
          <VariableInput 
            key={key}
            name={key}
            config={config}
            value={variables[key]}
            onChange={v => setVariables({...variables, [key]: v})}
          />
        ))}
        <Button type="submit">Install</Button>
      </form>
    </Modal>
  );
}
```

---

## Part 6: API Summary

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Applications** |||
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Create application |
| GET | `/api/applications/{id}` | Get application |
| PUT | `/api/applications/{id}` | Update application |
| DELETE | `/api/applications/{id}` | Delete application |
| POST | `/api/applications/{id}/start` | Start all services |
| POST | `/api/applications/{id}/stop` | Stop all services |
| **Services** |||
| GET | `/api/applications/{appId}/services` | List services |
| POST | `/api/applications/{appId}/services` | Create service |
| GET | `/api/services/{id}` | Get service |
| PUT | `/api/services/{id}` | Update service |
| DELETE | `/api/services/{id}` | Delete service |
| POST | `/api/services/{id}/scale` | Scale replicas |
| **Health Checks** |||
| GET | `/api/apps/{appId}/health` | Get health status |
| GET | `/api/apps/{appId}/health-checks` | List health checks |
| POST | `/api/apps/{appId}/health-checks` | Add health check |
| DELETE | `/api/health-checks/{id}` | Remove health check |
| **Schedules** |||
| GET | `/api/schedules` | List schedules |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/{id}` | Update schedule |
| DELETE | `/api/schedules/{id}` | Delete schedule |
| **Telemetry** |||
| GET | `/api/logs` | Query logs |
| GET | `/api/metrics` | Query metrics |
| GET | `/api/traces` | Query traces |
| GET | `/api/traces/{traceId}` | Get trace detail |
| **Marketplace** |||
| GET | `/api/marketplace/templates` | Browse catalog |
| GET | `/api/marketplace/templates/{id}` | Get template |
| POST | `/api/templates/install` | Install template |
| POST | `/api/templates/export/{appId}` | Export as template |

---

## Part 7: Database Migrations

### Migration: AddReliabilityFeatures

```csharp
public partial class AddReliabilityFeatures : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Add columns to Apps table
        migrationBuilder.AddColumn<int>(
            name: "RestartPolicy",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
            
        migrationBuilder.AddColumn<int>(
            name: "MaxRestarts",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 5);
            
        migrationBuilder.AddColumn<int>(
            name: "RestartWindowSeconds",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 300);
            
        migrationBuilder.AddColumn<int>(
            name: "RestartDelaySeconds",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 5);
            
        migrationBuilder.AddColumn<int>(
            name: "ConsecutiveFailures",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
            
        // Create HealthChecks table
        migrationBuilder.CreateTable(
            name: "HealthChecks",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                Type = table.Column<int>(type: "INTEGER", nullable: false),
                HttpUrl = table.Column<string>(type: "TEXT", nullable: true),
                TcpHost = table.Column<string>(type: "TEXT", nullable: true),
                TcpPort = table.Column<int>(type: "INTEGER", nullable: true),
                ExecCommand = table.Column<string>(type: "TEXT", nullable: true),
                IntervalSeconds = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 30),
                TimeoutSeconds = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 10),
                FailureThreshold = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 3),
                SuccessThreshold = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                ConsecutiveFailures = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                ConsecutiveSuccesses = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                LastCheck = table.Column<DateTime>(type: "TEXT", nullable: true),
                LastCheckSuccess = table.Column<bool>(type: "INTEGER", nullable: true),
                LastCheckMessage = table.Column<string>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_HealthChecks", x => x.Id);
                table.ForeignKey(
                    name: "FK_HealthChecks_Apps_AppId",
                    column: x => x.AppId,
                    principalTable: "Apps",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
            
        // Create Schedules table
        migrationBuilder.CreateTable(
            name: "Schedules",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(type: "TEXT", nullable: true),
                Name = table.Column<string>(type: "TEXT", nullable: false),
                Type = table.Column<int>(type: "INTEGER", nullable: false),
                CronExpression = table.Column<string>(type: "TEXT", nullable: true),
                IntervalMinutes = table.Column<int>(type: "INTEGER", nullable: true),
                Action = table.Column<int>(type: "INTEGER", nullable: false),
                IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                LastRun = table.Column<DateTime>(type: "TEXT", nullable: true),
                NextRun = table.Column<DateTime>(type: "TEXT", nullable: true),
                LastRunResult = table.Column<string>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Schedules", x => x.Id);
            });
    }
}
```

### Migration: AddOrchestrationHierarchy

```csharp
public partial class AddOrchestrationHierarchy : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Create Applications table
        migrationBuilder.CreateTable(
            name: "Applications",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                Description = table.Column<string>(type: "TEXT", nullable: true),
                Version = table.Column<string>(type: "TEXT", nullable: true),
                Variables = table.Column<string>(type: "TEXT", nullable: true),
                AutoStart = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Applications", x => x.Id);
            });
            
        // Create Services table
        migrationBuilder.CreateTable(
            name: "Services",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                ApplicationId = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                Description = table.Column<string>(type: "TEXT", nullable: true),
                StartupOrder = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                DependsOn = table.Column<string>(type: "TEXT", nullable: true),
                DesiredReplicas = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                RestartPolicy = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                HealthStatus = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Services", x => x.Id);
                table.ForeignKey(
                    name: "FK_Services_Applications_ApplicationId",
                    column: x => x.ApplicationId,
                    principalTable: "Applications",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
            
        // Add ServiceId to Apps
        migrationBuilder.AddColumn<Guid>(
            name: "ServiceId",
            table: "Apps",
            type: "TEXT",
            nullable: true);
            
        migrationBuilder.AddColumn<int>(
            name: "ReplicaIndex",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
            
        migrationBuilder.CreateIndex(
            name: "IX_Apps_ServiceId",
            table: "Apps",
            column: "ServiceId");
            
        migrationBuilder.AddForeignKey(
            name: "FK_Apps_Services_ServiceId",
            table: "Apps",
            column: "ServiceId",
            principalTable: "Services",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);
    }
}
```

---

## Part 8: Implementation Phases

### Phase 1: Reliability (2-3 weeks)
- [x] Design complete
- [ ] Add restart policy columns to App entity
- [ ] Implement RestartBackoffCalculator
- [ ] Modify ProcessMonitoringService for auto-restart
- [ ] Add HealthCheck entity and migration
- [ ] Implement HealthCheckService
- [ ] Add health check monitoring
- [ ] UI: Restart policy settings
- [ ] UI: Health check configuration
- [ ] UI: Health status display

### Phase 2: Orchestration (3-4 weeks)
- [ ] Add Application, Service entities
- [ ] Migration for hierarchy
- [ ] Modify App to support ServiceId
- [ ] Implement StartupPlanExecutor
- [ ] Add dependency graph validation
- [ ] Implement replica scaling
- [ ] CRUD APIs for Application/Service
- [ ] UI: Application management
- [ ] UI: Service management
- [ ] UI: Dependency visualization

### Phase 3: Observability (3-4 weeks)
- [ ] TimescaleDB integration (optional provider)
- [ ] Schema migrations for TimescaleDB
- [ ] Implement OTLP gRPC receiver
- [ ] Modify log collection to use TimescaleDB
- [ ] Add metrics collection
- [ ] Implement log export to external systems
- [ ] UI: Enhanced log viewer with TimescaleDB queries
- [ ] UI: Metrics dashboards
- [ ] UI: Trace viewer

### Phase 4: Schedules (1-2 weeks)
- [ ] Add Schedule entity
- [ ] Implement SchedulerService
- [ ] Cron expression parsing
- [ ] CRUD APIs for schedules
- [ ] UI: Schedule management

### Phase 5: Marketplace (3-4 weeks)
- [ ] Define template JSON schema
- [ ] Implement template export
- [ ] Implement template import/install
- [ ] Variable substitution engine
- [ ] UI: Export wizard
- [ ] UI: Import wizard
- [ ] Public catalog API (separate service)
- [ ] UI: Marketplace browser

---

## Summary

This spec transforms MiniCluster into a complete DevOps platform:

| Capability | Before | After |
|------------|--------|-------|
| Process crashes | Manual restart | Auto-restart with backoff |
| Health monitoring | None | HTTP/TCP/Exec health checks |
| Multi-service apps | Flat list | Hierarchical Application→Service→Process |
| Startup order | Manual | Dependency-aware startup plans |
| Log retention | 24h SQLite | 30+ days TimescaleDB with compression |
| Telemetry | stdout only | OTLP (logs, metrics, traces) |
| Deployments | Manual config | One-click marketplace templates |

**Target: Transform any Windows or Linux machine into a managed DevOps environment without containers.**
