# Feature 010: Multi-Node Cluster

> **Version:** 2.0 (Revised)
> **Last Updated:** February 6, 2026
> **Status:** 📋 Spec Ready
> **Priority:** HIGH
> **Effort:** ~8 weeks (v1), ~4 weeks (v2 additions)
> **Dependencies:** 003 Authentication (JWT + API keys)
> **Previous Version:** [spec-v1-original.md](./spec-v1-original.md)

---

## Executive Summary

Control multiple machines from a single MiniCluster instance via **API-based agents**. The key insight: **the agent IS MiniCluster** — the same binary running in agent mode. This means zero separate agent codebase, agents work standalone if the controller is unavailable, and single-node users upgrade to multi-node with zero migration.

### Design Principles

1. **Stateful agents** — Each agent keeps its own SQLite DB. Nodes survive controller outages independently.
2. **API-key auth for v1** — Simple, debuggable, sufficient. mTLS deferred to v2/enterprise.
3. **Env-var discovery for v1** — No DNS server required. DNS-based discovery deferred to v2.
4. **Notification-only on failure** — No automatic rescheduling in v1. Avoids split-brain and thundering herd.
5. **Impersonation deferred** — Useful but orthogonal. Ships as a separate feature.
6. **Config drift detection** — Hash-based comparison to detect manual edits on agents.

---

## Business Value

| Problem | Solution |
|---------|----------|
| Managing 10+ servers individually via SSH/RDP | Single dashboard for all nodes |
| "Deploy to all prod servers" requires manual steps | One-click multi-node deploy |
| Service on machine A needs to reach machine B | Env-var injection with cross-node URLs |
| No visibility into what's running where | Central cluster dashboard with aggregate metrics |
| Controller goes down, all management lost | Stateful agents continue operating independently |
| Config drift after manual edits on nodes | Hash-based drift detection and sync |

### Target Users

| Segment | Use Case |
|---------|----------|
| **MSPs** | Manage 50+ client servers from one dashboard |
| **SMBs** | 5-20 servers, one admin manages everything |
| **Dev teams** | Multi-environment (dev/staging/prod) on real hardware |
| **Edge/IoT** | Central control of distributed edge devices |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLUSTER ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────┐                          │
│  │          CONTROL PLANE (Primary)          │                          │
│  │  ┌────────────┐ ┌──────┐ ┌────────────┐  │                          │
│  │  │ Cluster API│ │  UI  │ │ Config DB  │  │◄──── UI / CLI / API      │
│  │  │ Heartbeat  │ │      │ │ (SQLite)   │  │                          │
│  │  │ Monitor    │ │      │ │            │  │                          │
│  │  └────────────┘ └──────┘ └────────────┘  │                          │
│  └──────────────────┬───────────────────────┘                          │
│                     │ HTTPS + API Key                                   │
│       ┌─────────────┼──────────────┐                                   │
│       │             │              │                                    │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                             │
│  │  NODE A  │  │  NODE B  │  │  NODE C  │                             │
│  │ (Agent)  │  │ (Agent)  │  │ (Agent)  │                             │
│  │          │  │          │  │          │                             │
│  │ Own DB ✓ │  │ Own DB ✓ │  │ Own DB ✓ │   ← Stateful: survive      │
│  │ Own API✓ │  │ Own API✓ │  │ Own API✓ │     controller outage       │
│  │          │  │          │  │          │                             │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │                             │
│  │ │App 1 │ │  │ │App 3 │ │  │ │App 5 │ │                             │
│  │ │App 2 │ │  │ │App 4 │ │  │ │App 6 │ │                             │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │                             │
│  └──────────┘  └──────────┘  └──────────┘                             │
│                                                                         │
│  Controller DOWN → Agents still work locally, queue state diffs        │
│  Controller UP   → Agents sync pending changes, controller aggregates  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decision: Agent IS MiniCluster

```
minicluster                     ← Runs as primary (control plane mode, default)
minicluster --agent             ← Runs as agent (registers with controller)
minicluster --agent --standalone ← Runs as standalone agent (no controller)
```

Because the agent uses the same binary and same API surface:
- **No separate agent codebase** to maintain
- **Agents work standalone** if controller is unavailable
- **Testing the agent = testing the API** you already have
- **Single-node → cluster upgrade** with zero migration

---

## v1 Scope (This Spec)

### Included

- Machine entity wiring & CRUD
- Agent mode (`--agent` flag)
- Heartbeat monitoring
- API-key authentication between controller and agents
- Remote execution via `NodeClient`
- Deploy app config to remote agents
- Config drift detection (hash-based)
- Cluster dashboard UI
- Cross-node start/stop/status
- Env-var based service discovery
- Offline-node notification policy
- CLI `mc node` commands

### Explicitly Deferred to v2

| Feature | Reason |
|---------|--------|
| mTLS authentication | Adds cert management complexity; API keys sufficient for v1 |
| Impersonation contexts | Orthogonal feature, useful even on single-node |
| DNS-based service discovery | Requires embedded DNS server; env-vars cover 90% of cases |
| Automatic failover/rescheduling | Split-brain risk; notification-only is safer for v1 |
| Rolling/blue-green deployments | Depends on 007 App Versioning |
| Service replication (replicas: 3) | Requires load balancer orchestration |
| OAuth node auth | Enterprise feature, API keys sufficient |

---

## Implementation Phases

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
Machine      Agent       Remote      Deploy      Dashboard   Cross-Node   CLI
Wiring       Mode        Execution   to Node     UI          Operations   Parity

1 week       1.5 weeks   1.5 weeks   1.5 weeks   1 week      1 week       0.5 week
                                                                     Total: ~8 weeks
```

---

## Phase 0: Machine Entity Wiring (1 week)

### Goal
Connect the existing `Machine` entity (already defined in Core) to the running application. Currently the entity exists but is disconnected from DbContext, has no controller, and no service layer.

### What Already Exists
- `Machine.cs` entity in `Innovatek.Parallel.MiniCluster.Core/Entities/`
- `Phase5Dtos.cs` with `MachineDto`, `CreateMachineDto`, `UpdateMachineDto`
- DB migration with `Machines` table and indexes

### What's Missing
- `DbSet<Machine>` in `AppDbContext`
- `Service.MachineId` property on the entity (only in migration)
- `MachinesController`
- `IMachineService` / `MachineService`
- AutoMapper mapping profile entries

### Tasks

#### 0.1 Wire Machine into DbContext

```csharp
// AppDbContext.cs — add DbSet
public DbSet<Machine> Machines => Set<Machine>();

// OnModelCreating — add configuration
modelBuilder.Entity<Machine>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.HasIndex(e => e.Name);
    entity.HasIndex(e => e.Host);
    entity.HasIndex(e => e.Status);
    entity.HasIndex(e => e.IsLocal);

    entity.HasMany(e => e.Services)
          .WithOne()
          .HasForeignKey("MachineId")
          .OnDelete(DeleteBehavior.SetNull);
});
```

#### 0.2 Add MachineId to Service Entity

```csharp
// Service.cs — add FK
public Guid? MachineId { get; set; }
```

#### 0.3 Extend Machine Entity for Cluster

Add fields needed for agent communication:

```csharp
// Machine.cs — add cluster fields
/// <summary>
/// API endpoint for agent communication (e.g., "https://192.168.1.10:5147")
/// </summary>
public string? AgentEndpoint { get; set; }

/// <summary>
/// Hashed API key for authenticating with this agent
/// </summary>
public string? AgentApiKey { get; set; }

/// <summary>
/// Agent version reported at last heartbeat
/// </summary>
public string? AgentVersion { get; set; }

/// <summary>
/// JSON labels for targeting: {"env": "prod", "region": "us-east"}
/// </summary>
public string? Labels { get; set; }

/// <summary>
/// Resource info: CPU cores, total memory, total disk
/// </summary>
public int? CpuCores { get; set; }
public long? TotalMemoryBytes { get; set; }
public long? TotalDiskBytes { get; set; }
```

#### 0.4 Create MachineService

```csharp
public interface IMachineService
{
    Task<List<MachineDto>> GetAllAsync(CancellationToken ct = default);
    Task<MachineDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<MachineDto> CreateAsync(CreateMachineDto dto, CancellationToken ct = default);
    Task<MachineDto> UpdateAsync(Guid id, UpdateMachineDto dto, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<MachineDto> GetOrCreateLocalAsync(CancellationToken ct = default);
    Task<bool> PingAsync(Guid id, CancellationToken ct = default);
}
```

#### 0.5 Create MachinesController

```csharp
[ApiController]
[Route("api/[controller]")]
public class MachinesController : ControllerBase
{
    // GET    /api/machines
    // GET    /api/machines/{id}
    // POST   /api/machines
    // PUT    /api/machines/{id}
    // DELETE /api/machines/{id}
    // POST   /api/machines/{id}/ping
    // GET    /api/machines/local
}
```

#### 0.6 Auto-Register Local Machine

On first startup, auto-create a Machine record for `localhost` with `IsLocal = true`, `ConnectionType = "local"`, populated with system info (OS, CPU cores, RAM).

### Acceptance Criteria
- [ ] `DbSet<Machine>` registered in AppDbContext
- [ ] `Service.MachineId` FK exists on entity
- [ ] CRUD endpoints work for machines
- [ ] Local machine auto-registered on startup
- [ ] Existing services continue to work (MachineId is nullable)

---

## Phase 1: Agent Mode & Heartbeat (1.5 weeks)

### Goal
MiniCluster can run as an agent that registers with a controller and sends periodic heartbeats. The controller monitors agent health and detects offline nodes.

### 1.1 Agent Mode Flag

```
minicluster --agent \
  --controller-url https://controller.internal:5147 \
  --agent-api-key sk_agent_xxxx \
  --agent-name prod-server-1
```

Configuration in `appsettings.json`:

```json
{
  "Agent": {
    "Enabled": false,
    "ControllerUrl": "",
    "ApiKey": "",
    "Name": "",
    "HeartbeatIntervalSeconds": 30,
    "Labels": {
      "env": "production",
      "region": "us-east"
    }
  }
}
```

### 1.2 Agent Registration Flow

```
Agent starts → POST /api/cluster/register to controller
             → Body: { name, endpoint, apiKey, systemInfo, labels }
             → Controller creates/updates Machine record
             → Returns: { machineId, controllerVersion }
             → Agent stores machineId locally

Agent running → Every 30s: POST /api/cluster/heartbeat
              → Body: { machineId, status, metrics, appsSummary }
              → Controller updates Machine.LastSeen, Status
```

```csharp
// AgentRegistrationService.cs — Background hosted service
public class AgentRegistrationService : BackgroundService
{
    private readonly AgentOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IServiceProvider _serviceProvider;
    private Guid? _machineId;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_options.Enabled) return;

        // Register with controller
        _machineId = await RegisterAsync(ct);

        // Heartbeat loop
        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(_options.HeartbeatIntervalSeconds));

        while (await timer.WaitForNextTickAsync(ct))
        {
            await SendHeartbeatAsync(ct);
        }
    }

    private async Task<Guid> RegisterAsync(CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("Controller");
        var systemInfo = await CollectSystemInfoAsync();

        var response = await client.PostAsJsonAsync("/api/cluster/register",
            new AgentRegistrationDto
            {
                Name = _options.Name,
                Endpoint = GetSelfEndpoint(),
                SystemInfo = systemInfo,
                Labels = _options.Labels
            }, ct);

        response.EnsureSuccessStatusCode();
        var result = await response.Content
            .ReadFromJsonAsync<AgentRegistrationResultDto>(ct);
        return result!.MachineId;
    }

    private async Task SendHeartbeatAsync(CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("Controller");
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var apps = await db.Apps
                .Include(a => a.Services)
                .ToListAsync(ct);

            await client.PostAsJsonAsync("/api/cluster/heartbeat",
                new HeartbeatDto
                {
                    MachineId = _machineId!.Value,
                    Status = "online",
                    Timestamp = DateTime.UtcNow,
                    Metrics = await CollectMetricsAsync(),
                    Apps = apps.Select(a => new HeartbeatAppSummary
                    {
                        AppId = a.Id,
                        Name = a.Name,
                        ServiceCount = a.Services.Count,
                        ConfigHash = ConfigHasher.ComputeAppHash(a)
                    }).ToList()
                }, ct);
        }
        catch (Exception ex)
        {
            // Log but don't crash — controller might be temporarily unavailable
            _logger.LogWarning(ex,
                "Failed to send heartbeat to controller. " +
                "Will retry in {Interval}s", _options.HeartbeatIntervalSeconds);
        }
    }
}
```

### 1.3 API Key Authentication Middleware

```csharp
// AgentApiKeyMiddleware.cs
public class AgentApiKeyMiddleware
{
    private const string ApiKeyHeader = "X-Agent-Api-Key";

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        // Only apply to /api/cluster/* endpoints from agents
        if (!context.Request.Path.StartsWithSegments("/api/cluster"))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(ApiKeyHeader, out var key))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(
                new { error = "Missing X-Agent-Api-Key header" });
            return;
        }

        var hashedKey = HashApiKey(key!);
        var machine = await db.Machines
            .FirstOrDefaultAsync(m => m.AgentApiKey == hashedKey);

        if (machine == null)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(
                new { error = "Invalid API key" });
            return;
        }

        // Store machine context for downstream handlers
        context.Items["AgentMachine"] = machine;
        await _next(context);
    }
}
```

### 1.4 Heartbeat Monitor (Controller Side)

```csharp
// HeartbeatMonitorService.cs — Background service on controller
public class HeartbeatMonitorService : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan OfflineThreshold = TimeSpan.FromSeconds(90);
    private static readonly int MaxRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(CheckInterval);
        while (await timer.WaitForNextTickAsync(ct))
        {
            await CheckNodeHealthAsync(ct);
        }
    }

    private async Task CheckNodeHealthAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifier = scope.ServiceProvider
            .GetRequiredService<IClusterNotificationService>();

        var nodes = await db.Machines
            .Where(m => !m.IsLocal && m.ConnectionType == "agent")
            .ToListAsync(ct);

        foreach (var node in nodes)
        {
            if (node.Status == "online" &&
                node.LastSeen.HasValue &&
                DateTime.UtcNow - node.LastSeen.Value > OfflineThreshold)
            {
                // Attempt ping before marking offline
                var reachable = await PingWithRetriesAsync(
                    node, MaxRetries, ct);

                if (!reachable)
                {
                    var previousStatus = node.Status;
                    node.Status = "offline";
                    node.ModifiedAt = DateTime.UtcNow;

                    _logger.LogWarning(
                        "Node {Name} ({Host}) marked offline. " +
                        "Last seen: {LastSeen}",
                        node.Name, node.Host, node.LastSeen);

                    // Notification only — no automatic rescheduling in v1
                    await notifier.NotifyNodeOfflineAsync(node, ct);
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
```

### 1.5 Controller Cluster Endpoints

```csharp
[ApiController]
[Route("api/cluster")]
public class ClusterController : ControllerBase
{
    // POST /api/cluster/register     — Agent registers itself
    // POST /api/cluster/heartbeat    — Agent sends heartbeat
    // GET  /api/cluster/status       — Cluster overview (all nodes)
    // GET  /api/cluster/nodes        — List nodes with status
    // GET  /api/cluster/nodes/{id}   — Node detail + apps
    // POST /api/cluster/nodes/{id}/ping — Manual ping
    // PUT  /api/cluster/nodes/{id}   — Update node labels/config
    // DELETE /api/cluster/nodes/{id} — Remove node from cluster
}
```

### 1.6 Offline Node Policy (v1)

```
Node heartbeat missed (>90s):

  1. Retry heartbeat 3x with 5s intervals
  2. If still unreachable:
     a. Mark node status = "offline"
     b. Record event in lifecycle log
     c. Send notification via:
        - SignalR to connected UI clients (toast notification)
        - Webhook (if configured)
        - Future: email, Slack, Teams
     d. DO NOT reschedule apps (v1)
     e. Apps on the offline node continue running locally
        (agent has its own DB and keeps managing them)

  3. When node comes back online:
     a. Agent sends heartbeat → status = "online"
     b. Controller diffs config hashes
     c. If drift detected → flag in UI, offer manual sync
     d. Send "node recovered" notification
```

### Acceptance Criteria
- [ ] `minicluster --agent --controller-url ... --agent-api-key ...` starts in agent mode
- [ ] Agent registers with controller on startup
- [ ] Heartbeats sent every 30s (configurable)
- [ ] Controller detects offline nodes after 90s (3 missed heartbeats)
- [ ] Offline notification sent via SignalR to UI
- [ ] Agent continues working independently if controller is down
- [ ] API key validation on all cluster endpoints

---

## Phase 2: Remote Execution (1.5 weeks)

### Goal
The controller can execute operations on any agent via a typed HTTP client. This is the foundation for all cross-node features.

### 2.1 Node Client Interface

```csharp
public interface INodeClient : IDisposable
{
    string NodeName { get; }
    INodeSystemClient System { get; }
    INodeAppsClient Apps { get; }
    INodeServicesClient Services { get; }
    INodeLogsClient Logs { get; }
    INodeMetricsClient Metrics { get; }
}

public interface INodeSystemClient
{
    Task<NodeSystemInfoDto> GetInfoAsync(CancellationToken ct = default);
    Task<bool> PingAsync(CancellationToken ct = default);
}

public interface INodeAppsClient
{
    Task<List<AppDto>> ListAsync(CancellationToken ct = default);
    Task<AppDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<AppDto> CreateAsync(CreateAppDto dto, CancellationToken ct = default);
    Task UpdateAsync(Guid id, UpdateAppDto dto, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface INodeServicesClient
{
    Task<List<ServiceDto>> ListAsync(Guid? appId = null,
        CancellationToken ct = default);
    Task StartAsync(Guid id, CancellationToken ct = default);
    Task StopAsync(Guid id, CancellationToken ct = default);
    Task RestartAsync(Guid id, CancellationToken ct = default);
    Task<ServiceStatusDto> GetStatusAsync(Guid id,
        CancellationToken ct = default);
}

public interface INodeLogsClient
{
    Task<List<LogEntryDto>> GetAsync(Guid serviceId, int? limit = null,
        CancellationToken ct = default);
}

public interface INodeMetricsClient
{
    Task<NodeMetricsDto> GetSystemMetricsAsync(
        CancellationToken ct = default);
    Task<List<ServiceMetricsDto>> GetServiceMetricsAsync(
        CancellationToken ct = default);
}
```

### 2.2 Node Client Implementation

```csharp
public class NodeClient : INodeClient
{
    private readonly HttpClient _http;

    public string NodeName { get; }

    public NodeClient(Machine machine, IHttpClientFactory factory)
    {
        NodeName = machine.Name;
        _http = factory.CreateClient("NodeAgent");
        _http.BaseAddress = new Uri(machine.AgentEndpoint
            ?? $"https://{machine.Host}:{machine.Port}");
        _http.DefaultRequestHeaders.Add("X-Agent-Api-Key",
            machine.AgentApiKey);
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public INodeSystemClient System => new NodeSystemClient(_http);
    public INodeAppsClient Apps => new NodeAppsClient(_http);
    public INodeServicesClient Services => new NodeServicesClient(_http);
    public INodeLogsClient Logs => new NodeLogsClient(_http);
    public INodeMetricsClient Metrics => new NodeMetricsClient(_http);

    public void Dispose() => _http.Dispose();
}

public class NodeClientFactory : INodeClientFactory
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly AppDbContext _db;

    public async Task<INodeClient> CreateAsync(Guid machineId,
        CancellationToken ct = default)
    {
        var machine = await _db.Machines.FindAsync(machineId, ct)
            ?? throw new InvalidOperationException(
                $"Machine {machineId} not found");
        return new NodeClient(machine, _httpFactory);
    }

    public INodeClient Create(Machine machine)
        => new NodeClient(machine, _httpFactory);
}
```

### 2.3 Cluster Service

```csharp
public interface IClusterService
{
    // Node operations
    Task<List<MachineDto>> GetNodesAsync(CancellationToken ct = default);
    Task<MachineDto?> GetNodeAsync(Guid id, CancellationToken ct = default);
    Task<bool> PingNodeAsync(Guid id, CancellationToken ct = default);
    Task RemoveNodeAsync(Guid id, CancellationToken ct = default);

    // Remote execution
    Task<T> ExecuteOnNodeAsync<T>(Guid machineId,
        Func<INodeClient, Task<T>> action, CancellationToken ct = default);

    Task ExecuteOnNodesAsync(IEnumerable<Guid> machineIds,
        Func<INodeClient, Task> action, CancellationToken ct = default);

    Task<Dictionary<Guid, T>> ExecuteOnAllNodesAsync<T>(
        Func<INodeClient, Task<T>> action, CancellationToken ct = default);
}

public class ClusterService : IClusterService
{
    public async Task<T> ExecuteOnNodeAsync<T>(Guid machineId,
        Func<INodeClient, Task<T>> action, CancellationToken ct = default)
    {
        var machine = await _db.Machines.FindAsync(machineId, ct)
            ?? throw new InvalidOperationException(
                $"Machine {machineId} not found");

        using var client = _clientFactory.Create(machine);

        try
        {
            var result = await action(client);

            machine.Status = "online";
            machine.LastSeen = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return result;
        }
        catch (HttpRequestException ex)
        {
            machine.Status = "degraded";
            machine.ModifiedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            _logger.LogError(ex,
                "Failed to execute on node {Name} ({Endpoint})",
                machine.Name, machine.AgentEndpoint);
            throw;
        }
    }

    /// <summary>
    /// Execute on multiple nodes in parallel.
    /// Returns results keyed by machineId. Failures are logged but
    /// don't stop other nodes.
    /// </summary>
    public async Task<Dictionary<Guid, T>> ExecuteOnAllNodesAsync<T>(
        Func<INodeClient, Task<T>> action, CancellationToken ct = default)
    {
        var nodes = await _db.Machines
            .Where(m => !m.IsLocal && m.ConnectionType == "agent"
                && m.Status != "offline")
            .ToListAsync(ct);

        var results = new ConcurrentDictionary<Guid, T>();
        var tasks = nodes.Select(async node =>
        {
            try
            {
                var result = await ExecuteOnNodeAsync(
                    node.Id, action, ct);
                results[node.Id] = result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Execution failed on node {Name}", node.Name);
            }
        });

        await Task.WhenAll(tasks);
        return new Dictionary<Guid, T>(results);
    }
}
```

### 2.4 Resilience & Error Handling

```csharp
// Configure Polly resilience for node communication
services.AddHttpClient("NodeAgent", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
})
.AddPolicyHandler(Policy
    .Handle<HttpRequestException>()
    .OrResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
    .WaitAndRetryAsync(2, attempt =>
        TimeSpan.FromSeconds(Math.Pow(2, attempt))))
.AddPolicyHandler(Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        exceptionsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30)));
```

### Acceptance Criteria
- [ ] `INodeClient` can call any agent API endpoint
- [ ] `NodeClientFactory` creates clients from Machine records
- [ ] `ClusterService.ExecuteOnNodeAsync` works with retry/circuit-breaker
- [ ] Parallel execution on multiple nodes with independent failure handling
- [ ] Node status updated on success/failure
- [ ] All operations logged for audit

---

## Phase 3: Deploy to Node (1.5 weeks)

### Goal
Deploy an app (with all its services) from the controller to one or more agents. Track deployments, detect config drift, and provide sync capabilities.

### 3.1 Deployment Data Model

```csharp
/// <summary>
/// Tracks an app deployment to a specific node.
/// Stored on the controller only.
/// </summary>
public class AppDeployment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Which app template (on controller)
    public Guid AppId { get; set; }
    public App App { get; set; } = null!;

    // Which node it's deployed to
    public Guid MachineId { get; set; }
    public Machine Machine { get; set; } = null!;

    // The app's ID on the remote agent (different from AppId)
    public Guid? RemoteAppId { get; set; }

    // Deployment tracking
    public DeploymentStatus Status { get; set; } = DeploymentStatus.Pending;
    public DateTime DeployedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncedAt { get; set; }

    // Config drift detection
    public string? ConfigHash { get; set; }
    public string? RemoteConfigHash { get; set; }
    public bool IsDrifted => ConfigHash != null
        && RemoteConfigHash != null
        && ConfigHash != RemoteConfigHash;

    // Deployment metadata
    public string? DeployedBy { get; set; }   // username
    public string? Notes { get; set; }
    public string? LastError { get; set; }
}

public enum DeploymentStatus
{
    Pending = 0,
    Deploying = 1,
    Deployed = 2,
    Failed = 3,
    Undeploying = 4,
    Undeployed = 5,
    Drifted = 6
}
```

### 3.2 Config Hash Computation

```csharp
public static class ConfigHasher
{
    /// <summary>
    /// Compute a deterministic SHA256 hash of an app's configuration.
    /// Used to detect config drift between controller and agent.
    /// </summary>
    public static string ComputeAppHash(App app)
    {
        var payload = new
        {
            app.Name,
            app.Slug,
            app.Description,
            app.Icon,
            app.Color,
            Services = app.Services
                .OrderBy(s => s.Name)
                .Select(s => new
                {
                    s.Name,
                    s.ExecutablePath,
                    s.Arguments,
                    s.WorkingDirectory,
                    s.AutoStart,
                    s.EnvironmentVariables,
                    s.CaptureOutput
                })
        };

        var json = JsonSerializer.Serialize(payload,
            new JsonSerializerOptions { WriteIndented = false });
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
```

### 3.3 Deployment Service

```csharp
public interface IDeploymentService
{
    /// <summary>
    /// Deploy an app to one or more nodes.
    /// </summary>
    Task<List<AppDeployment>> DeployAsync(DeployRequestDto request,
        CancellationToken ct = default);

    /// <summary>
    /// Sync a deployment (push latest config to agent).
    /// </summary>
    Task SyncDeploymentAsync(Guid deploymentId,
        CancellationToken ct = default);

    /// <summary>
    /// Remove a deployment (delete app from agent).
    /// </summary>
    Task UndeployAsync(Guid deploymentId,
        CancellationToken ct = default);

    /// <summary>
    /// Check all deployments for config drift.
    /// </summary>
    Task<List<AppDeployment>> CheckDriftAsync(
        CancellationToken ct = default);

    /// <summary>
    /// Get deployments with optional filters.
    /// </summary>
    Task<List<AppDeploymentDto>> GetDeploymentsAsync(
        Guid? appId = null, Guid? machineId = null,
        CancellationToken ct = default);
}

public class DeploymentService : IDeploymentService
{
    public async Task<List<AppDeployment>> DeployAsync(
        DeployRequestDto request, CancellationToken ct = default)
    {
        var app = await _db.Apps
            .Include(a => a.Services)
            .FirstOrDefaultAsync(a => a.Id == request.AppId, ct)
            ?? throw new InvalidOperationException("App not found");

        // Resolve machines by label selector if provided
        var machineIds = request.MachineIds;
        if (request.LabelSelector?.Count > 0)
        {
            var matchedMachines = await _db.Machines
                .Where(m => m.ConnectionType == "agent"
                    && m.Status == "online")
                .ToListAsync(ct);

            machineIds = matchedMachines
                .Where(m => MatchesLabels(m.Labels, request.LabelSelector))
                .Select(m => m.Id)
                .ToList();
        }

        var configHash = ConfigHasher.ComputeAppHash(app);
        var deployments = new List<AppDeployment>();

        foreach (var machineId in machineIds)
        {
            // Check for existing deployment
            var existing = await _db.AppDeployments
                .FirstOrDefaultAsync(d => d.AppId == app.Id
                    && d.MachineId == machineId, ct);

            if (existing != null)
            {
                // Update existing deployment
                await SyncDeploymentAsync(existing.Id, ct);
                deployments.Add(existing);
                continue;
            }

            try
            {
                // Convert to DTO for remote creation
                var createDto = MapToCreateAppDto(app);

                // Create app on remote agent
                var remoteApp = await _cluster.ExecuteOnNodeAsync(
                    machineId,
                    async client => await client.Apps
                        .CreateAsync(createDto, ct),
                    ct);

                // Inject cross-node env vars
                await InjectDiscoveryVarsAsync(
                    machineId, app, remoteApp.Id, ct);

                var deployment = new AppDeployment
                {
                    AppId = app.Id,
                    MachineId = machineId,
                    RemoteAppId = remoteApp.Id,
                    Status = DeploymentStatus.Deployed,
                    DeployedAt = DateTime.UtcNow,
                    LastSyncedAt = DateTime.UtcNow,
                    ConfigHash = configHash,
                    RemoteConfigHash = configHash,
                    DeployedBy = _currentUser.Username
                };

                _db.AppDeployments.Add(deployment);
                deployments.Add(deployment);
            }
            catch (Exception ex)
            {
                var failedDeployment = new AppDeployment
                {
                    AppId = app.Id,
                    MachineId = machineId,
                    Status = DeploymentStatus.Failed,
                    LastError = ex.Message
                };
                _db.AppDeployments.Add(failedDeployment);
                deployments.Add(failedDeployment);
            }
        }

        await _db.SaveChangesAsync(ct);
        return deployments;
    }

    public async Task<List<AppDeployment>> CheckDriftAsync(
        CancellationToken ct = default)
    {
        var deployments = await _db.AppDeployments
            .Include(d => d.App).ThenInclude(a => a.Services)
            .Include(d => d.Machine)
            .Where(d => d.Status == DeploymentStatus.Deployed)
            .ToListAsync(ct);

        var drifted = new List<AppDeployment>();

        foreach (var deployment in deployments)
        {
            // Recompute controller-side hash
            var localHash = ConfigHasher.ComputeAppHash(deployment.App);
            deployment.ConfigHash = localHash;

            // Compare with what the agent reported in its heartbeat
            if (deployment.IsDrifted)
            {
                deployment.Status = DeploymentStatus.Drifted;
                drifted.Add(deployment);
            }
        }

        await _db.SaveChangesAsync(ct);
        return drifted;
    }
}
```

### 3.4 Deploy Request / Response DTOs

```csharp
public record DeployRequestDto
{
    /// <summary>App to deploy (from controller's app catalog)</summary>
    public Guid AppId { get; init; }

    /// <summary>Target machines (by ID or label selector)</summary>
    public List<Guid> MachineIds { get; init; } = new();

    /// <summary>Alternative: deploy to machines matching labels</summary>
    public Dictionary<string, string>? LabelSelector { get; init; }

    /// <summary>Optional notes for the deployment</summary>
    public string? Notes { get; init; }
}

public record AppDeploymentDto
{
    public Guid Id { get; init; }
    public Guid AppId { get; init; }
    public string AppName { get; init; } = "";
    public Guid MachineId { get; init; }
    public string MachineName { get; init; } = "";
    public Guid? RemoteAppId { get; init; }
    public DeploymentStatus Status { get; init; }
    public DateTime DeployedAt { get; init; }
    public DateTime? LastSyncedAt { get; init; }
    public bool IsDrifted { get; init; }
    public string? DeployedBy { get; init; }
    public string? Notes { get; init; }
    public string? LastError { get; init; }
}
```

### 3.5 Deployment API Endpoints

```csharp
[ApiController]
[Route("api/cluster/deployments")]
public class DeploymentsController : ControllerBase
{
    // POST   /api/cluster/deployments             — Deploy app to nodes
    // GET    /api/cluster/deployments              — List all deployments
    // GET    /api/cluster/deployments/{id}         — Get deployment detail
    // POST   /api/cluster/deployments/{id}/sync    — Force sync to agent
    // DELETE /api/cluster/deployments/{id}         — Undeploy from node
    // GET    /api/cluster/deployments/drift        — Check all for drift
}
```

### 3.6 Cross-Node Service Discovery (Env-Var Injection)

When deploying `App B` to Node 2, and `App A` is already on Node 1, auto-inject environment variables so services can find each other:

```csharp
private async Task InjectDiscoveryVarsAsync(
    Guid targetMachineId, App app, Guid remoteAppId,
    CancellationToken ct)
{
    // Find all other deployments in the cluster
    var otherDeployments = await _db.AppDeployments
        .Include(d => d.App).ThenInclude(a => a.Services)
        .Include(d => d.Machine)
        .Where(d => d.Status == DeploymentStatus.Deployed
            && d.MachineId != targetMachineId)
        .ToListAsync(ct);

    var discoveryVars = new Dictionary<string, string>();

    foreach (var deployment in otherDeployments)
    {
        var machine = deployment.Machine;
        var appSlug = deployment.App.Slug.ToUpperInvariant()
            .Replace("-", "_");

        // MC_APP_{SLUG}_URL=https://{host}:{port}
        discoveryVars[$"MC_APP_{appSlug}_URL"] =
            $"https://{machine.Host}:{machine.Port}";

        // MC_APP_{SLUG}_NODE={machineName}
        discoveryVars[$"MC_APP_{appSlug}_NODE"] = machine.Name;

        // Per-service URLs (for apps with proxy routes)
        foreach (var service in deployment.App.Services)
        {
            var svcSlug = service.Name.ToUpperInvariant()
                .Replace("-", "_").Replace(" ", "_");
            discoveryVars[$"MC_SVC_{svcSlug}_URL"] =
                $"https://{machine.Host}:{machine.Port}";
        }
    }

    // Push env vars to the remote app
    if (discoveryVars.Count > 0)
    {
        await _cluster.ExecuteOnNodeAsync(targetMachineId, async client =>
        {
            await client.Apps.UpdateAsync(remoteAppId,
                new UpdateAppDto { EnvironmentVariables = discoveryVars },
                ct);
            return true;
        }, ct);
    }
}
```

**Result on the remote node:**
```bash
MC_APP_BACKEND_API_URL=https://192.168.1.10:5147
MC_APP_BACKEND_API_NODE=prod-server-1
MC_SVC_POSTGRES_URL=https://192.168.1.10:5147
MC_APP_FRONTEND_URL=https://192.168.1.12:5147
MC_APP_FRONTEND_NODE=prod-server-3
```

### Acceptance Criteria
- [ ] Deploy app to single node works end-to-end
- [ ] Deploy app to multiple nodes in parallel
- [ ] Deploy by label selector (`env=prod`)
- [ ] Config hash computed and stored on deployment
- [ ] Drift detection works (heartbeat reports remote hash)
- [ ] Sync pushes latest config to drifted agent
- [ ] Undeploy removes app from agent
- [ ] Cross-node env-var injection works
- [ ] Deployment audit trail (who deployed what, when)

---

## Phase 4: Cluster Dashboard UI (1 week)

### Goal
Build the central cluster management UI: node cards, aggregate metrics, deployment management, and drift alerts.

### 4.1 Navigation

Add a "Cluster" section to the main sidebar:

```
Sidebar:
├── Dashboard (existing)
├── Apps (existing)
├── Services (existing)
├── Cluster           ← NEW
│   ├── Overview      ← Cluster summary + aggregate metrics
│   ├── Nodes         ← Node list with status cards
│   └── Deployments   ← Deployment list with drift indicators
├── Terminal (existing)
├── Explorer (existing)
└── Settings (existing)
```

### 4.2 Cluster Overview Page

```tsx
function ClusterOverview() {
  const { data: nodes } = useClusterNodes();
  const { data: deployments } = useDeployments();
  const { data: drifted } = useDriftCheck();

  const onlineCount = nodes?.filter(n => n.status === 'online').length ?? 0;
  const totalCpu = nodes?.reduce(
    (sum, n) => sum + (n.cpuCores ?? 0), 0) ?? 0;
  const totalMemory = nodes?.reduce(
    (sum, n) => sum + (n.totalMemoryBytes ?? 0), 0) ?? 0;

  return (
    <div className="cluster-overview">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Nodes"
          value={`${onlineCount}/${nodes?.length ?? 0}`}
          status={onlineCount === nodes?.length ? 'healthy' : 'warning'}
        />
        <StatCard label="Total CPU Cores" value={totalCpu} />
        <StatCard label="Total Memory" value={formatBytes(totalMemory)} />
        <StatCard
          label="Deployments"
          value={deployments?.length ?? 0}
          badge={drifted?.length
            ? `${drifted.length} drifted`
            : undefined}
          badgeVariant="warning"
        />
      </div>

      {/* Node status grid */}
      <section>
        <h2>Nodes</h2>
        <div className="grid grid-cols-3 gap-4">
          {nodes?.map(node => (
            <NodeCard key={node.id} node={node} />
          ))}
          <AddNodeCard />
        </div>
      </section>

      {/* Drift alerts */}
      {drifted && drifted.length > 0 && (
        <section>
          <Alert variant="warning">
            {drifted.length} deployment(s) have config drift.
            <Button size="sm"
              onClick={() => navigate('/cluster/deployments?drift=true')}>
              Review
            </Button>
          </Alert>
        </section>
      )}
    </div>
  );
}
```

### 4.3 Node Card Component

```tsx
function NodeCard({ node }: { node: MachineDto }) {
  return (
    <Card className={cn(
      'node-card',
      node.status === 'online' && 'border-green-500/30',
      node.status === 'offline' && 'border-red-500/30',
      node.status === 'degraded' && 'border-yellow-500/30',
    )}>
      <div className="flex items-center gap-2">
        <StatusDot status={node.status} />
        <h3 className="font-semibold">{node.name}</h3>
        {node.isLocal && <Badge variant="outline">Local</Badge>}
      </div>

      <div className="text-sm text-muted-foreground mt-1">
        {node.host}:{node.port}
      </div>

      {/* Resource bars */}
      <div className="mt-3 space-y-2">
        <ResourceBar
          label="CPU"
          used={node.cpuUsagePercent}
          total={100}
          unit="%"
        />
        <ResourceBar
          label="Memory"
          used={node.memoryUsedBytes}
          total={node.totalMemoryBytes}
          format={formatBytes}
        />
      </div>

      {/* App count */}
      <div className="mt-3 flex justify-between items-center">
        <span className="text-sm">
          {node.runningServiceCount}/{node.serviceCount} services
        </span>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="ghost"
            onClick={() => navigate(`/cluster/nodes/${node.id}`)}>
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {/* Last seen */}
      {node.status !== 'online' && node.lastSeen && (
        <div className="text-xs text-muted-foreground mt-2">
          Last seen: {formatRelativeTime(node.lastSeen)}
        </div>
      )}
    </Card>
  );
}
```

### 4.4 Node Detail Page

```tsx
function NodeDetail({ machineId }: { machineId: string }) {
  const { data: node } = useNode(machineId);
  const { data: deployments } = useDeployments({ machineId });
  const { data: metrics } = useNodeMetrics(machineId);
  const pingMutation = usePingNode();

  return (
    <div>
      <PageHeader
        title={node?.name}
        subtitle={`${node?.host} · ${node?.status}`}
        actions={
          <>
            <Button onClick={() => pingMutation.mutate(machineId)}>
              Ping
            </Button>
            <Button variant="outline"
              onClick={() => openDeployModal(machineId)}>
              Deploy App
            </Button>
          </>
        }
      />

      {/* System metrics (real-time via heartbeat) */}
      <MetricsGrid metrics={metrics} />

      {/* Labels */}
      <LabelsEditor
        labels={node?.labels}
        onSave={(labels) => updateNode(machineId, { labels })}
      />

      {/* Deployed apps */}
      <section>
        <h2>Deployed Apps</h2>
        <DeploymentTable deployments={deployments} />
      </section>
    </div>
  );
}
```

### 4.5 Deploy Modal

```tsx
function DeployToClusterModal({ appId }: { appId: string }) {
  const { data: nodes } = useClusterNodes();
  const [selected, setSelected] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState('');
  const deployMutation = useDeployToCluster();

  const filteredNodes = labelFilter
    ? nodes?.filter(n => matchLabels(n.labels, labelFilter))
    : nodes;

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Deploy to Cluster</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Label filter */}
        <Input
          placeholder='Filter by label (e.g., env=prod)'
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
        />

        {/* Node checkboxes */}
        <div className="space-y-2">
          {filteredNodes?.map(node => (
            <label key={node.id} className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes(node.id)}
                onCheckedChange={(c) =>
                  c ? setSelected([...selected, node.id])
                    : setSelected(selected.filter(id => id !== node.id))
                }
              />
              <StatusDot status={node.status} />
              <span>{node.name}</span>
              <span className="text-muted-foreground text-sm">
                ({node.host})
              </span>
            </label>
          ))}
        </div>

        <Button
          onClick={() => deployMutation.mutate({
            appId,
            machineIds: selected
          })}
          disabled={selected.length === 0}
        >
          Deploy to {selected.length} node(s)
        </Button>
      </div>
    </Dialog>
  );
}
```

### 4.6 SignalR Notifications

Extend existing SignalR hub for cluster events:

```csharp
public interface IClusterHubClient
{
    Task NodeStatusChanged(NodeStatusChangedEvent evt);
    Task DeploymentCompleted(DeploymentCompletedEvent evt);
    Task DriftDetected(DriftDetectedEvent evt);
    Task HeartbeatReceived(HeartbeatReceivedEvent evt);
}

// Events
public record NodeStatusChangedEvent(
    Guid MachineId, string Name, string OldStatus, string NewStatus);
public record DeploymentCompletedEvent(
    Guid DeploymentId, Guid AppId, Guid MachineId,
    string Status, string? Error);
public record DriftDetectedEvent(
    Guid DeploymentId, string AppName, string MachineName);
public record HeartbeatReceivedEvent(
    Guid MachineId, string Name, string Status);
```

### 4.7 React Query Hooks

```tsx
// hooks/useCluster.ts
export function useClusterNodes() {
  return useQuery({
    queryKey: ['cluster', 'nodes'],
    queryFn: () => api.get<MachineDto[]>('/api/cluster/nodes'),
    refetchInterval: 30_000, // Refresh every 30s
  });
}

export function useDeployments(filters?: {
  machineId?: string; appId?: string; drift?: boolean
}) {
  return useQuery({
    queryKey: ['cluster', 'deployments', filters],
    queryFn: () => api.get<AppDeploymentDto[]>(
      '/api/cluster/deployments', { params: filters }),
  });
}

export function useDeployToCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: DeployRequestDto) =>
      api.post('/api/cluster/deployments', req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
    },
  });
}

export function usePingNode() {
  return useMutation({
    mutationFn: (machineId: string) =>
      api.post(`/api/cluster/nodes/${machineId}/ping`),
  });
}

// SignalR subscription for real-time updates
export function useClusterEvents() {
  const qc = useQueryClient();

  useSignalREvent('NodeStatusChanged', () => {
    qc.invalidateQueries({ queryKey: ['cluster', 'nodes'] });
  });

  useSignalREvent('DeploymentCompleted', () => {
    qc.invalidateQueries({ queryKey: ['cluster', 'deployments'] });
  });

  useSignalREvent('DriftDetected', (evt: DriftDetectedEvent) => {
    toast.warning(
      `Config drift detected: ${evt.appName} on ${evt.machineName}`);
  });
}
```

### Acceptance Criteria
- [ ] Cluster section in sidebar navigation
- [ ] Cluster overview with aggregate metrics
- [ ] Node cards showing status, resources, app count
- [ ] Node detail page with metrics and deployments
- [ ] Deploy modal with node selection and label filtering
- [ ] Drift indicator badges on drifted deployments
- [ ] Real-time updates via SignalR (node status, deployments)
- [ ] Add/remove node UI flow

---

## Phase 5: Cross-Node Operations (1 week)

### Goal
Operate on apps across all nodes they're deployed to: start everywhere, stop everywhere, check status across cluster, aggregate logs.

### 5.1 Cross-Node Operations API

```csharp
[ApiController]
[Route("api/cluster/apps")]
public class ClusterAppsController : ControllerBase
{
    private readonly IClusterService _cluster;
    private readonly IDeploymentService _deployments;

    /// <summary>
    /// Start an app on all nodes where it's deployed.
    /// </summary>
    [HttpPost("{appId}/start")]
    public async Task<ActionResult<CrossNodeOperationResult>> StartAll(
        Guid appId, CancellationToken ct)
    {
        var deploymentList = await _deployments
            .GetDeploymentsAsync(appId: appId, ct: ct);

        var results = new ConcurrentBag<NodeOperationResult>();

        await Parallel.ForEachAsync(
            deploymentList.Where(d =>
                d.Status == DeploymentStatus.Deployed),
            ct,
            async (deployment, token) =>
            {
                try
                {
                    await _cluster.ExecuteOnNodeAsync(
                        deployment.MachineId,
                        async client =>
                        {
                            var services = await client.Services
                                .ListAsync(deployment.RemoteAppId, token);
                            foreach (var svc in services)
                            {
                                await client.Services
                                    .StartAsync(svc.Id, token);
                            }
                            return true;
                        }, token);

                    results.Add(new NodeOperationResult(
                        deployment.MachineId, deployment.MachineName,
                        true, null));
                }
                catch (Exception ex)
                {
                    results.Add(new NodeOperationResult(
                        deployment.MachineId, deployment.MachineName,
                        false, ex.Message));
                }
            });

        return Ok(new CrossNodeOperationResult
        {
            Operation = "start",
            AppId = appId,
            Results = results.ToList(),
            SuccessCount = results.Count(r => r.Success),
            FailureCount = results.Count(r => !r.Success)
        });
    }

    /// <summary>
    /// Stop an app on all nodes where it's deployed.
    /// </summary>
    [HttpPost("{appId}/stop")]
    public async Task<ActionResult<CrossNodeOperationResult>> StopAll(
        Guid appId, CancellationToken ct)
    { /* Mirror of StartAll with stop logic */ }

    /// <summary>
    /// Restart an app on all nodes where it's deployed.
    /// </summary>
    [HttpPost("{appId}/restart")]
    public async Task<ActionResult<CrossNodeOperationResult>> RestartAll(
        Guid appId, CancellationToken ct)
    { /* Mirror of StartAll with restart logic */ }

    /// <summary>
    /// Get app status across all nodes.
    /// </summary>
    [HttpGet("{appId}/status")]
    public async Task<ActionResult<CrossNodeStatusResult>> GetStatus(
        Guid appId, CancellationToken ct)
    {
        var deploymentList = await _deployments
            .GetDeploymentsAsync(appId: appId, ct: ct);

        var statuses = new ConcurrentBag<NodeAppStatus>();

        await Parallel.ForEachAsync(
            deploymentList.Where(d =>
                d.Status == DeploymentStatus.Deployed),
            ct,
            async (deployment, token) =>
            {
                try
                {
                    var status = await _cluster.ExecuteOnNodeAsync(
                        deployment.MachineId,
                        async client =>
                        {
                            var app = await client.Apps
                                .GetAsync(deployment.RemoteAppId!.Value,
                                    token);
                            return new AppStatusDto
                            {
                                AppId = app.Id,
                                Name = app.Name,
                                ServiceCount = app.ServiceCount,
                                RunningCount = app.RunningServiceCount
                            };
                        }, token);

                    statuses.Add(new NodeAppStatus
                    {
                        MachineId = deployment.MachineId,
                        MachineName = deployment.MachineName,
                        Status = status,
                        Reachable = true
                    });
                }
                catch
                {
                    statuses.Add(new NodeAppStatus
                    {
                        MachineId = deployment.MachineId,
                        MachineName = deployment.MachineName,
                        Reachable = false
                    });
                }
            });

        return Ok(new CrossNodeStatusResult
        {
            AppId = appId,
            Nodes = statuses.ToList()
        });
    }

    /// <summary>
    /// Aggregate logs from all nodes for an app.
    /// </summary>
    [HttpGet("{appId}/logs")]
    public async Task<ActionResult<List<AggregatedLogEntry>>>
        GetAggregatedLogs(
            Guid appId,
            [FromQuery] int limit = 100,
            CancellationToken ct = default)
    {
        var deploymentList = await _deployments
            .GetDeploymentsAsync(appId: appId, ct: ct);

        var allLogs = new ConcurrentBag<AggregatedLogEntry>();

        await Parallel.ForEachAsync(
            deploymentList.Where(d =>
                d.Status == DeploymentStatus.Deployed),
            ct,
            async (deployment, token) =>
            {
                try
                {
                    var logs = await _cluster.ExecuteOnNodeAsync(
                        deployment.MachineId,
                        async client =>
                        {
                            var services = await client.Services
                                .ListAsync(deployment.RemoteAppId, token);
                            var svcLogs = new List<LogEntryDto>();
                            foreach (var svc in services)
                            {
                                var l = await client.Logs
                                    .GetAsync(svc.Id,
                                        limit / Math.Max(services.Count, 1),
                                        token);
                                svcLogs.AddRange(l);
                            }
                            return svcLogs;
                        }, token);

                    foreach (var log in logs)
                    {
                        allLogs.Add(new AggregatedLogEntry
                        {
                            NodeName = deployment.MachineName,
                            MachineId = deployment.MachineId,
                            Timestamp = log.Timestamp,
                            Message = log.Message,
                            Level = log.Level,
                            ServiceName = log.ServiceName
                        });
                    }
                }
                catch { /* Skip unreachable nodes */ }
            });

        return Ok(allLogs
            .OrderByDescending(l => l.Timestamp)
            .Take(limit)
            .ToList());
    }
}
```

### 5.2 Cross-Node Response DTOs

```csharp
public record CrossNodeOperationResult
{
    public string Operation { get; init; } = "";
    public Guid AppId { get; init; }
    public List<NodeOperationResult> Results { get; init; } = new();
    public int SuccessCount { get; init; }
    public int FailureCount { get; init; }
}

public record NodeOperationResult(
    Guid MachineId, string MachineName, bool Success, string? Error);

public record CrossNodeStatusResult
{
    public Guid AppId { get; init; }
    public List<NodeAppStatus> Nodes { get; init; } = new();
}

public record NodeAppStatus
{
    public Guid MachineId { get; init; }
    public string MachineName { get; init; } = "";
    public AppStatusDto? Status { get; init; }
    public bool Reachable { get; init; }
}

public record AggregatedLogEntry
{
    public string NodeName { get; init; } = "";
    public Guid MachineId { get; init; }
    public DateTime Timestamp { get; init; }
    public string Message { get; init; } = "";
    public string? Level { get; init; }
    public string? ServiceName { get; init; }
}
```

### 5.3 UI: Cross-Node Status View

```tsx
function AppClusterStatus({ appId }: { appId: string }) {
  const { data: status } = useAppClusterStatus(appId);
  const startAll = useClusterAppStart();
  const stopAll = useClusterAppStop();

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button onClick={() => startAll.mutate(appId)}
          variant="default" size="sm">
          Start All Nodes
        </Button>
        <Button onClick={() => stopAll.mutate(appId)}
          variant="destructive" size="sm">
          Stop All Nodes
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Node</TableHead>
            <TableHead>Reachable</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status?.nodes.map(nodeStatus => (
            <TableRow key={nodeStatus.machineId}>
              <TableCell>{nodeStatus.machineName}</TableCell>
              <TableCell>
                <StatusBadge reachable={nodeStatus.reachable} />
              </TableCell>
              <TableCell>
                {nodeStatus.reachable
                  ? `${nodeStatus.status?.runningCount}/${nodeStatus.status?.serviceCount}`
                  : '—'}
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost"
                  title="Start on this node">
                  <Play size={14} />
                </Button>
                <Button size="icon-sm" variant="ghost"
                  title="Stop on this node">
                  <Square size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Acceptance Criteria
- [ ] Start/stop/restart app on all deployed nodes
- [ ] Per-node success/failure reporting
- [ ] Aggregate status view across nodes
- [ ] Aggregate log view with node attribution
- [ ] Cross-node operations run in parallel
- [ ] Unreachable nodes don't block operations on healthy nodes

---

## Phase 6: CLI Parity (0.5 weeks)

### Goal
Add `mc node` and `mc deploy` commands to the Go CLI for cluster management.

### 6.1 CLI Commands

```
mc node
├── mc node list                          — List all nodes
├── mc node get <name|id>                 — Get node details
├── mc node add --name <n> --endpoint <e> --api-key <k>
│                                         — Register a new node
├── mc node remove <name|id>              — Remove a node
├── mc node ping <name|id>                — Ping a node
└── mc node labels <name|id>              — View/set labels
    ├── --set env=prod,region=us-east
    └── --remove region

mc deploy
├── mc deploy <app> --to <node1,node2>    — Deploy app to nodes
├── mc deploy <app> --label env=prod      — Deploy by label
├── mc deploy list                        — List deployments
├── mc deploy status <app>                — Status across nodes
├── mc deploy sync <deployment-id>        — Force sync
├── mc deploy remove <deployment-id>      — Undeploy
└── mc deploy drift                       — Check for config drift

mc cluster
├── mc cluster status                     — Cluster overview
└── mc cluster apps <app> start|stop|restart
                                          — Cross-node app operations
```

### 6.2 Command Implementation (Go)

```go
// cmd/node.go
package cmd

func newNodeCmd() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "node",
        Short: "Manage cluster nodes",
        Long:  "Register, monitor, and manage MiniCluster agent nodes",
    }

    cmd.AddCommand(
        newNodeListCmd(),
        newNodeGetCmd(),
        newNodeAddCmd(),
        newNodeRemoveCmd(),
        newNodePingCmd(),
        newNodeLabelsCmd(),
    )

    return cmd
}

func newNodeListCmd() *cobra.Command {
    return &cobra.Command{
        Use:   "list",
        Short: "List all cluster nodes",
        RunE: func(cmd *cobra.Command, args []string) error {
            client := getClient()
            nodes, err := client.GetNodes()
            if err != nil {
                return err
            }

            switch getOutputFormat() {
            case "json":
                return outputJSON(nodes)
            case "yaml":
                return outputYAML(nodes)
            default:
                table := newTable("NAME", "HOST", "STATUS",
                    "SERVICES", "LAST SEEN", "LABELS")
                for _, n := range nodes {
                    table.AddRow(
                        n.Name,
                        fmt.Sprintf("%s:%d", n.Host, n.Port),
                        colorStatus(n.Status),
                        fmt.Sprintf("%d/%d",
                            n.RunningServiceCount, n.ServiceCount),
                        relativeTime(n.LastSeen),
                        formatLabels(n.Labels),
                    )
                }
                return table.Render()
            }
        },
    }
}

func newNodeAddCmd() *cobra.Command {
    var name, endpoint, apiKey string
    var labels []string

    cmd := &cobra.Command{
        Use:   "add",
        Short: "Register a new cluster node",
        RunE: func(cmd *cobra.Command, args []string) error {
            client := getClient()
            node, err := client.RegisterNode(RegisterNodeRequest{
                Name:     name,
                Endpoint: endpoint,
                ApiKey:   apiKey,
                Labels:   parseLabels(labels),
            })
            if err != nil {
                return err
            }
            fmt.Printf("Node '%s' registered (ID: %s)\n",
                node.Name, node.ID)
            return nil
        },
    }

    cmd.Flags().StringVar(&name, "name", "",
        "Node name (required)")
    cmd.Flags().StringVar(&endpoint, "endpoint", "",
        "Agent endpoint URL (required)")
    cmd.Flags().StringVar(&apiKey, "api-key", "",
        "API key for agent auth (required)")
    cmd.Flags().StringSliceVar(&labels, "label", nil,
        "Labels (key=value, repeatable)")
    cmd.MarkFlagRequired("name")
    cmd.MarkFlagRequired("endpoint")
    cmd.MarkFlagRequired("api-key")

    return cmd
}
```

### 6.3 CLI Output Examples

```bash
$ mc node list
NAME             HOST                  STATUS   SERVICES   LAST SEEN   LABELS
prod-server-1    192.168.1.10:5147     online   5/5        2s ago      env=prod, region=us-east
prod-server-2    192.168.1.11:5147     online   3/3        5s ago      env=prod, region=us-east
staging-1        192.168.1.20:5147     online   2/4        12s ago     env=staging
dev-box          192.168.1.50:5147     offline  0/2        5m ago      env=dev

$ mc deploy backend-api --to prod-server-1,prod-server-2
Deploying 'backend-api' to 2 nodes...
  ✓ prod-server-1: deployed (remote ID: a1b2c3d4)
  ✓ prod-server-2: deployed (remote ID: e5f6g7h8)

$ mc cluster status
CLUSTER OVERVIEW
  Nodes:        3/4 online
  Total CPU:    24 cores
  Total Memory: 64 GB
  Deployments:  8 active, 0 drifted

$ mc deploy drift
DRIFT CHECK
  ✓ backend-api @ prod-server-1: in sync
  ⚠ backend-api @ prod-server-2: DRIFTED (config changed on agent)
  ✓ frontend @ staging-1: in sync
```

### Acceptance Criteria
- [ ] `mc node list/get/add/remove/ping/labels` work
- [ ] `mc deploy <app> --to <nodes>` works
- [ ] `mc deploy list/status/sync/remove/drift` work
- [ ] `mc cluster status` shows cluster overview
- [ ] `mc cluster apps <app> start/stop/restart` triggers cross-node ops
- [ ] All commands support `--output json/yaml/table/quiet`
- [ ] Shell completions updated for new commands

---

## Data Model Summary

### New Tables (Controller DB)

```sql
-- Phase 0: Extend existing Machines table
ALTER TABLE Machines ADD COLUMN AgentEndpoint TEXT;
ALTER TABLE Machines ADD COLUMN AgentApiKey TEXT;
ALTER TABLE Machines ADD COLUMN AgentVersion TEXT;
ALTER TABLE Machines ADD COLUMN Labels TEXT;          -- JSON
ALTER TABLE Machines ADD COLUMN CpuCores INTEGER;
ALTER TABLE Machines ADD COLUMN TotalMemoryBytes INTEGER;
ALTER TABLE Machines ADD COLUMN TotalDiskBytes INTEGER;

-- Phase 3: New table
CREATE TABLE AppDeployments (
    Id TEXT PRIMARY KEY,
    AppId TEXT NOT NULL,
    MachineId TEXT NOT NULL,
    RemoteAppId TEXT,
    Status INTEGER NOT NULL DEFAULT 0,
    DeployedAt TEXT NOT NULL,
    LastSyncedAt TEXT,
    ConfigHash TEXT,
    RemoteConfigHash TEXT,
    DeployedBy TEXT,
    Notes TEXT,
    LastError TEXT,
    FOREIGN KEY (AppId) REFERENCES Apps(Id) ON DELETE CASCADE,
    FOREIGN KEY (MachineId) REFERENCES Machines(Id) ON DELETE CASCADE
);

CREATE INDEX IX_AppDeployments_AppId ON AppDeployments(AppId);
CREATE INDEX IX_AppDeployments_MachineId ON AppDeployments(MachineId);
CREATE INDEX IX_AppDeployments_Status ON AppDeployments(Status);
```

### Entity Relationship

```
Machine (1) ──── (N) Service           (existing, via MachineId FK)
Machine (1) ──── (N) AppDeployment     (new)
App     (1) ──── (N) AppDeployment     (new)
AppDeployment ──── tracks ──── RemoteAppId (on agent's local DB)
```

---

## API Endpoint Summary

### Controller Endpoints (New)

| Method | Endpoint | Phase | Description |
|--------|----------|-------|-------------|
| **Machines** ||||
| GET | `/api/machines` | 0 | List machines |
| GET | `/api/machines/{id}` | 0 | Get machine |
| POST | `/api/machines` | 0 | Create machine |
| PUT | `/api/machines/{id}` | 0 | Update machine |
| DELETE | `/api/machines/{id}` | 0 | Delete machine |
| POST | `/api/machines/{id}/ping` | 0 | Ping machine |
| GET | `/api/machines/local` | 0 | Get local machine |
| **Cluster** ||||
| POST | `/api/cluster/register` | 1 | Agent self-registration |
| POST | `/api/cluster/heartbeat` | 1 | Agent heartbeat |
| GET | `/api/cluster/status` | 1 | Cluster overview |
| GET | `/api/cluster/nodes` | 1 | List nodes with details |
| GET | `/api/cluster/nodes/{id}` | 1 | Node detail |
| POST | `/api/cluster/nodes/{id}/ping` | 1 | Ping specific node |
| PUT | `/api/cluster/nodes/{id}` | 1 | Update node config |
| DELETE | `/api/cluster/nodes/{id}` | 1 | Remove node |
| **Deployments** ||||
| POST | `/api/cluster/deployments` | 3 | Deploy to node(s) |
| GET | `/api/cluster/deployments` | 3 | List deployments |
| GET | `/api/cluster/deployments/{id}` | 3 | Deployment detail |
| POST | `/api/cluster/deployments/{id}/sync` | 3 | Force sync |
| DELETE | `/api/cluster/deployments/{id}` | 3 | Undeploy |
| GET | `/api/cluster/deployments/drift` | 3 | Check all drift |
| **Cross-Node Ops** ||||
| POST | `/api/cluster/apps/{id}/start` | 5 | Start on all nodes |
| POST | `/api/cluster/apps/{id}/stop` | 5 | Stop on all nodes |
| POST | `/api/cluster/apps/{id}/restart` | 5 | Restart on all nodes |
| GET | `/api/cluster/apps/{id}/status` | 5 | Status across nodes |
| GET | `/api/cluster/apps/{id}/logs` | 5 | Aggregated logs |

### Agent Endpoints (Existing API — no new work needed)

The agent exposes the standard MiniCluster API. No new endpoints needed:

| Method | Endpoint | Already Exists? |
|--------|----------|-----------------|
| GET | `/api/health` | ✅ |
| GET/POST | `/api/apps` | ✅ |
| GET/PUT/DELETE | `/api/apps/{id}` | ✅ |
| POST | `/api/execution/{id}/start` | ✅ |
| POST | `/api/execution/{id}/stop` | ✅ |
| GET | `/api/logs/{id}` | ✅ |
| GET | `/api/metrics` | ✅ |

---

## Configuration

### Controller `appsettings.json`

```json
{
  "Cluster": {
    "Enabled": true,
    "HeartbeatTimeoutSeconds": 90,
    "HeartbeatCheckIntervalSeconds": 15,
    "PingRetries": 3,
    "PingRetryDelaySeconds": 5,
    "MaxConcurrentNodeOperations": 10,
    "Notifications": {
      "NodeOffline": true,
      "DriftDetected": true,
      "DeploymentFailed": true,
      "WebhookUrl": null
    }
  }
}
```

### Agent `appsettings.json`

```json
{
  "Agent": {
    "Enabled": true,
    "ControllerUrl": "https://controller.internal:5147",
    "ApiKey": "sk_agent_xxxxxxxxxxxxxxxxxxxx",
    "Name": "prod-server-1",
    "HeartbeatIntervalSeconds": 30,
    "Labels": {
      "env": "production",
      "region": "us-east",
      "customer": "acme-corp"
    }
  }
}
```

---

## Testing Strategy

### Unit Tests (API — xUnit)

| Test | Phase | Validates |
|------|-------|-----------|
| `MachineServiceTest` | 0 | CRUD, local auto-registration |
| `ConfigHasherTest` | 3 | Deterministic hashing, drift detection |
| `DeploymentServiceTest` | 3 | Deploy, sync, undeploy logic |
| `HeartbeatMonitorTest` | 1 | Offline detection, retry logic |
| `ClusterServiceTest` | 2 | Remote execution, error handling |
| `DiscoveryVarInjectionTest` | 3 | Env-var naming, completeness |

### Integration Tests (Go)

| Test | Phase | Validates |
|------|-------|-----------|
| `TestNodeRegistration` | 1 | Agent registers, appears in node list |
| `TestHeartbeat` | 1 | Heartbeat updates LastSeen |
| `TestDeployToNode` | 3 | App appears on remote agent |
| `TestCrossNodeStart` | 5 | Start on all nodes, per-node results |
| `TestDriftDetection` | 3 | Manual edit on agent detected as drift |
| `TestOfflineNode` | 1 | Node marked offline after timeout |
| `TestNodeLabels` | 6 | CLI label set/remove |
| `TestDeployByLabel` | 6 | CLI deploy with --label filter |

### UI Tests (Vitest + Testing Library)

| Test | Phase | Validates |
|------|-------|-----------|
| `ClusterOverview.test` | 4 | Renders nodes, aggregate metrics |
| `NodeCard.test` | 4 | Status colors, resource bars, offline indicator |
| `DeployModal.test` | 4 | Node selection, label filter, submit |
| `DriftAlert.test` | 4 | Warning badge, link to deployment |
| `CrossNodeStatus.test` | 5 | Per-node status table, action buttons |

---

## v2 Roadmap (Deferred Features)

These features are explicitly deferred from v1 to ship clustering faster. Each is self-contained and can be built once v1 is stable and in production.

### v2.1: mTLS Authentication (2 weeks)

| What | Details |
|------|---------|
| Mutual TLS between controller and agents | Each node gets a client certificate |
| Automatic certificate generation on registration | Controller acts as lightweight CA |
| Certificate rotation | Auto-renew before expiry |
| Fallback to API keys | mTLS optional, not mandatory |

### v2.2: Impersonation Contexts (2 weeks)

| What | Details |
|------|---------|
| Run commands as different user/credentials | Separate from node auth |
| Per-context allowed nodes and apps | Scoped access control |
| Windows domain support | Run-as with domain credentials |
| SSH key management | Key storage per context |

**Note:** Useful even on single-node — should be spec'd as an independent feature.

### v2.3: DNS-Based Service Discovery (1-2 weeks)

| What | Details |
|------|---------|
| Embedded DNS server (CoreDNS or custom) | Resolves `app.node.cluster.local` |
| Auto-registration of services in DNS | Based on proxy routes |
| Fallback to env-vars | DNS optional, env-vars always available |

**Note:** Complex on Windows where custom DNS management is painful. Env-var injection covers 90% of use cases.

### v2.4: Automatic Failover (3-4 weeks)

| What | Details |
|------|---------|
| Auto-reschedule apps from offline nodes | Based on placement constraints |
| Quorum-based leader election | Prevent split-brain |
| Fencing (STONITH) for offline nodes | Ensure clean failover |
| Configurable policies per app | `reschedule`, `notify-only`, `manual` |

**Warning:** This is the hardest distributed systems problem. Requires extensive operational experience with v1 before attempting. Split-brain and thundering herd are real risks.

### v2.5: Rolling & Blue-Green Deployments (2 weeks)

| What | Details |
|------|---------|
| Update nodes sequentially | Health check gate before next node |
| Configurable batch size | Update N nodes at a time |
| Automatic rollback on failure | Revert to previous version |
| Blue-green with traffic switching | Requires reverse proxy integration |

**Depends on:** Feature 007 (App Versioning)

### v2.6: Service Replication (3 weeks)

| What | Details |
|------|---------|
| `replicas: 3` config per service | Auto-spread across nodes |
| Placement strategies | `spread`, `binpack`, label constraints |
| Load balancing via YARP | Auto-configured upstream pool |
| Replica health monitoring | Replace unhealthy replicas |

---

## Effort Summary

### v1 (This Spec)

| Phase | Description | Effort | Cumulative |
|-------|-------------|--------|------------|
| 0 | Machine entity wiring | 1 week | 1 week |
| 1 | Agent mode & heartbeat | 1.5 weeks | 2.5 weeks |
| 2 | Remote execution | 1.5 weeks | 4 weeks |
| 3 | Deploy to node | 1.5 weeks | 5.5 weeks |
| 4 | Cluster dashboard UI | 1 week | 6.5 weeks |
| 5 | Cross-node operations | 1 week | 7.5 weeks |
| 6 | CLI parity | 0.5 weeks | **~8 weeks** |

### v2 Additions (post-launch)

| Feature | Effort |
|---------|--------|
| v2.1 mTLS authentication | 2 weeks |
| v2.2 Impersonation contexts | 2 weeks |
| v2.3 DNS-based discovery | 1-2 weeks |
| v2.4 Automatic failover | 3-4 weeks |
| v2.5 Rolling/blue-green deploy | 2 weeks |
| v2.6 Service replication | 3 weeks |
| **v2 Total** | **~14 weeks** |

---

## Dependencies

| Dependency | Required? | Status |
|------------|-----------|--------|
| 003 Authentication (JWT) | Required | ✅ Done |
| 003 Authentication (API keys) | Required for agent auth | 📋 Pending |
| 005 Reliability (health checks) | Recommended (enhances heartbeat) | 📋 Not blocking |
| 007 App Versioning | For v2 rolling deploys only | 📋 Not blocking v1 |

---

## Success Criteria

### v1 Launch

- [ ] 3+ nodes managed from single controller
- [ ] Deploy app to node in < 5 seconds
- [ ] Offline node detected within 90 seconds
- [ ] Config drift detected and surfaced in UI
- [ ] Agent survives controller restart (stateful local DB)
- [ ] CLI commands work for all cluster operations
- [ ] Zero data loss if controller goes down

### v1 Performance Targets

| Metric | Target |
|--------|--------|
| Heartbeat payload size | < 1 KB per beat |
| Deploy latency (single node) | < 5s |
| Deploy latency (10 nodes parallel) | < 10s |
| Max nodes per controller | 100 (v1) |
| Offline detection time | < 90s |
| API response time (cluster status) | < 500ms for 50 nodes |
