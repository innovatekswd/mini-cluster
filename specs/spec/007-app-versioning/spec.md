# Feature 007: Service Versioning & Deployment

> **Renamed from "App Versioning"** — we version `Service` configs, not `App` groups.

## Overview

Track service configuration history, enable rollbacks to previous versions, and support deployment strategies. Every time a service's config changes (command, args, env vars, working directory), a version is created. Users can rollback any service to a previous config.

**Entity Model:** `ServiceVersion` stores config snapshots for each `Service`. `DeploymentConfig` stores per-service deployment preferences. Git integration and blue-green/canary are Phase 2+ enhancements.

---

## Business Value

| Problem | Impact | Solution |
|---------|--------|----------|
| "What changed?" | Hours debugging | Version history with diffs |
| "Rollback needed!" | Downtime | One-click rollback |
| No audit trail | Compliance issues | Full deployment history |
| Manual deployments | Human error | Git-triggered deploys (Phase 2) |

---

## Data Model

> **Alignment with codebase:**
> - `Service` (table: `ControlledApps`) = runnable process — gets versioned
> - `App` (table: `Apps`) = grouping — **unchanged**, but can snapshot all service versions
> - `ServiceVersion` = new entity linked to `Service.Id`

### ServiceVersion Entity

```csharp
public class ServiceVersion
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public Service Service { get; set; } = null!;

    // Version identification
    public string Version { get; set; } = "";
    public int SequenceNumber { get; set; }
    public string? Label { get; set; }

    // Configuration snapshot — JSON of versioned Service fields
    public string ConfigSnapshot { get; set; } = "";
    public string? ConfigDiff { get; set; }

    // Source
    public VersionSource Source { get; set; } = VersionSource.Manual;
    public string? GitCommit { get; set; }
    public string? GitBranch { get; set; }
    public string? GitMessage { get; set; }

    // Deployment history
    public DeploymentStatus DeploymentStatus { get; set; } = DeploymentStatus.Pending;
    public DateTime? DeployedAt { get; set; }
    public DateTime? RolledBackAt { get; set; }
    public string? DeploymentNotes { get; set; }

    // Audit
    public Guid? DeployedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum VersionSource
{
    Manual = 0,
    ConfigChange = 1,    // Auto-created on config save
    GitPush = 2,
    GitTag = 3,
    Api = 4,
    Rollback = 5
}

public enum DeploymentStatus
{
    Pending = 0,
    Deploying = 1,
    Active = 2,
    RolledBack = 3,
    Failed = 4,
    Superseded = 5
}
```

### Config Snapshot Contents

The `ConfigSnapshot` JSON includes these `Service` fields:

```json
{
  "executablePath": "/usr/bin/node",
  "arguments": "app.js",
  "workingDirectory": "/opt/myapp",
  "environmentVariables": { "NODE_ENV": "production", "PORT": "3000" },
  "accessLink": "http://localhost:3000",
  "autoStart": true,
  "useShellExecute": false,
  "createNoWindow": true,
  "captureOutput": 1,
  "restartPolicy": 2,
  "maxRestarts": 5,
  "healthCheckType": 1,
  "healthCheckTarget": "http://localhost:3000/health"
}
```

### DeploymentConfig (per-service preferences)

```csharp
public class DeploymentConfig
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }

    public DeploymentStrategy Strategy { get; set; } = DeploymentStrategy.Immediate;
    public bool AutoRollbackOnFailure { get; set; } = true;
    public int RollbackTimeoutSeconds { get; set; } = 300;
    public bool WaitForHealthy { get; set; } = true;
    public int HealthCheckTimeoutSeconds { get; set; } = 120;
    public int MaxVersionsToKeep { get; set; } = 10;
    public bool AutoVersionOnSave { get; set; } = true;
}

public enum DeploymentStrategy
{
    Immediate = 0,       // Stop old, start new
    BlueGreen = 1,       // Phase 2: run both, switch traffic
    Canary = 2           // Phase 2+: gradual traffic shift
}
```

### App-Level Snapshots

An `AppSnapshot` captures the current version of every service in an app at a point in time:

```csharp
public class AppSnapshot
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    public App App { get; set; } = null!;

    public string Version { get; set; } = "";
    public string? Label { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }

    public ICollection<AppSnapshotEntry> Entries { get; set; } = new List<AppSnapshotEntry>();
}

public class AppSnapshotEntry
{
    public int Id { get; set; }
    public int AppSnapshotId { get; set; }
    public Guid ServiceId { get; set; }
    public int ServiceVersionId { get; set; }
    public ServiceVersion ServiceVersion { get; set; } = null!;
}
```

---

## Service Versioning Service

```csharp
public interface IServiceVersioningService
{
    // Service versions
    Task<ServiceVersion> CreateVersionAsync(Guid serviceId, CreateVersionDto dto, CancellationToken ct);
    Task<List<ServiceVersion>> GetVersionsAsync(Guid serviceId, int limit, CancellationToken ct);
    Task<ServiceVersion?> GetVersionAsync(int versionId, CancellationToken ct);
    Task<string> GetVersionDiffAsync(int versionId, int? compareToId, CancellationToken ct);

    // Deploy / rollback
    Task<DeploymentResult> DeployVersionAsync(int versionId, CancellationToken ct);
    Task<DeploymentResult> RollbackAsync(Guid serviceId, int? targetVersionId, CancellationToken ct);

    // App-level snapshots
    Task<AppSnapshot> CreateAppSnapshotAsync(Guid appId, string version, CancellationToken ct);
    Task<List<AppSnapshot>> GetAppSnapshotsAsync(Guid appId, int limit, CancellationToken ct);
    Task<DeploymentResult> DeployAppSnapshotAsync(int snapshotId, CancellationToken ct);
}
```

---

## API Endpoints

### Service Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services/{id}/versions` | List version history |
| POST | `/api/services/{id}/versions` | Create version manually |
| GET | `/api/service-versions/{id}` | Get version details |
| GET | `/api/service-versions/{id}/diff` | Get diff from previous |
| POST | `/api/service-versions/{id}/deploy` | Deploy a version |
| POST | `/api/services/{id}/rollback` | Rollback to previous |

### App Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/apps/{appId}/snapshots` | Create app snapshot |
| GET | `/api/apps/{appId}/snapshots` | List app snapshots |
| GET | `/api/app-snapshots/{id}` | Get snapshot with service versions |
| POST | `/api/app-snapshots/{id}/deploy` | Deploy full snapshot |

### DTOs

```csharp
public class CreateVersionDto
{
    public string? Version { get; set; }        // Auto-generated if null
    public string? Label { get; set; }
    public VersionSource Source { get; set; } = VersionSource.Manual;
    public string? GitCommit { get; set; }
    public string? Notes { get; set; }
}

public class ServiceVersionResponseDto
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public string Version { get; set; } = "";
    public int SequenceNumber { get; set; }
    public string? Label { get; set; }
    public VersionSource Source { get; set; }
    public DeploymentStatus DeploymentStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeployedAt { get; set; }
    public string? GitCommit { get; set; }
    public string? ConfigDiff { get; set; }
}

public class DeploymentResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? PreviousVersion { get; set; }
    public string? NewVersion { get; set; }
}
```

---

## Database Migration

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
                Label = table.Column<string>(maxLength: 200, nullable: true),
                ConfigSnapshot = table.Column<string>(nullable: false),
                ConfigDiff = table.Column<string>(nullable: true),
                Source = table.Column<int>(nullable: false),
                GitCommit = table.Column<string>(maxLength: 40, nullable: true),
                GitBranch = table.Column<string>(maxLength: 200, nullable: true),
                GitMessage = table.Column<string>(nullable: true),
                DeploymentStatus = table.Column<int>(nullable: false),
                DeployedAt = table.Column<DateTime>(nullable: true),
                RolledBackAt = table.Column<DateTime>(nullable: true),
                DeploymentNotes = table.Column<string>(nullable: true),
                DeployedBy = table.Column<Guid>(nullable: true),
                CreatedAt = table.Column<DateTime>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ServiceVersions", x => x.Id);
                table.ForeignKey("FK_ServiceVersions_Services",
                    x => x.ServiceId, "ControlledApps", "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "DeploymentConfigs",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                ServiceId = table.Column<Guid>(nullable: false),
                Strategy = table.Column<int>(nullable: false, defaultValue: 0),
                AutoRollbackOnFailure = table.Column<bool>(nullable: false, defaultValue: true),
                RollbackTimeoutSeconds = table.Column<int>(nullable: false, defaultValue: 300),
                WaitForHealthy = table.Column<bool>(nullable: false, defaultValue: true),
                HealthCheckTimeoutSeconds = table.Column<int>(nullable: false, defaultValue: 120),
                MaxVersionsToKeep = table.Column<int>(nullable: false, defaultValue: 10),
                AutoVersionOnSave = table.Column<bool>(nullable: false, defaultValue: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DeploymentConfigs", x => x.Id);
                table.ForeignKey("FK_DeploymentConfigs_Services",
                    x => x.ServiceId, "ControlledApps", "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "AppSnapshots",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
                Version = table.Column<string>(maxLength: 100, nullable: false),
                Label = table.Column<string>(maxLength: 200, nullable: true),
                CreatedAt = table.Column<DateTime>(nullable: false),
                CreatedBy = table.Column<Guid>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppSnapshots", x => x.Id);
                table.ForeignKey("FK_AppSnapshots_Apps",
                    x => x.AppId, "Apps", "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "AppSnapshotEntries",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppSnapshotId = table.Column<int>(nullable: false),
                ServiceId = table.Column<Guid>(nullable: false),
                ServiceVersionId = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppSnapshotEntries", x => x.Id);
                table.ForeignKey("FK_Entries_Snapshots",
                    x => x.AppSnapshotId, "AppSnapshots", "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_Entries_ServiceVersions",
                    x => x.ServiceVersionId, "ServiceVersions", "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            "IX_ServiceVersions_ServiceId_Seq",
            "ServiceVersions", new[] { "ServiceId", "SequenceNumber" });
    }
}
```

---

## Implementation Phases

### Phase 1: Version History & Rollback (2-3 weeks)
- [ ] `ServiceVersion` entity and migration
- [ ] Auto-version on service config save
- [ ] Version list/detail API
- [ ] Config snapshot serialization + JSON diff
- [ ] Immediate rollback (stop → apply old config → start)
- [ ] UI: Version history list per service
- [ ] UI: Diff viewer
- [ ] UI: Rollback button

### Phase 2: App Snapshots (1 week)
- [ ] `AppSnapshot` + `AppSnapshotEntry` entities and migration
- [ ] Create snapshot API (captures all service versions in an app)
- [ ] Deploy snapshot API (rollback all services to snapshot state)
- [ ] UI: Snapshot list per app

### Phase 3: Git Integration (2 weeks) — future
- [ ] `GitIntegration` entity
- [ ] GitHub/GitLab webhook handlers
- [ ] Deploy on push/tag triggers
- [ ] UI: Git integration setup

### Phase 4: Blue-Green / Canary (2 weeks) — future
- [ ] `DeploymentSlot` entity
- [ ] Blue-green deployment logic
- [ ] Traffic switching via reverse proxy

---

## Estimated Effort: 3-4 weeks (Phase 1+2)

## Dependencies

- Feature 005 (health checks) — ✅ Done (for health-based rollback decisions)
- Feature 003 (authentication) — ✅ Done (for audit trail via `DeployedBy`)

## Notes

- We version `Service` configs, not `App` groups
- `App` is only involved via snapshots (capturing all service versions at a point in time)
- Blue-green and canary are Phase 3+ — requires reverse proxy integration
- Old spec 009 (Service-Level Versioning) is **merged into this spec** — there is no separate app-vs-service versioning distinction
