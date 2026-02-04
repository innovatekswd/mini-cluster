# Feature 006: Container Support

## Overview

Add optional container (Docker/Podman) support alongside native process management. MiniCluster becomes a **hybrid orchestrator** that can manage both native processes and containers, giving users the flexibility to choose the right tool for each workload.

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

**Key Insight:** Not everything needs to be containerized. MiniCluster lets you use containers where they add value and native processes where they don't.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MINICLUSTER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED PROCESS INTERFACE                         │   │
│  │                                                                      │   │
│  │   ┌─────────────────────┐      ┌─────────────────────┐              │   │
│  │   │   Native Process    │      │     Container       │              │   │
│  │   │     Executor        │      │     Executor        │              │   │
│  │   │                     │      │                     │              │   │
│  │   │  System.Diagnostics │      │   Docker.DotNet /   │              │   │
│  │   │      .Process       │      │   Podman API        │              │   │
│  │   └─────────────────────┘      └─────────────────────┘              │   │
│  │              │                           │                           │   │
│  └──────────────┼───────────────────────────┼───────────────────────────┘   │
│                 │                           │                               │
│                 ▼                           ▼                               │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                │
│  │      OS Process         │    │    Docker/Podman        │                │
│  │   dotnet run            │    │    Container            │                │
│  │   node app.js           │    │    postgres:15          │                │
│  │   python script.py      │    │    redis:alpine         │                │
│  └─────────────────────────┘    └─────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Container Runtime Support

### Docker (Primary)

```csharp
// NuGet: Docker.DotNet
var config = new DockerClientConfiguration(
    new Uri("unix:///var/run/docker.sock")  // Linux
    // new Uri("npipe://./pipe/docker_engine")  // Windows
);
var client = config.CreateClient();
```

### Podman (Secondary)

```csharp
// Podman exposes Docker-compatible API
var config = new DockerClientConfiguration(
    new Uri("unix:///run/user/1000/podman/podman.sock")
);
var client = config.CreateClient();
```

### Configuration

```json
{
  "ContainerRuntime": {
    "Enabled": true,
    "Provider": "Docker",  // "Docker" | "Podman" | "Auto"
    "SocketPath": null,     // null = auto-detect
    "DefaultNetwork": "minicluster",
    "PullPolicy": "IfNotPresent"  // "Always" | "IfNotPresent" | "Never"
  }
}
```

---

## Data Model

### App Entity Extension

```csharp
public enum AppType
{
    Process = 0,    // Native OS process (existing)
    Container = 1   // Docker/Podman container
}

public class App
{
    // Existing fields...
    
    // New: App type
    public AppType Type { get; set; } = AppType.Process;
    
    // Container-specific (null for processes)
    public ContainerConfig? ContainerConfig { get; set; }
}

public class ContainerConfig
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    
    // Image
    public string Image { get; set; } = "";           // e.g., "postgres:15"
    public string? ImagePullSecret { get; set; }       // For private registries
    public PullPolicy PullPolicy { get; set; } = PullPolicy.IfNotPresent;
    
    // Runtime
    public string? ContainerId { get; set; }           // Docker container ID when running
    public string? ContainerName { get; set; }         // Custom name or auto-generated
    public bool RemoveOnStop { get; set; } = false;    // Remove container when stopped
    
    // Networking
    public List<PortMapping> Ports { get; set; } = new();
    public string? Network { get; set; }               // Docker network name
    public List<string> ExtraHosts { get; set; } = new();  // --add-host entries
    
    // Storage
    public List<VolumeMount> Volumes { get; set; } = new();
    
    // Resources
    public long? MemoryLimitBytes { get; set; }        // --memory
    public double? CpuLimit { get; set; }              // --cpus
    
    // Execution
    public string? Entrypoint { get; set; }            // Override entrypoint
    public string? Command { get; set; }               // Override CMD
    public string? User { get; set; }                  // Run as user
    public string? WorkingDir { get; set; }
    public bool Privileged { get; set; } = false;
    public bool ReadOnly { get; set; } = false;        // Read-only root filesystem
    
    // Labels
    public Dictionary<string, string> Labels { get; set; } = new();
}

public class PortMapping
{
    public int HostPort { get; set; }
    public int ContainerPort { get; set; }
    public string Protocol { get; set; } = "tcp";      // "tcp" | "udp"
    public string HostIp { get; set; } = "0.0.0.0";
}

public class VolumeMount
{
    public VolumeType Type { get; set; } = VolumeType.Bind;
    public string Source { get; set; } = "";           // Host path or volume name
    public string Target { get; set; } = "";           // Container path
    public bool ReadOnly { get; set; } = false;
}

public enum VolumeType
{
    Bind = 0,       // Host path mount
    Volume = 1,     // Named volume
    Tmpfs = 2       // In-memory
}

public enum PullPolicy
{
    Always = 0,
    IfNotPresent = 1,
    Never = 2
}
```

---

## Container Service

```csharp
public interface IContainerService
{
    // Lifecycle
    Task<string> CreateContainerAsync(App app, CancellationToken ct);
    Task StartContainerAsync(string containerId, CancellationToken ct);
    Task StopContainerAsync(string containerId, TimeSpan timeout, CancellationToken ct);
    Task RemoveContainerAsync(string containerId, bool force, CancellationToken ct);
    Task RestartContainerAsync(string containerId, CancellationToken ct);
    
    // Status
    Task<ContainerStatus> GetStatusAsync(string containerId, CancellationToken ct);
    Task<ContainerStats> GetStatsAsync(string containerId, CancellationToken ct);
    
    // Logs
    IAsyncEnumerable<string> StreamLogsAsync(string containerId, bool follow, CancellationToken ct);
    
    // Images
    Task PullImageAsync(string image, IProgress<string> progress, CancellationToken ct);
    Task<bool> ImageExistsAsync(string image, CancellationToken ct);
    Task<IEnumerable<ImageInfo>> ListImagesAsync(CancellationToken ct);
    Task RemoveImageAsync(string image, CancellationToken ct);
    
    // Networks
    Task<string> CreateNetworkAsync(string name, CancellationToken ct);
    Task<IEnumerable<NetworkInfo>> ListNetworksAsync(CancellationToken ct);
    
    // Volumes
    Task<string> CreateVolumeAsync(string name, CancellationToken ct);
    Task<IEnumerable<VolumeInfo>> ListVolumesAsync(CancellationToken ct);
    Task RemoveVolumeAsync(string name, CancellationToken ct);
    
    // Exec
    Task<ExecResult> ExecAsync(string containerId, string[] command, CancellationToken ct);
}

public class DockerContainerService : IContainerService
{
    private readonly DockerClient _client;
    private readonly ILogger<DockerContainerService> _logger;
    
    public async Task<string> CreateContainerAsync(App app, CancellationToken ct)
    {
        var config = app.ContainerConfig!;
        
        // Ensure image exists
        if (config.PullPolicy == PullPolicy.Always || 
            (config.PullPolicy == PullPolicy.IfNotPresent && !await ImageExistsAsync(config.Image, ct)))
        {
            await PullImageAsync(config.Image, null, ct);
        }
        
        var createParams = new CreateContainerParameters
        {
            Image = config.Image,
            Name = config.ContainerName ?? $"minicluster-{app.Id}",
            Env = app.EnvironmentVariables.Select(kv => $"{kv.Key}={kv.Value}").ToList(),
            Labels = new Dictionary<string, string>(config.Labels)
            {
                ["minicluster.app.id"] = app.Id.ToString(),
                ["minicluster.app.name"] = app.Name,
                ["minicluster.managed"] = "true"
            },
            HostConfig = new HostConfig
            {
                PortBindings = config.Ports.ToDictionary(
                    p => $"{p.ContainerPort}/{p.Protocol}",
                    p => (IList<PortBinding>)new List<PortBinding>
                    {
                        new() { HostIP = p.HostIp, HostPort = p.HostPort.ToString() }
                    }
                ),
                Binds = config.Volumes
                    .Where(v => v.Type == VolumeType.Bind)
                    .Select(v => $"{v.Source}:{v.Target}{(v.ReadOnly ? ":ro" : "")}")
                    .ToList(),
                Memory = config.MemoryLimitBytes ?? 0,
                NanoCPUs = (long)((config.CpuLimit ?? 0) * 1_000_000_000),
                NetworkMode = config.Network ?? "bridge",
                Privileged = config.Privileged,
                ReadonlyRootfs = config.ReadOnly,
                RestartPolicy = MapRestartPolicy(app.RestartPolicy)
            },
            ExposedPorts = config.Ports.ToDictionary(
                p => $"{p.ContainerPort}/{p.Protocol}",
                _ => new EmptyStruct()
            )
        };
        
        if (!string.IsNullOrEmpty(config.Entrypoint))
            createParams.Entrypoint = config.Entrypoint.Split(' ');
            
        if (!string.IsNullOrEmpty(config.Command))
            createParams.Cmd = config.Command.Split(' ');
            
        if (!string.IsNullOrEmpty(config.User))
            createParams.User = config.User;
            
        if (!string.IsNullOrEmpty(config.WorkingDir))
            createParams.WorkingDir = config.WorkingDir;
        
        var response = await _client.Containers.CreateContainerAsync(createParams, ct);
        
        _logger.LogInformation("Created container {ContainerId} for app {AppName}", 
            response.ID, app.Name);
        
        return response.ID;
    }
    
    public async Task StartContainerAsync(string containerId, CancellationToken ct)
    {
        await _client.Containers.StartContainerAsync(containerId, new ContainerStartParameters(), ct);
    }
    
    public async Task StopContainerAsync(string containerId, TimeSpan timeout, CancellationToken ct)
    {
        await _client.Containers.StopContainerAsync(containerId, 
            new ContainerStopParameters { WaitBeforeKillSeconds = (uint)timeout.TotalSeconds }, ct);
    }
    
    public async IAsyncEnumerable<string> StreamLogsAsync(
        string containerId, 
        bool follow, 
        [EnumeratorCancellation] CancellationToken ct)
    {
        var logParams = new ContainerLogsParameters
        {
            ShowStdout = true,
            ShowStderr = true,
            Follow = follow,
            Timestamps = true
        };
        
        using var stream = await _client.Containers.GetContainerLogsAsync(containerId, logParams, ct);
        using var reader = new StreamReader(stream);
        
        while (!ct.IsCancellationRequested && !reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (line != null)
                yield return line;
        }
    }
    
    private static RestartPolicy MapRestartPolicy(Services.RestartPolicy policy)
    {
        return policy switch
        {
            Services.RestartPolicy.Never => new RestartPolicy { Name = RestartPolicyKind.No },
            Services.RestartPolicy.OnFailure => new RestartPolicy { Name = RestartPolicyKind.OnFailure, MaximumRetryCount = 5 },
            Services.RestartPolicy.Always => new RestartPolicy { Name = RestartPolicyKind.Always },
            Services.RestartPolicy.UnlessStopped => new RestartPolicy { Name = RestartPolicyKind.UnlessStopped },
            _ => new RestartPolicy { Name = RestartPolicyKind.No }
        };
    }
}
```

---

## Unified Process Manager

```csharp
public interface IAppExecutor
{
    Task<bool> StartAsync(App app, CancellationToken ct);
    Task<bool> StopAsync(App app, TimeSpan timeout, CancellationToken ct);
    Task<bool> RestartAsync(App app, CancellationToken ct);
    Task<AppRuntimeStatus> GetStatusAsync(App app, CancellationToken ct);
    IAsyncEnumerable<string> StreamLogsAsync(App app, bool follow, CancellationToken ct);
}

public class UnifiedAppExecutor : IAppExecutor
{
    private readonly IProcessExecutor _processExecutor;
    private readonly IContainerService _containerService;
    
    public async Task<bool> StartAsync(App app, CancellationToken ct)
    {
        return app.Type switch
        {
            AppType.Process => await _processExecutor.StartAsync(app, ct),
            AppType.Container => await StartContainerAppAsync(app, ct),
            _ => throw new NotSupportedException($"Unknown app type: {app.Type}")
        };
    }
    
    private async Task<bool> StartContainerAppAsync(App app, CancellationToken ct)
    {
        var config = app.ContainerConfig!;
        
        // Create container if it doesn't exist
        if (string.IsNullOrEmpty(config.ContainerId))
        {
            config.ContainerId = await _containerService.CreateContainerAsync(app, ct);
            await _db.SaveChangesAsync(ct);
        }
        
        await _containerService.StartContainerAsync(config.ContainerId, ct);
        return true;
    }
    
    public async Task<AppRuntimeStatus> GetStatusAsync(App app, CancellationToken ct)
    {
        if (app.Type == AppType.Container && app.ContainerConfig?.ContainerId != null)
        {
            var status = await _containerService.GetStatusAsync(app.ContainerConfig.ContainerId, ct);
            return new AppRuntimeStatus
            {
                IsRunning = status.State == "running",
                Pid = null,
                ContainerId = app.ContainerConfig.ContainerId,
                StartedAt = status.StartedAt,
                CpuPercent = status.CpuPercent,
                MemoryBytes = status.MemoryBytes
            };
        }
        
        return await _processExecutor.GetStatusAsync(app, ct);
    }
}
```

---

## API Endpoints

### Container-Specific

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
| GET | `/api/apps/{id}/container/logs` | Stream container logs |
| GET | `/api/apps/{id}/container/stats` | Get container stats |
| POST | `/api/apps/{id}/container/exec` | Execute command in container |

### Modified App Endpoints

```csharp
// POST /api/apps - Create app (now supports containers)
public class CreateAppDto
{
    public string Name { get; set; } = "";
    public AppType Type { get; set; } = AppType.Process;
    
    // Process-specific (Type = Process)
    public string? Command { get; set; }
    public string? Arguments { get; set; }
    public string? WorkingDirectory { get; set; }
    
    // Container-specific (Type = Container)
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

## UI Components

### App Type Selection

```tsx
function AppTypeSelector({ value, onChange }: Props) {
  return (
    <div className="app-type-selector">
      <button 
        className={`type-btn ${value === 'process' ? 'active' : ''}`}
        onClick={() => onChange('process')}
      >
        <TerminalIcon />
        <span>Native Process</span>
        <small>Run command directly on host</small>
      </button>
      
      <button 
        className={`type-btn ${value === 'container' ? 'active' : ''}`}
        onClick={() => onChange('container')}
      >
        <ContainerIcon />
        <span>Container</span>
        <small>Run Docker/Podman container</small>
      </button>
    </div>
  );
}
```

### Container Configuration Form

```tsx
function ContainerConfigForm({ value, onChange }: Props) {
  return (
    <div className="container-config">
      <FormField label="Image" required>
        <ImageSelector 
          value={value.image}
          onChange={image => onChange({...value, image})}
        />
      </FormField>
      
      <FormField label="Ports">
        <PortMappingEditor 
          value={value.ports}
          onChange={ports => onChange({...value, ports})}
        />
      </FormField>
      
      <FormField label="Volumes">
        <VolumeMappingEditor 
          value={value.volumes}
          onChange={volumes => onChange({...value, volumes})}
        />
      </FormField>
      
      <FormField label="Environment">
        <EnvEditor 
          value={value.env}
          onChange={env => onChange({...value, env})}
        />
      </FormField>
      
      <Collapsible title="Advanced">
        <FormField label="Memory Limit (MB)">
          <NumberInput value={value.memoryLimitMb} onChange={...} />
        </FormField>
        
        <FormField label="CPU Limit">
          <NumberInput value={value.cpuLimit} step={0.1} onChange={...} />
        </FormField>
        
        <FormField label="Network">
          <NetworkSelector value={value.network} onChange={...} />
        </FormField>
      </Collapsible>
    </div>
  );
}
```

### Image Browser

```tsx
function ImageBrowser({ onSelect }: Props) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [search, setSearch] = useState("");
  const [pulling, setPulling] = useState<string | null>(null);
  
  const handlePull = async (imageName: string) => {
    setPulling(imageName);
    try {
      await api.pullImage(imageName, progress => {
        // Update progress UI
      });
      await refreshImages();
    } finally {
      setPulling(null);
    }
  };
  
  return (
    <div className="image-browser">
      <SearchInput 
        value={search} 
        onChange={setSearch}
        placeholder="Search images or enter name to pull..."
      />
      
      {search && !images.find(i => i.name === search) && (
        <div className="pull-suggestion">
          <span>Pull "{search}" from registry?</span>
          <Button onClick={() => handlePull(search)} loading={pulling === search}>
            Pull Image
          </Button>
        </div>
      )}
      
      <div className="image-list">
        {images.map(image => (
          <ImageCard 
            key={image.id}
            image={image}
            onSelect={() => onSelect(image.name)}
            onRemove={() => handleRemove(image.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Database Migration

```csharp
public partial class AddContainerSupport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Type",
            table: "Apps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
            
        migrationBuilder.CreateTable(
            name: "ContainerConfigs",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
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
                Ports = table.Column<string>(nullable: true),     // JSON
                Volumes = table.Column<string>(nullable: true),   // JSON
                Labels = table.Column<string>(nullable: true)     // JSON
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ContainerConfigs", x => x.Id);
                table.ForeignKey(
                    name: "FK_ContainerConfigs_Apps_AppId",
                    column: x => x.AppId,
                    principalTable: "Apps",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
            
        migrationBuilder.CreateIndex(
            name: "IX_ContainerConfigs_AppId",
            table: "ContainerConfigs",
            column: "AppId",
            unique: true);
    }
}
```

---

## Implementation Phases

### Phase 1: Core Container Support (3 weeks)
- [ ] Add Docker.DotNet package
- [ ] Implement IContainerService
- [ ] Add AppType enum and ContainerConfig entity
- [ ] Database migration
- [ ] Modify AppProcessManager for unified execution
- [ ] Basic container lifecycle (create, start, stop, remove)

### Phase 2: Container UI (2 weeks)
- [ ] App type selector in create form
- [ ] Container configuration form
- [ ] Image browser/puller
- [ ] Port mapping editor
- [ ] Volume mapping editor
- [ ] Container status display

### Phase 3: Advanced Features (2 weeks)
- [ ] Container logs streaming
- [ ] Container stats (CPU/memory)
- [ ] Exec into container
- [ ] Network management
- [ ] Volume management
- [ ] Resource limits UI

### Phase 4: Podman Support (1 week)
- [ ] Podman socket detection
- [ ] Test compatibility
- [ ] Documentation

---

## Estimated Effort

**Total: 6-8 weeks**

---

## Dependencies

- Docker.DotNet NuGet package (6.x)
- Docker Engine or Podman installed on host
- Feature 005 (restart policies, health checks) recommended

---

## Notes

- Container support is **optional** - MiniCluster works fine without Docker
- Native processes remain the primary focus (especially for Windows)
- Containers add value for standardized services (databases, caches, etc.)
- Hybrid apps (some services as processes, some as containers) are supported
