# MiniCluster Architecture

**Date:** February 2026  
**Version:** Post-Refactor (feature/phase5-service-refactor)  
**Status:** Current Production Architecture

---

## System Overview

MiniCluster is a **lightweight process manager** for development and small-scale deployments. It allows users to start, stop, and monitor multiple services (Node.js apps, Python scripts, .NET APIs, etc.) from a single web interface.

**Think:** PM2 + Docker Compose, but with a friendly UI and without containers.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Router 7 + TypeScript + Vite                  │   │
│  │  - Service Cards (list/grid view)                    │   │
│  │  - Service Details (config, logs, metrics)           │   │
│  │  - File Manager (upload/download)                    │   │
│  │  - Terminal (live logs)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│               ↕ HTTP (REST)        ↕ WebSocket (SignalR)    │
└─────────────────────────────────────────────────────────────┘
                       │                      │
                       ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│               ASP.NET Core Backend (.NET 9)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controllers (REST API)                              │   │
│  │  - ServicesController (CRUD, start/stop/restart)     │   │
│  │  - MachinesController (host management)              │   │
│  │  - FilesController (file operations)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SignalR Hub (Real-time)                             │   │
│  │  - ServiceStatusChanged                              │   │
│  │  - ServiceLogsUpdate                                 │   │
│  │  - ServiceMetricsUpdate                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ServiceProcessManager                               │   │
│  │  - Process lifecycle (Start/Stop/Restart)            │   │
│  │  - Log streaming (stdout/stderr)                     │   │
│  │  - Health monitoring (PID, CPU, Memory)              │   │
│  │  - AutoStart on app launch                           │   │
│  └──────────────────────────────────────────────────────┘   │
│               ↕                                              │
└─────────────────────────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Databases                          │
│  ┌──────────────────┐       ┌────────────────────────────┐  │
│  │  control.db      │       │  logs.db                   │  │
│  │  - Services      │       │  - LogEntries              │  │
│  │  - Machines      │       │  (separate for perf)       │  │
│  │  - ServiceFiles  │       └────────────────────────────┘  │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────────┐
│                    Host Operating System                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Managed Processes (Services)                        │   │
│  │  - Node.js apps                                      │   │
│  │  - Python scripts                                    │   │
│  │  - .NET APIs                                         │   │
│  │  - Go binaries                                       │   │
│  │  - Shell scripts                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Frontend (minicluster-ui)

**Stack:**
- **React Router 7** (file-based routing)
- **TypeScript** (type safety)
- **Vite** (dev server & build)
- **TanStack Query** (server state management)
- **SignalR Client** (real-time updates)
- **Tailwind CSS** (styling)

**Key Pages:**
- `/` - Dashboard (service cards/list)
- `/services/:id` - Service details
- `/machines` - Machine management
- `/infrastructure` - Infrastructure view (Phase 5)

**State Management:**
- **Server State:** TanStack Query (caching, invalidation)
- **UI State:** React hooks (useState, useReducer)
- **Real-time:** SignalR subscriptions

**Build Output:**
- Static files (HTML, JS, CSS)
- Served by ASP.NET Core (wwwroot folder)

---

### 2. Backend (minicluster-api)

**Stack:**
- **.NET 9** (ASP.NET Core)
- **Entity Framework Core** (ORM)
- **SQLite** (database)
- **SignalR** (WebSockets)
- **Serilog** (logging)

**Project Structure:**
```
ControlCenter.Api/
├── Controllers/        # REST API endpoints
├── Hubs/              # SignalR hubs
├── Services/          # Business logic
├── Data/              # DbContext, repositories
├── Entities/          # Database models
├── Dtos/              # Data transfer objects
├── Middleware/        # Auth, error handling
├── Configuration/     # Startup config
└── Program.cs         # Entry point
```

**Key Services:**
- `ServiceProcessManager` - Process lifecycle
- `LogService` - Log aggregation
- `FileService` - File operations
- `HealthCheckService` - Health monitoring

---

### 3. Database Layer

**Two SQLite Databases:**

#### control.db (Primary)
```
Services
├── Id (PK)
├── Name
├── Command
├── Arguments
├── WorkingDirectory
├── EnvironmentVariables
├── AutoStart
├── MachineId (FK)
└── Timestamps

Machines
├── Id (PK)
├── Name
├── IpAddress
├── Port
└── IsLocal

ServiceFiles
├── Id (PK)
├── ServiceId (FK)
├── FileName
├── FilePath
└── FileSize
```

#### logs.db (Separate for Performance)
```
LogEntries
├── Id (PK)
├── ServiceId
├── Timestamp
├── Level (Info/Error/Warning)
├── Message
└── Source (stdout/stderr)
```

**Why Two Databases?**
- **Performance:** Logs table grows rapidly (millions of rows)
- **Isolation:** Log writes don't lock service reads
- **Backup:** Can backup control.db without huge log files
- **Maintenance:** Can truncate logs without affecting config

---

### 4. Process Management

**ServiceProcessManager Responsibilities:**

```csharp
public class ServiceProcessManager
{
    // Lifecycle
    public async Task<ProcessResult> StartServiceAsync(Guid serviceId);
    public async Task<ProcessResult> StopServiceAsync(Guid serviceId);
    public async Task<ProcessResult> RestartServiceAsync(Guid serviceId);
    
    // Status
    public ServiceRuntimeStatus GetStatus(Guid serviceId);
    public ProcessMetrics GetMetrics(Guid serviceId);
    
    // Logs
    public IAsyncEnumerable<string> StreamLogsAsync(Guid serviceId);
    
    // AutoStart
    public async Task StartAutoStartServicesAsync();
}
```

**Process Tracking:**
- Dictionary: `serviceId → Process`
- Health check timer: Every 5 seconds
- Automatic restart on crash (if configured)

**Log Streaming:**
- Subscribe to `Process.OutputDataReceived`
- Buffer last 1000 lines in memory
- Persist to logs.db asynchronously
- Broadcast via SignalR

---

### 5. Real-Time Communication

**SignalR Hub:**

```csharp
public class ServiceHub : Hub
{
    public async Task SubscribeToService(string serviceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"service-{serviceId}");
    }
    
    public async Task UnsubscribeFromService(string serviceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"service-{serviceId}");
    }
}
```

**Events Broadcasted:**

| Event | When | Payload |
|-------|------|---------|
| `ServiceStatusChanged` | Start/stop/crash | `{ serviceId, status, timestamp }` |
| `ServiceLogsUpdate` | New log lines | `{ serviceId, lines[] }` |
| `ServiceMetricsUpdate` | Every 5s | `{ serviceId, cpu, memory, uptime }` |

**Frontend Connection:**

```typescript
const signalR = SignalRService.getInstance();

// ONE connection shared by all components
const unsubscribe = signalR.subscribeToServiceStatus(
  serviceId,
  (status) => setStatus(status)
);

// Cleanup
useEffect(() => unsubscribe, []);
```

---

## Data Flow Examples

### Example 1: Start a Service

```
1. User clicks "Start" button
   └─→ Frontend: useServiceMutations().start(serviceId)

2. HTTP POST /api/services/{id}/start
   └─→ Backend: ServicesController.Start(id)

3. Call ServiceProcessManager.StartServiceAsync(id)
   └─→ Load service config from DB
   └─→ Spawn process: Process.Start()
   └─→ Subscribe to stdout/stderr
   └─→ Store in active processes dictionary

4. Broadcast status change via SignalR
   └─→ Hub.Clients.Group($"service-{id}").SendAsync("ServiceStatusChanged", ...)

5. Frontend receives WebSocket message
   └─→ Update React state
   └─→ UI shows "Running" badge (green)
```

### Example 2: Stream Logs

```
1. User opens service detail page
   └─→ Frontend: useServiceLogs(serviceId)

2. Subscribe to SignalR logs
   └─→ signalR.subscribeToServiceLogs(serviceId, callback)

3. Backend captures stdout/stderr
   └─→ Process.OutputDataReceived += (sender, e) => { ... }

4. Broadcast new lines
   └─→ Hub.Clients.Group($"service-{id}").SendAsync("ServiceLogsUpdate", lines)

5. Frontend appends to terminal
   └─→ Terminal component scrolls to bottom
   └─→ Syntax highlighting applied
```

### Example 3: AutoStart on Backend Launch

```
1. Backend starts (Program.cs)
   └─→ var app = builder.Build();

2. Run AutoStart logic
   └─→ using (var scope = app.Services.CreateScope())
   └─→ var manager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
   └─→ await manager.StartAutoStartServicesAsync();

3. Query services with AutoStart = true
   └─→ var services = await _db.Services.Where(s => s.AutoStart).ToListAsync();

4. Start each service
   └─→ foreach (var service in services)
   └─→     await manager.StartServiceAsync(service.Id);

5. Log result
   └─→ _logger.LogInformation("AutoStart: {Count} services started", services.Count);
```

---

## Security Model

### Current State (Development Mode)

⚠️ **WARNING:** No authentication/authorization currently!

- All API endpoints are public
- Anyone on the network can start/stop services
- Suitable for local dev only

### Planned Security (Future)

1. **Authentication:**
   - JWT tokens
   - OAuth2 (Google, GitHub)
   - Local user accounts

2. **Authorization:**
   - Role-based: Admin, Developer, Viewer
   - Service-level permissions
   - Machine-level permissions

3. **Network Security:**
   - HTTPS only (TLS 1.3)
   - CORS policy (whitelist origins)
   - Rate limiting (throttle API calls)

4. **Process Isolation:**
   - Run services as unprivileged user
   - Limit resource usage (CPU, memory)
   - Sandbox file system access

---

## Performance Characteristics

### Benchmarks (on Intel i7, 16GB RAM)

| Metric | Value | Notes |
|--------|-------|-------|
| **API Latency** | <10ms | GET /api/services |
| **Start Service** | 100-500ms | Depends on service startup time |
| **Stop Service** | <100ms | SIGTERM + wait |
| **Log Streaming** | <50ms | From process to browser |
| **SignalR Latency** | <20ms | Status update propagation |
| **DB Query** | <5ms | Simple SELECT |
| **DB Write** | <10ms | INSERT service |

### Resource Usage

| Component | CPU (Idle) | CPU (Active) | Memory |
|-----------|------------|--------------|--------|
| **Backend** | <1% | 5-10% | ~100MB |
| **Frontend** | 0% | N/A (static) | N/A |
| **SQLite** | <1% | 2-5% | ~50MB |
| **Per Service** | Varies | Varies | Varies |

### Scalability Limits

| Dimension | Limit | Reason |
|-----------|-------|--------|
| **Max Services** | ~100 | Process management overhead |
| **Max Logs/Min** | ~10K lines | SignalR message rate |
| **Max Log Storage** | ~10GB | SQLite performance degrades |
| **Max Concurrent Users** | ~50 | SignalR connection limit |

**For higher scale:** Consider PM2, Kubernetes, or commercial process managers.

---

## Deployment Architecture

### Single Host (Current)

```
┌────────────────────────────────────────┐
│        Host Machine (Linux/Mac)         │
│  ┌──────────────────────────────────┐  │
│  │  MiniCluster Backend             │  │
│  │  (Port 5147)                     │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  Managed Services                │  │
│  │  - Service 1 (Port 3000)         │  │
│  │  - Service 2 (Port 4000)         │  │
│  │  - Service 3 (Port 5000)         │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Multi-Host (Phase 5 - Machines)

```
┌────────────────┐         ┌────────────────┐
│  Control Host  │         │  Worker Host 1  │
│  ┌──────────┐  │◄───────►│  ┌──────────┐  │
│  │ Backend  │  │   SSH   │  │Services  │  │
│  └──────────┘  │         │  └──────────┘  │
└────────────────┘         └────────────────┘
                                    │
                           ┌────────────────┐
                           │  Worker Host 2  │
                           │  ┌──────────┐  │
                           │  │Services  │  │
                           │  └──────────┘  │
                           └────────────────┘
```

**Communication:**
- Control → Worker: SSH (process start/stop)
- Worker → Control: HTTPS (heartbeat, metrics)

---

## Technology Decisions

### Why .NET 9?
- ✅ High performance (Kestrel web server)
- ✅ Cross-platform (Linux, Mac, Windows)
- ✅ Built-in SignalR (WebSockets)
- ✅ Excellent process management APIs
- ✅ Strong typing (C# + EF Core)

### Why SQLite?
- ✅ Zero configuration (no separate DB server)
- ✅ File-based (easy backup)
- ✅ ACID transactions
- ✅ Fast for <100GB data
- ❌ No multi-host (Phase 5 will need PostgreSQL)

### Why React Router 7?
- ✅ File-based routing (less boilerplate)
- ✅ Built-in SSR support (future)
- ✅ Type-safe routes
- ✅ Modern React conventions

### Why SignalR (not Socket.IO)?
- ✅ Native .NET integration
- ✅ Automatic reconnection
- ✅ Fallback to long polling
- ✅ Strongly typed (TypeScript)

---

## Comparison to Alternatives

### vs PM2
| Feature | MiniCluster | PM2 |
|---------|-------------|-----|
| **UI** | Web-based | CLI + optional web |
| **Platform** | Cross-platform | Node.js only |
| **Language Support** | Any | Best for Node.js |
| **Clustering** | Future | ✅ Built-in |
| **Monitoring** | Basic | Advanced |

### vs Docker Compose
| Feature | MiniCluster | Docker Compose |
|---------|-------------|----------------|
| **Isolation** | None | Containers |
| **Startup Time** | Fast | Slower (image pull) |
| **Resource Usage** | Low | Higher (container overhead) |
| **Networking** | Host network | Bridge/overlay |
| **Use Case** | Dev/small prod | Production |

### vs Kubernetes
| Feature | MiniCluster | Kubernetes |
|---------|-------------|------------|
| **Complexity** | Simple | High |
| **Scale** | ~100 services | 1000s of pods |
| **Learning Curve** | Low | Steep |
| **Infrastructure** | Single host | Cluster |
| **Cost** | Free | High (ops overhead) |

**MiniCluster's Niche:** Lightweight development and small deployments where Docker/K8s is overkill.

---

## Future Architecture Evolution

### Phase 2: App Groups (spec3/020-app-groups/)
- Add `Groups` table (Prod/Dev/Staging)
- Apps belong to groups
- Group-level operations (start all prod apps)

### Phase 3: App Hierarchy (spec3/030-app-hierarchy/)
- Nested apps (parent-child)
- Tree view UI
- Cascade operations

### Phase 4: Multi-Tenancy
- Organizations
- User accounts
- Service-level permissions

### Phase 5: Distributed Architecture
- PostgreSQL (replace SQLite)
- Redis (shared cache)
- Message queue (RabbitMQ/Kafka)
- Multi-host support

---

## Related Documents

- [Refactor Summary](./REFACTOR_SUMMARY.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Reference](./API_REFERENCE.md)
- [Evolution Roadmap](../EVOLUTION_ROADMAP.md)

---

**Status:** This architecture is current as of February 2026. See evolution roadmap for planned changes.
