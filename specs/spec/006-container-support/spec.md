# Feature 006: Container Support

## Overview

Add optional container (Docker/Podman) support alongside native process management. MiniCluster becomes a **hybrid orchestrator** that can manage both native processes and containers, giving users the flexibility to choose the right tool for each workload.

**Entity Model:** `Service` gains a `ServiceType` field (Process/Container). Container-specific config lives in a related `ContainerConfig` entity. The existing `App` entity (grouping) is unchanged.

---

## Business Value

### Why Hybrid (Process + Container)?

| Workload | Best Approach | Why |
|----------|---------------|-----|
| .NET app on Windows | Native Process | Windows containers are slow, large |
| Node.js script | Native Process | No isolation needed, simpler |
| PostgreSQL | Container | Standardized, easy setup |
| Redis | Container | Ephemeral, reproducible |
| Legacy Windows app | Native Process | Can't be containerized |
| Microservices | Container | Isolation, portability |

---

## Data Model

> **Alignment with codebase:**
> - `Service` (table: `ControlledApps`) = runnable process — gains `ServiceType`
> - `App` (table: `Apps`) = grouping — **unchanged**
> - `ContainerConfig` = new entity linked to `Service` via `ServiceId`

### Service Entity Extension

```csharp
public enum ServiceType
{
    Process = 0,    // Native OS process (existing behavior)
    Container = 1   // Docker/Podman container
}

// Added to existing Service entity (Core/Entities/Service.cs)
public class Service : ServiceBase
{
    // ... existing fields ...
    public ServiceType Type { get; set; } = ServiceType.Process;
    public ContainerConfig? ContainerConfig { get; set; }
}
```

### ContainerConfig Entity (new)

```csharp
public class ContainerConfig
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public Service Service { get; set; } = null!;

    // Image
    public string Image { get; set; } = "";
    public string? ImagePullSecret { get; set; }
    public PullPolicy PullPolicy { get; set; } = PullPolicy.IfNotPresent;

    // Runtime
    public string? ContainerId { get; set; }
    public string? ContainerName { get; set; }
    public bool RemoveOnStop { get; set; } = false;

    // Networking (JSON-serialized)
    public List<PortMapping> Ports { get; set; } = new();
    public string? Network { get; set; }

    // Storage (JSON-serialized)
    public List<VolumeMount> Volumes { get; set; } = new();

    // Resources
    public long? MemoryLimitBytes { get; set; }
    public double? CpuLimit { get; set; }

    // Execution overrides
    public string? Entrypoint { get; set; }
    public string? Command { get; set; }
    public string? User { get; set; }
    public string? WorkingDir { get; set; }
    public bool Privileged { get; set; } = false;
    public bool ReadOnly { get; set; } = false;

    // Labels (JSON-serialized)
    public Dictionary<string, string> Labels { get; set; } = new();
}

public class PortMapping
{
    public int HostPort { get; set; }
    public int ContainerPort { get; set; }
    public string Protocol { get; set; } = "tcp";
    public string HostIp { get; set; } = "0.0.0.0";
}

public class VolumeMount
{
    public VolumeType Type { get; set; } = VolumeType.Bind;
    public string Source { get; set; } = "";
    public string Target { get; set; } = "";
    public bool ReadOnly { get; set; } = false;
}

public enum VolumeType { Bind = 0, Volume = 1, Tmpfs = 2 }
public enum PullPolicy { Always = 0, IfNotPresent = 1, Never = 2 }
```

---

## Container Runtime Configuration

```json
{
  "ContainerRuntime": {
    "Enabled": true,
    "Provider": "Docker",
    "SocketPath": null,
    "DefaultNetwork": "minicluster",
    "PullPolicy": "IfNotPresent"
  }
}
```

---

## Container Service Interface

```csharp
public interface IContainerService
{
    Task<string> CreateContainerAsync(Service service, CancellationToken ct);
    Task StartContainerAsync(string containerId, CancellationToken ct);
    Task StopContainerAsync(string containerId, TimeSpan timeout, CancellationToken ct);
    Task RemoveContainerAsync(string containerId, bool force, CancellationToken ct);
    Task RestartContainerAsync(string containerId, CancellationToken ct);
    Task<ContainerStatus> GetStatusAsync(string containerId, CancellationToken ct);
    Task<ContainerStats> GetStatsAsync(string containerId, CancellationToken ct);
    IAsyncEnumerable<string> StreamLogsAsync(string containerId, bool follow, CancellationToken ct);
    Task PullImageAsync(string image, IProgress<string> progress, CancellationToken ct);
    Task<bool> ImageExistsAsync(string image, CancellationToken ct);
    Task<IEnumerable<ImageInfo>> ListImagesAsync(CancellationToken ct);
    Task<ExecResult> ExecAsync(string containerId, string[] command, CancellationToken ct);
}
```

---

## Unified Service Executor

```csharp
public interface IServiceExecutor
{
    Task<bool> StartAsync(Service service, CancellationToken ct);
    Task<bool> StopAsync(Service service, TimeSpan timeout, CancellationToken ct);
    Task<bool> RestartAsync(Service service, CancellationToken ct);
    Task<ServiceRuntimeStatus> GetStatusAsync(Service service, CancellationToken ct);
    IAsyncEnumerable<string> StreamLogsAsync(Service service, bool follow, CancellationToken ct);
}

public class UnifiedServiceExecutor : IServiceExecutor
{
    private readonly IProcessExecutor _processExecutor;
    private readonly IContainerService _containerService;

    public async Task<bool> StartAsync(Service service, CancellationToken ct)
    {
        return service.Type switch
        {
            ServiceType.Process => await _processExecutor.StartAsync(service, ct),
            ServiceType.Container => await StartContainerAsync(service, ct),
            _ => throw new NotSupportedException($"Unknown service type: {service.Type}")
        };
    }
}
```

---

## API Endpoints

### Container Infrastructure

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/containers/runtime` | Get runtime info (Docker/Podman version) |
| GET | `/api/images` | List available images |
| POST | `/api/images/pull` | Pull an image |
| DELETE | `/api/images/{name}` | Remove an image |
| GET | `/api/volumes` | List volumes |
| POST | `/api/volumes` | Create volume |
| DELETE | `/api/volumes/{name}` | Remove volume |
| GET | `/api/networks` | List networks |
| POST | `/api/networks` | Create network |

### Service Container Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services/{id}/container/logs` | Stream container logs |
| GET | `/api/services/{id}/container/stats` | Get container stats |
| POST | `/api/services/{id}/container/exec` | Execute command in container |

### Modified Service DTOs

```csharp
public class CreateServiceDto
{
    public string Name { get; set; } = "";
    public ServiceType Type { get; set; } = ServiceType.Process;

    // Process-specific
    public string? ExecutablePath { get; set; }
    public string? Arguments { get; set; }
    public string? WorkingDirectory { get; set; }

    // Container-specific
    public CreateContainerConfigDto? Container { get; set; }

    // Shared
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
    public RestartPolicy RestartPolicy { get; set; } = RestartPolicy.Never;
}

public class CreateContainerConfigDto
{
    public string Image { get; set; } = "";
    public List<PortMappingDto> Ports { get; set; } = new();
    public List<VolumeMountDto> Volumes { get; set; } = new();
    public long? MemoryLimitMb { get; set; }
    public double? CpuLimit { get; set; }
    public string? Network { get; set; }
}
```

---

## Health Check Integration

Existing `Service.HealthCheckType` (Http/Tcp/Exec) works for containers:
- **HTTP**: hit the container's mapped port
- **TCP**: connect to the mapped host port
- **Exec**: `docker exec` a command inside the container

MiniCluster manages all health checks uniformly — Docker health checks are not used.

---

## Database Migration

```csharp
public partial class AddContainerSupport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Type",
            table: "ControlledApps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.CreateTable(
            name: "ContainerConfigs",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                ServiceId = table.Column<Guid>(nullable: false),
                Image = table.Column<string>(maxLength: 500, nullable: false),
                ContainerId = table.Column<string>(maxLength: 100, nullable: true),
                ContainerName = table.Column<string>(maxLength: 100, nullable: true),
                PullPolicy = table.Column<int>(nullable: false, defaultValue: 1),
                RemoveOnStop = table.Column<bool>(nullable: false, defaultValue: false),
                Network = table.Column<string>(maxLength: 100, nullable: true),
                MemoryLimitBytes = table.Column<long>(nullable: true),
                CpuLimit = table.Column<double>(nullable: true),
                Entrypoint = table.Column<string>(nullable: true),
                Command = table.Column<string>(nullable: true),
                User = table.Column<string>(maxLength: 100, nullable: true),
                WorkingDir = table.Column<string>(maxLength: 500, nullable: true),
                Privileged = table.Column<bool>(nullable: false, defaultValue: false),
                ReadOnly = table.Column<bool>(nullable: false, defaultValue: false),
                Ports = table.Column<string>(nullable: true),
                Volumes = table.Column<string>(nullable: true),
                Labels = table.Column<string>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ContainerConfigs", x => x.Id);
                table.ForeignKey("FK_ContainerConfigs_Services",
                    x => x.ServiceId, "ControlledApps", "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            "IX_ContainerConfigs_ServiceId",
            "ContainerConfigs", "ServiceId", unique: true);
    }
}
```

---

## Implementation Phases

### Phase 1: Core Container Support (3 weeks)
- [ ] Add Docker.DotNet package
- [ ] Add `ServiceType` enum and `ContainerConfig` entity to `Core/Entities/`
- [ ] Database migration
- [ ] Implement `IContainerService` / `DockerContainerService`
- [ ] Implement `IServiceExecutor` / `UnifiedServiceExecutor`
- [ ] Basic container lifecycle (create, start, stop, remove)
- [ ] Wire into existing `ServiceProcessManager`

### Phase 2: Container UI (2 weeks)
- [ ] Service type selector in create form (Process / Container)
- [ ] Container configuration form (image, ports, volumes, env)
- [ ] Image browser/puller
- [ ] Container status display in service list

### Phase 3: Advanced Features (2 weeks)
- [ ] Container logs streaming (integrate with existing log infrastructure)
- [ ] Container stats via `ProcessMetrics`
- [ ] Exec into container
- [ ] Network and volume management UI

### Phase 4: Podman Support (1 week)
- [ ] Podman socket detection
- [ ] Test compatibility

---

## Estimated Effort: 6-8 weeks

## Dependencies

- Docker.DotNet NuGet package (6.x)
- Feature 005 (restart policies, health checks) — ✅ Done

## Notes

- Container support is **optional** — MiniCluster works without Docker
- Hybrid apps: some services as processes, some as containers within the same App group
- The `App` entity is unchanged — it remains a grouping container
