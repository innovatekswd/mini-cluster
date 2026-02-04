# Feature 009: Service-Level Versioning

## Overview

Extend versioning from app-level to **service-level**, enabling:
- Version individual services independently
- Rollback single services without affecting others
- Track service history within composite apps
- Atomic app versioning (all services together)

---

## Business Value

| Problem | Solution |
|---------|----------|
| "Only the worker broke" | Rollback just the worker service |
| "Which service changed?" | Service-level version tracking |
| "Coordinated release" | App version = snapshot of all service versions |
| "A/B test one service" | Blue-green per service |

---

## Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                  VERSIONING HIERARCHY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APP VERSION v2.0.0 (snapshot)                                  │
│  ├── api-service: v1.5.0                                        │
│  ├── worker-service: v2.1.0  ← updated                          │
│  └── db-service: v1.0.0                                         │
│                                                                  │
│  APP VERSION v1.9.0                                             │
│  ├── api-service: v1.5.0                                        │
│  ├── worker-service: v2.0.0                                     │
│  └── db-service: v1.0.0                                         │
│                                                                  │
│  SERVICE VERSIONS (worker-service)                              │
│  ├── v2.1.0 ← current (in app v2.0.0)                          │
│  ├── v2.0.0 (in app v1.9.0)                                     │
│  ├── v1.9.0                                                     │
│  └── v1.8.0                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Entities

```csharp
public class ServiceVersion
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public AppService Service { get; set; } = null!;
    
    public string Version { get; set; } = "";
    public int SequenceNumber { get; set; }
    
    // Config snapshot
    public string ConfigSnapshot { get; set; } = "";  // JSON
    public string? ConfigDiff { get; set; }
    
    // Source
    public VersionSource Source { get; set; }
    public string? GitCommit { get; set; }
    
    // Status
    public DeploymentStatus Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeployedAt { get; set; }
    public Guid? DeployedBy { get; set; }
}

// Link app version to service versions (snapshot)
public class AppVersionServiceSnapshot
{
    public int Id { get; set; }
    public int AppVersionId { get; set; }
    public AppVersion AppVersion { get; set; } = null!;
    
    public Guid ServiceId { get; set; }
    public int ServiceVersionId { get; set; }
    public ServiceVersion ServiceVersion { get; set; } = null!;
}
```

## Service Deployment Service

```csharp
public interface IServiceVersioningService
{
    // Service versions
    Task<ServiceVersion> CreateServiceVersionAsync(Guid serviceId, CreateVersionDto dto, CancellationToken ct);
    Task<List<ServiceVersion>> GetServiceVersionsAsync(Guid serviceId, int limit, CancellationToken ct);
    
    // Deploy service version (independent)
    Task<DeploymentResult> DeployServiceVersionAsync(int versionId, CancellationToken ct);
    Task<DeploymentResult> RollbackServiceAsync(Guid serviceId, int? targetVersionId, CancellationToken ct);
    
    // App-level (atomic snapshot)
    Task<AppVersion> CreateAppSnapshotAsync(Guid appId, string version, CancellationToken ct);
    Task<DeploymentResult> DeployAppVersionAsync(int appVersionId, CancellationToken ct);
    Task<DeploymentResult> RollbackAppAsync(Guid appId, int? targetVersionId, CancellationToken ct);
}

public class ServiceVersioningService : IServiceVersioningService
{
    public async Task<AppVersion> CreateAppSnapshotAsync(Guid appId, string version, CancellationToken ct)
    {
        var app = await _db.Apps
            .Include(a => a.Services)
            .ThenInclude(s => s.Versions.OrderByDescending(v => v.SequenceNumber).Take(1))
            .FirstOrDefaultAsync(a => a.Id == appId, ct);
        
        // Create app version
        var appVersion = new AppVersion
        {
            AppId = appId,
            Version = version,
            ConfigSnapshot = SerializeAppConfig(app)
        };
        _db.AppVersions.Add(appVersion);
        
        // Link current service versions
        foreach (var service in app.Services)
        {
            var currentSvcVersion = service.Versions.First();
            _db.AppVersionServiceSnapshots.Add(new AppVersionServiceSnapshot
            {
                AppVersion = appVersion,
                ServiceId = service.Id,
                ServiceVersionId = currentSvcVersion.Id
            });
        }
        
        await _db.SaveChangesAsync(ct);
        return appVersion;
    }
    
    public async Task<DeploymentResult> RollbackServiceAsync(
        Guid serviceId, int? targetVersionId, CancellationToken ct)
    {
        var service = await _db.AppServices
            .Include(s => s.App)
            .FirstOrDefaultAsync(s => s.Id == serviceId, ct);
        
        // Find target version
        ServiceVersion target;
        if (targetVersionId.HasValue)
        {
            target = await _db.ServiceVersions.FindAsync(targetVersionId.Value);
        }
        else
        {
            target = await _db.ServiceVersions
                .Where(v => v.ServiceId == serviceId && 
                           v.Status != DeploymentStatus.Active)
                .OrderByDescending(v => v.SequenceNumber)
                .FirstOrDefaultAsync(ct);
        }
        
        // Apply config from version
        ApplyServiceConfig(service, target);
        
        // Restart only this service
        await _processManager.RestartServiceAsync(service, ct);
        
        target.Status = DeploymentStatus.Active;
        target.DeployedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        
        return new DeploymentResult { Success = true };
    }
    
    public async Task<DeploymentResult> RollbackAppAsync(
        Guid appId, int? targetVersionId, CancellationToken ct)
    {
        var appVersion = targetVersionId.HasValue
            ? await _db.AppVersions.FindAsync(targetVersionId.Value)
            : await _db.AppVersions
                .Where(v => v.AppId == appId && v.DeploymentStatus != DeploymentStatus.Active)
                .OrderByDescending(v => v.SequenceNumber)
                .FirstOrDefaultAsync(ct);
        
        // Get service versions from snapshot
        var snapshots = await _db.AppVersionServiceSnapshots
            .Include(s => s.ServiceVersion)
            .Where(s => s.AppVersionId == appVersion.Id)
            .ToListAsync(ct);
        
        // Rollback each service to its snapshot version
        foreach (var snapshot in snapshots)
        {
            var service = await _db.AppServices.FindAsync(snapshot.ServiceId);
            ApplyServiceConfig(service, snapshot.ServiceVersion);
        }
        
        // Restart all services
        await _appTreeService.StopTreeAsync(appId, ct);
        await _appTreeService.StartTreeAsync(appId, ct);
        
        return new DeploymentResult { Success = true };
    }
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Service Versions** |||
| GET | `/api/services/{id}/versions` | List service versions |
| POST | `/api/services/{id}/versions` | Create service version |
| POST | `/api/service-versions/{id}/deploy` | Deploy service version |
| POST | `/api/services/{id}/rollback` | Rollback service |
| **App Snapshots** |||
| POST | `/api/apps/{id}/snapshot` | Create app snapshot |
| GET | `/api/apps/{id}/snapshots` | List app snapshots |
| GET | `/api/app-versions/{id}/services` | Get service versions in snapshot |
| POST | `/api/app-versions/{id}/deploy` | Deploy full app snapshot |
| POST | `/api/apps/{id}/rollback` | Rollback entire app |

## UI Components

```tsx
function ServiceVersionPanel({ service }: { service: AppService }) {
  const { data: versions } = useServiceVersions(service.id);
  const rollbackMutation = useRollbackService();
  
  return (
    <Panel title={`${service.name} Versions`}>
      <VersionTimeline>
        {versions?.map(v => (
          <VersionItem 
            key={v.id}
            version={v}
            isCurrent={v.status === 'active'}
            onRollback={() => rollbackMutation.mutate({ 
              serviceId: service.id, 
              versionId: v.id 
            })}
          />
        ))}
      </VersionTimeline>
    </Panel>
  );
}

function AppSnapshotView({ appId }: { appId: string }) {
  const { data: snapshots } = useAppSnapshots(appId);
  
  return (
    <div>
      <h3>App Snapshots</h3>
      {snapshots?.map(snapshot => (
        <SnapshotCard key={snapshot.id} snapshot={snapshot}>
          <h4>Service Versions</h4>
          {snapshot.serviceVersions.map(sv => (
            <div key={sv.serviceId}>
              {sv.serviceName}: {sv.version}
            </div>
          ))}
          <Button onClick={() => deploySnapshot(snapshot.id)}>
            Deploy This Snapshot
          </Button>
        </SnapshotCard>
      ))}
    </div>
  );
}
```

## Migration

```csharp
public partial class AddServiceVersioning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ServiceVersions",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                ServiceId = table.Column<Guid>(nullable: false),
                Version = table.Column<string>(maxLength: 100, nullable: false),
                SequenceNumber = table.Column<int>(nullable: false),
                ConfigSnapshot = table.Column<string>(nullable: false),
                ConfigDiff = table.Column<string>(nullable: true),
                Source = table.Column<int>(nullable: false),
                GitCommit = table.Column<string>(maxLength: 40, nullable: true),
                Status = table.Column<int>(nullable: false),
                CreatedAt = table.Column<DateTime>(nullable: false),
                DeployedAt = table.Column<DateTime>(nullable: true),
                DeployedBy = table.Column<Guid>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ServiceVersions", x => x.Id);
                table.ForeignKey("FK_ServiceVersions_Services", x => x.ServiceId,
                    "AppServices", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "AppVersionServiceSnapshots",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppVersionId = table.Column<int>(nullable: false),
                ServiceId = table.Column<Guid>(nullable: false),
                ServiceVersionId = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppVersionServiceSnapshots", x => x.Id);
                table.ForeignKey("FK_Snapshots_AppVersions", x => x.AppVersionId,
                    "AppVersions", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_Snapshots_ServiceVersions", x => x.ServiceVersionId,
                    "ServiceVersions", "Id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            "IX_ServiceVersions_ServiceId",
            "ServiceVersions",
            "ServiceId");
    }
}
```

## Estimated Effort: 2-3 weeks

## Dependencies
- Feature 007 (App Versioning)
- Feature 008 (Hierarchical Apps)
