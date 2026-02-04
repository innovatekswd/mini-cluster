# Feature 010: Multi-Node Cluster

## Overview

Control multiple machines from a single MiniCluster instance via **API-based agents**. This enables:
- Central dashboard for all nodes
- Deploy apps across machines
- Cross-node service discovery
- Impersonation (run as different user/context)

---

## Business Value

| Problem | Solution |
|---------|----------|
| Managing 10 servers individually | Single dashboard for all |
| "Deploy to all prod servers" | One-click multi-node deploy |
| Service on machine A calls B | Cross-node discovery |
| Different credentials per server | Impersonation contexts |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLUSTER ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐                                         │
│  │  CONTROL PLANE     │  (MiniCluster Primary)                  │
│  │  ┌──────────────┐  │                                         │
│  │  │ Cluster API  │  │◄──── UI / External API                  │
│  │  │ Orchestrator │  │                                         │
│  │  │ Discovery    │  │                                         │
│  │  └──────────────┘  │                                         │
│  └─────────┬──────────┘                                         │
│            │ HTTPS/mTLS                                         │
│  ┌─────────┴─────────────────────────────────────────────┐     │
│  │                                                        │     │
│  ▼                        ▼                        ▼     │     │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐       │     │
│  │  NODE A  │      │  NODE B  │      │  NODE C  │       │     │
│  │  Agent   │      │  Agent   │      │  Agent   │       │     │
│  │          │      │          │      │          │       │     │
│  │ ┌──────┐ │      │ ┌──────┐ │      │ ┌──────┐ │       │     │
│  │ │App 1 │ │      │ │App 3 │ │      │ │App 5 │ │       │     │
│  │ │App 2 │ │      │ │App 4 │ │      │ │App 6 │ │       │     │
│  │ └──────┘ │      │ └──────┘ │      │ └──────┘ │       │     │
│  └──────────┘      └──────────┘      └──────────┘       │     │
│                                                          │     │
└──────────────────────────────────────────────────────────┘     │
                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```csharp
public class ClusterNode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    
    // Connection
    public string Endpoint { get; set; } = "";  // https://node-a:5147
    public NodeAuthType AuthType { get; set; } = NodeAuthType.ApiKey;
    public string? ApiKey { get; set; }  // Encrypted
    public string? CertificateThumbprint { get; set; }  // For mTLS
    
    // Status
    public NodeStatus Status { get; set; } = NodeStatus.Unknown;
    public DateTime? LastHeartbeat { get; set; }
    public string? LastError { get; set; }
    
    // Metadata
    public string? Hostname { get; set; }
    public string? IpAddress { get; set; }
    public string? OS { get; set; }
    public string? AgentVersion { get; set; }
    
    // Resources
    public int? CpuCores { get; set; }
    public long? MemoryBytes { get; set; }
    public long? DiskBytes { get; set; }
    
    // Labels for targeting
    public Dictionary<string, string> Labels { get; set; } = new();
    
    // Apps on this node
    public ICollection<NodeApp> Apps { get; set; } = new List<NodeApp>();
}

public enum NodeStatus
{
    Unknown = 0,
    Online = 1,
    Offline = 2,
    Unhealthy = 3,
    Maintenance = 4
}

public enum NodeAuthType
{
    ApiKey = 0,
    mTLS = 1,
    OAuth = 2
}

// App placement on node
public class NodeApp
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid NodeId { get; set; }
    public ClusterNode Node { get; set; } = null!;
    
    public Guid AppId { get; set; }  // Reference to local app definition
    public App App { get; set; } = null!;
    
    public Guid? RemoteAppId { get; set; }  // ID on the remote node
    public NodeAppStatus Status { get; set; }
    public DateTime? LastSync { get; set; }
}

// Impersonation context
public class ImpersonationContext
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    
    // What this context can access
    public List<Guid>? AllowedNodes { get; set; }  // null = all
    public List<Guid>? AllowedApps { get; set; }
    
    // Credentials
    public string? Username { get; set; }
    public string? EncryptedPassword { get; set; }
    public string? SshKeyId { get; set; }
    
    // Windows-specific
    public string? Domain { get; set; }
    public bool RunAsAdmin { get; set; }
}
```

## Cluster Service

```csharp
public interface IClusterService
{
    // Nodes
    Task<ClusterNode> RegisterNodeAsync(RegisterNodeDto dto, CancellationToken ct);
    Task<List<ClusterNode>> GetNodesAsync(CancellationToken ct);
    Task<bool> PingNodeAsync(Guid nodeId, CancellationToken ct);
    Task RemoveNodeAsync(Guid nodeId, CancellationToken ct);
    
    // Remote operations
    Task<T> ExecuteOnNodeAsync<T>(Guid nodeId, Func<INodeClient, Task<T>> action, CancellationToken ct);
    Task ExecuteOnAllNodesAsync(Func<INodeClient, Task> action, CancellationToken ct);
    
    // App deployment to nodes
    Task<NodeApp> DeployToNodeAsync(Guid appId, Guid nodeId, CancellationToken ct);
    Task SyncAppAsync(Guid nodeAppId, CancellationToken ct);
    Task<List<NodeApp>> GetNodeAppsAsync(Guid nodeId, CancellationToken ct);
}

public class ClusterService : IClusterService
{
    public async Task<T> ExecuteOnNodeAsync<T>(
        Guid nodeId, 
        Func<INodeClient, Task<T>> action, 
        CancellationToken ct)
    {
        var node = await _db.ClusterNodes.FindAsync(nodeId);
        
        var client = _nodeClientFactory.CreateClient(node);
        try
        {
            var result = await action(client);
            node.Status = NodeStatus.Online;
            node.LastHeartbeat = DateTime.UtcNow;
            return result;
        }
        catch (Exception ex)
        {
            node.Status = NodeStatus.Unhealthy;
            node.LastError = ex.Message;
            throw;
        }
        finally
        {
            await _db.SaveChangesAsync(ct);
        }
    }
    
    public async Task<NodeApp> DeployToNodeAsync(Guid appId, Guid nodeId, CancellationToken ct)
    {
        var app = await _db.Apps
            .Include(a => a.Services)
            .FirstOrDefaultAsync(a => a.Id == appId, ct);
        
        // Convert to DTO for remote deployment
        var deployDto = MapToDeployDto(app);
        
        // Create on remote node
        var remoteApp = await ExecuteOnNodeAsync(nodeId, async client => 
        {
            return await client.Apps.CreateAsync(deployDto, ct);
        }, ct);
        
        // Track locally
        var nodeApp = new NodeApp
        {
            NodeId = nodeId,
            AppId = appId,
            RemoteAppId = remoteApp.Id,
            Status = NodeAppStatus.Deployed,
            LastSync = DateTime.UtcNow
        };
        _db.NodeApps.Add(nodeApp);
        await _db.SaveChangesAsync(ct);
        
        return nodeApp;
    }
}
```

## Node Client (API Client)

```csharp
public interface INodeClient : IDisposable
{
    INodeAppsClient Apps { get; }
    INodeServicesClient Services { get; }
    INodeLogsClient Logs { get; }
    INodeMetricsClient Metrics { get; }
    INodeSystemClient System { get; }
}

public interface INodeAppsClient
{
    Task<AppDto> CreateAsync(CreateAppDto dto, CancellationToken ct);
    Task<List<AppDto>> ListAsync(CancellationToken ct);
    Task<AppDto> GetAsync(Guid id, CancellationToken ct);
    Task UpdateAsync(Guid id, UpdateAppDto dto, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task StartAsync(Guid id, CancellationToken ct);
    Task StopAsync(Guid id, CancellationToken ct);
    Task RestartAsync(Guid id, CancellationToken ct);
}

public class NodeClient : INodeClient
{
    private readonly HttpClient _http;
    
    public NodeClient(ClusterNode node, IHttpClientFactory factory)
    {
        _http = factory.CreateClient();
        _http.BaseAddress = new Uri(node.Endpoint);
        
        // Auth
        if (node.AuthType == NodeAuthType.ApiKey)
        {
            _http.DefaultRequestHeaders.Add("X-Api-Key", node.ApiKey);
        }
    }
    
    public INodeAppsClient Apps => new NodeAppsClient(_http);
}

public class NodeAppsClient : INodeAppsClient
{
    private readonly HttpClient _http;
    
    public NodeAppsClient(HttpClient http) => _http = http;
    
    public async Task<AppDto> CreateAsync(CreateAppDto dto, CancellationToken ct)
    {
        var response = await _http.PostAsJsonAsync("/api/apps", dto, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AppDto>(ct);
    }
    
    public async Task StartAsync(Guid id, CancellationToken ct)
    {
        var response = await _http.PostAsync($"/api/apps/{id}/start", null, ct);
        response.EnsureSuccessStatusCode();
    }
    // ... other methods
}
```

## Node Agent Endpoints (Required API)

Each node must expose these APIs for the control plane:

| Method | Endpoint | Description |
|--------|----------|-------------|
| **System** |||
| GET | `/api/system/info` | Node info (OS, version, resources) |
| GET | `/api/system/health` | Health check |
| **Apps** |||
| GET | `/api/apps` | List apps |
| POST | `/api/apps` | Create app |
| GET | `/api/apps/{id}` | Get app |
| PUT | `/api/apps/{id}` | Update app |
| DELETE | `/api/apps/{id}` | Delete app |
| POST | `/api/apps/{id}/start` | Start app |
| POST | `/api/apps/{id}/stop` | Stop app |
| POST | `/api/apps/{id}/restart` | Restart app |
| **Logs** |||
| GET | `/api/apps/{id}/logs` | Get logs |
| GET | `/api/apps/{id}/logs/stream` | Stream logs (WebSocket) |
| **Metrics** |||
| GET | `/api/apps/{id}/metrics` | Get metrics |

## Control Plane API

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Nodes** |||
| GET | `/api/cluster/nodes` | List all nodes |
| POST | `/api/cluster/nodes` | Register node |
| GET | `/api/cluster/nodes/{id}` | Get node |
| DELETE | `/api/cluster/nodes/{id}` | Remove node |
| POST | `/api/cluster/nodes/{id}/ping` | Health check node |
| **Node Apps** |||
| POST | `/api/cluster/deploy` | Deploy app to node(s) |
| GET | `/api/cluster/nodes/{id}/apps` | List apps on node |
| POST | `/api/cluster/nodes/{id}/apps/{appId}/sync` | Sync app config |
| **Cross-Node** |||
| POST | `/api/cluster/apps/{id}/start` | Start on all nodes |
| POST | `/api/cluster/apps/{id}/stop` | Stop on all nodes |
| GET | `/api/cluster/apps/{id}/status` | Status across nodes |
| **Impersonation** |||
| GET | `/api/cluster/contexts` | List contexts |
| POST | `/api/cluster/contexts` | Create context |
| POST | `/api/cluster/execute` | Execute with context |

## UI Components

```tsx
function ClusterDashboard() {
  const { data: nodes } = useClusterNodes();
  
  return (
    <div className="cluster-dashboard">
      <header>
        <h1>Cluster</h1>
        <Button onClick={() => openAddNodeModal()}>Add Node</Button>
      </header>
      
      <div className="nodes-grid">
        {nodes?.map(node => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

function NodeCard({ node }: { node: ClusterNode }) {
  const { data: apps } = useNodeApps(node.id);
  
  return (
    <Card className={`node-card status-${node.status}`}>
      <div className="node-header">
        <StatusDot status={node.status} />
        <h3>{node.name}</h3>
        <span className="hostname">{node.hostname}</span>
      </div>
      
      <div className="node-meta">
        <span>{node.os}</span>
        <span>{node.agentVersion}</span>
      </div>
      
      <div className="node-resources">
        <ResourceBar label="CPU" used={node.cpuUsage} total={node.cpuCores} />
        <ResourceBar label="Memory" used={node.memoryUsed} total={node.memoryBytes} />
      </div>
      
      <div className="node-apps">
        <h4>Apps ({apps?.length})</h4>
        {apps?.slice(0, 5).map(app => (
          <AppRow key={app.id} app={app} compact />
        ))}
        {apps?.length > 5 && <Link to={`/cluster/nodes/${node.id}`}>View all</Link>}
      </div>
      
      <div className="node-actions">
        <Button size="sm" onClick={() => deployToNode(node.id)}>Deploy</Button>
        <Button size="sm" variant="ghost" onClick={() => pingNode(node.id)}>Ping</Button>
      </div>
    </Card>
  );
}

function DeployToClusterModal({ app }: { app: App }) {
  const { data: nodes } = useClusterNodes();
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const deployMutation = useDeployToCluster();
  
  return (
    <Modal title={`Deploy ${app.name} to Cluster`}>
      <div className="node-selector">
        {nodes?.map(node => (
          <Checkbox
            key={node.id}
            checked={selectedNodes.includes(node.id)}
            onChange={(e) => toggleNode(node.id, e.target.checked)}
            label={`${node.name} (${node.hostname})`}
          />
        ))}
      </div>
      
      <Button 
        onClick={() => deployMutation.mutate({ appId: app.id, nodeIds: selectedNodes })}
        disabled={selectedNodes.length === 0}
      >
        Deploy to {selectedNodes.length} nodes
      </Button>
    </Modal>
  );
}
```

## Migration

```csharp
public partial class AddClusterSupport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ClusterNodes",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                Description = table.Column<string>(nullable: true),
                Endpoint = table.Column<string>(maxLength: 500, nullable: false),
                AuthType = table.Column<int>(nullable: false),
                ApiKey = table.Column<string>(nullable: true),
                CertificateThumbprint = table.Column<string>(nullable: true),
                Status = table.Column<int>(nullable: false),
                LastHeartbeat = table.Column<DateTime>(nullable: true),
                LastError = table.Column<string>(nullable: true),
                Hostname = table.Column<string>(nullable: true),
                IpAddress = table.Column<string>(nullable: true),
                OS = table.Column<string>(nullable: true),
                AgentVersion = table.Column<string>(nullable: true),
                CpuCores = table.Column<int>(nullable: true),
                MemoryBytes = table.Column<long>(nullable: true),
                DiskBytes = table.Column<long>(nullable: true),
                Labels = table.Column<string>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ClusterNodes", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "NodeApps",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                NodeId = table.Column<Guid>(nullable: false),
                AppId = table.Column<Guid>(nullable: false),
                RemoteAppId = table.Column<Guid>(nullable: true),
                Status = table.Column<int>(nullable: false),
                LastSync = table.Column<DateTime>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_NodeApps", x => x.Id);
                table.ForeignKey("FK_NodeApps_Nodes", x => x.NodeId,
                    "ClusterNodes", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_NodeApps_Apps", x => x.AppId,
                    "Apps", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ImpersonationContexts",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                AllowedNodes = table.Column<string>(nullable: true),
                AllowedApps = table.Column<string>(nullable: true),
                Username = table.Column<string>(nullable: true),
                EncryptedPassword = table.Column<string>(nullable: true),
                SshKeyId = table.Column<string>(nullable: true),
                Domain = table.Column<string>(nullable: true),
                RunAsAdmin = table.Column<bool>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ImpersonationContexts", x => x.Id);
            });
    }
}
```

## Security Considerations

1. **mTLS** - Mutual TLS between control plane and agents
2. **API Keys** - Rotatable, scoped per node
3. **Encryption** - All credentials encrypted at rest
4. **Audit Logging** - All cluster operations logged
5. **RBAC** - Control who can manage which nodes

## Estimated Effort: 6-8 weeks

## Dependencies
- Feature 003 (Authentication) - for API keys
- Feature 005 (Reliability) - health checks
