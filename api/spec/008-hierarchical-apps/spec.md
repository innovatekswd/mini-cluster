# Feature 008: Hierarchical Apps & Grouping

## Overview

Transform MiniCluster from flat app lists to a **tree-based hierarchy** where:
- **Apps can contain other apps** (composite applications)
- **Services are processes** within an app
- **Groups organize** apps logically
- Operations cascade through the tree

---

## Business Value

| Problem | Current | Solution |
|---------|---------|----------|
| Microservices sprawl | Flat list of 50+ apps | Tree structure, nested apps |
| "Start the e-commerce system" | Start 10 apps manually | Start parent, children follow |
| Environment separation | Naming conventions | Groups with inheritance |
| Shared config | Copy-paste env vars | Inherit from parent |

---

## Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    HIERARCHY STRUCTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GROUP: "Production"                                            │
│  ├── APP: "E-Commerce Platform" (composite)                     │
│  │   ├── SERVICE: "API Gateway"         ← process               │
│  │   ├── SERVICE: "Product Service"     ← process               │
│  │   ├── APP: "Order System" (composite)                        │
│  │   │   ├── SERVICE: "Order API"                               │
│  │   │   ├── SERVICE: "Order Worker"                            │
│  │   │   └── SERVICE: "Order DB"                                │
│  │   └── APP: "Payment System"                                  │
│  │       ├── SERVICE: "Payment API"                             │
│  │       └── SERVICE: "Payment Worker"                          │
│  │                                                              │
│  └── APP: "Monitoring Stack"                                    │
│      ├── SERVICE: "Seq"                                         │
│      ├── SERVICE: "Grafana"                                     │
│      └── SERVICE: "Prometheus"                                  │
│                                                                  │
│  GROUP: "Development"                                           │
│  └── ...                                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Entities

```csharp
public class AppGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Color { get; set; }  // UI visual
    public int SortOrder { get; set; }
    
    // Hierarchy
    public Guid? ParentGroupId { get; set; }
    public AppGroup? ParentGroup { get; set; }
    public ICollection<AppGroup> ChildGroups { get; set; } = new List<AppGroup>();
    public ICollection<App> Apps { get; set; } = new List<App>();
    
    // Inherited settings
    public Dictionary<string, string> Variables { get; set; } = new();
    public RestartPolicy? DefaultRestartPolicy { get; set; }
}

public class App
{
    // Existing fields...
    
    // Hierarchy - NEW
    public Guid? ParentAppId { get; set; }
    public App? ParentApp { get; set; }
    public ICollection<App> ChildApps { get; set; } = new List<App>();
    
    // Grouping - NEW
    public Guid? GroupId { get; set; }
    public AppGroup? Group { get; set; }
    
    // Type
    public AppType Type { get; set; } = AppType.Process;
    
    // Services (processes) if composite
    public ICollection<AppService> Services { get; set; } = new List<AppService>();
}

public enum AppType
{
    Process = 0,     // Single process (leaf node)
    Composite = 1,   // Contains child apps/services
    Container = 2    // Docker container
}

public class AppService
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AppId { get; set; }
    public App App { get; set; } = null!;
    
    public string Name { get; set; } = "";
    public int Order { get; set; }
    
    // Process config
    public string Command { get; set; } = "";
    public string? Args { get; set; }
    public string? WorkingDirectory { get; set; }
    public Dictionary<string, string> Environment { get; set; } = new();
    
    // Runtime
    public ProcessStatus Status { get; set; }
    public int? ProcessId { get; set; }
}
```

## Cascade Operations

```csharp
public interface IAppTreeService
{
    // Start/Stop cascade through children
    Task StartTreeAsync(Guid appId, CancellationToken ct);
    Task StopTreeAsync(Guid appId, CancellationToken ct);
    
    // Get flattened list respecting order
    Task<List<App>> GetStartupOrderAsync(Guid appId, CancellationToken ct);
    
    // Variable inheritance
    Dictionary<string, string> ResolveVariables(App app);
}

public class AppTreeService : IAppTreeService
{
    public async Task StartTreeAsync(Guid appId, CancellationToken ct)
    {
        var app = await GetAppWithChildrenAsync(appId, ct);
        
        // Start services first (in order)
        foreach (var service in app.Services.OrderBy(s => s.Order))
        {
            await _processManager.StartServiceAsync(service, ct);
            if (service.HealthCheck != null)
                await WaitForHealthyAsync(service, ct);
        }
        
        // Then start child apps (respecting dependencies)
        var children = await GetStartupOrderAsync(appId, ct);
        foreach (var child in children)
        {
            await StartTreeAsync(child.Id, ct);
        }
    }
    
    public Dictionary<string, string> ResolveVariables(App app)
    {
        var vars = new Dictionary<string, string>();
        
        // Group variables (inherited)
        if (app.Group != null)
            MergeVariables(vars, GetGroupVariables(app.Group));
        
        // Parent app variables
        if (app.ParentApp != null)
            MergeVariables(vars, ResolveVariables(app.ParentApp));
        
        // Own variables (highest priority)
        MergeVariables(vars, app.Variables);
        
        return vars;
    }
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Groups** |||
| GET | `/api/groups` | List all groups (tree) |
| POST | `/api/groups` | Create group |
| PUT | `/api/groups/{id}` | Update group |
| DELETE | `/api/groups/{id}` | Delete group |
| POST | `/api/groups/{id}/move` | Move group in tree |
| **Tree Operations** |||
| GET | `/api/apps/{id}/tree` | Get app with children |
| POST | `/api/apps/{id}/tree/start` | Start app and all children |
| POST | `/api/apps/{id}/tree/stop` | Stop app and all children |
| POST | `/api/apps/{id}/move` | Move app to group/parent |
| **Services** |||
| GET | `/api/apps/{id}/services` | List services |
| POST | `/api/apps/{id}/services` | Add service |
| PUT | `/api/services/{id}` | Update service |
| DELETE | `/api/services/{id}` | Delete service |
| POST | `/api/services/{id}/start` | Start single service |

## UI: Tree View

```tsx
function AppTree() {
  const { data: tree } = useAppTree();
  
  return (
    <TreeView>
      {tree.groups.map(group => (
        <GroupNode key={group.id} group={group}>
          {group.apps.map(app => (
            <AppNode key={app.id} app={app} />
          ))}
        </GroupNode>
      ))}
    </TreeView>
  );
}

function AppNode({ app }: { app: App }) {
  return (
    <TreeItem 
      icon={app.type === 'composite' ? <FolderIcon /> : <ProcessIcon />}
      label={app.name}
      status={app.status}
      actions={<AppActions app={app} />}
    >
      {app.services?.map(svc => (
        <ServiceNode key={svc.id} service={svc} />
      ))}
      {app.childApps?.map(child => (
        <AppNode key={child.id} app={child} />
      ))}
    </TreeItem>
  );
}
```

## Migration

```csharp
public partial class AddHierarchicalApps : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AppGroups",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                Description = table.Column<string>(nullable: true),
                Color = table.Column<string>(maxLength: 20, nullable: true),
                SortOrder = table.Column<int>(nullable: false, defaultValue: 0),
                ParentGroupId = table.Column<Guid>(nullable: true),
                Variables = table.Column<string>(nullable: true),
                DefaultRestartPolicy = table.Column<int>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppGroups", x => x.Id);
                table.ForeignKey("FK_AppGroups_Parent", x => x.ParentGroupId,
                    "AppGroups", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.AddColumn<Guid>("ParentAppId", "Apps", nullable: true);
        migrationBuilder.AddColumn<Guid>("GroupId", "Apps", nullable: true);
        migrationBuilder.AddColumn<int>("Type", "Apps", nullable: false, defaultValue: 0);

        migrationBuilder.CreateTable(
            name: "AppServices",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                AppId = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                Order = table.Column<int>(nullable: false, defaultValue: 0),
                Command = table.Column<string>(nullable: false),
                Args = table.Column<string>(nullable: true),
                WorkingDirectory = table.Column<string>(nullable: true),
                Environment = table.Column<string>(nullable: true),
                Status = table.Column<int>(nullable: false, defaultValue: 0),
                ProcessId = table.Column<int>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppServices", x => x.Id);
                table.ForeignKey("FK_AppServices_Apps", x => x.AppId,
                    "Apps", "Id", onDelete: ReferentialAction.Cascade);
            });
    }
}
```

## Estimated Effort: 3-4 weeks
