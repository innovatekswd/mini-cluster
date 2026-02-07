# Feature 008: Hierarchical Apps (Nested App Groups)

> **Simplified** — uses existing `ServiceGroup` for tag hierarchy, adds `ParentAppId` to `App` for nested apps.

## Overview

Allow apps to be nested inside other apps, creating a tree structure. A "parent app" contains child apps, each with their own services. This enables modeling complex deployments like microservice stacks (e.g., an "E-Commerce" parent app containing "Frontend", "API", "Database" child apps).

**Key principle:** No new entities for grouping — we use existing `App` (flat group) and `ServiceGroup` (tag hierarchy). This feature only adds `ParentAppId` to `App` to enable nesting.

---

## What Already Exists (No Changes Needed)

| Entity | Purpose | Status |
|--------|---------|--------|
| `App` | Flat grouping container for services | ✅ Exists |
| `Service` | Runnable process (table: `ControlledApps`) | ✅ Exists |
| `ServiceGroup` | Hierarchical tagging (already has `ParentGroupId`) | ✅ Exists |
| `ServiceGroupAssignment` | Many-to-many join (Service ↔ ServiceGroup) | ✅ Exists |
| `GroupVariable` | Inherited variables at group level | ✅ Exists |

---

## Data Model Changes

### Only Change: Add `ParentAppId` to `App`

```csharp
// In existing App.cs — add these two properties:
public Guid? ParentAppId { get; set; }
public App? ParentApp { get; set; }
public ICollection<App> ChildApps { get; set; } = new List<App>();
```

This creates an `App` tree:
```
E-Commerce (App, ParentAppId = null)
├── Frontend (App, ParentAppId = E-Commerce.Id)
│   ├── React-App (Service)
│   └── CDN-Proxy (Service)
├── API (App, ParentAppId = E-Commerce.Id)
│   ├── REST-Server (Service)
│   └── GraphQL-Server (Service)
└── Database (App, ParentAppId = E-Commerce.Id)
    ├── PostgreSQL (Service)
    └── Redis (Service)
```

---

## App Tree Service

```csharp
public interface IAppTreeService
{
    // Tree queries
    Task<List<AppTreeNodeDto>> GetAppTreeAsync(CancellationToken ct);
    Task<AppTreeNodeDto?> GetAppSubtreeAsync(Guid appId, CancellationToken ct);
    Task<List<App>> GetRootAppsAsync(CancellationToken ct);
    Task<List<App>> GetChildAppsAsync(Guid parentAppId, CancellationToken ct);
    Task<List<Guid>> GetAncestorIdsAsync(Guid appId, CancellationToken ct);

    // Tree mutations
    Task MoveAppAsync(Guid appId, Guid? newParentAppId, CancellationToken ct);
    Task ReorderChildrenAsync(Guid parentAppId, List<Guid> orderedChildIds, CancellationToken ct);

    // Cascade operations
    Task StartAppTreeAsync(Guid appId, CancellationToken ct);
    Task StopAppTreeAsync(Guid appId, CancellationToken ct);
    Task RestartAppTreeAsync(Guid appId, CancellationToken ct);
}
```

---

## DTOs

```csharp
public class AppTreeNodeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Slug { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public Guid? ParentAppId { get; set; }
    public int SortOrder { get; set; }

    // Aggregated from all services in this app (and children)
    public int TotalServices { get; set; }
    public int RunningServices { get; set; }
    public int StoppedServices { get; set; }
    public int ErrorServices { get; set; }

    public List<ServiceSummaryDto> Services { get; set; } = new();
    public List<AppTreeNodeDto> Children { get; set; } = new();
}

public class ServiceSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Status { get; set; } = "";
}

public class MoveAppDto
{
    public Guid? NewParentAppId { get; set; }
}

public class ReorderChildrenDto
{
    public List<Guid> OrderedChildIds { get; set; } = new();
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/tree` | Full app tree (root apps with nested children) |
| GET | `/api/apps/{id}/subtree` | Subtree for one app |
| GET | `/api/apps/{id}/children` | Direct children only |
| PUT | `/api/apps/{id}/move` | Move app to new parent |
| PUT | `/api/apps/{id}/children/reorder` | Reorder children |
| POST | `/api/apps/{id}/tree/start` | Start all services in app tree |
| POST | `/api/apps/{id}/tree/stop` | Stop all services in app tree |
| POST | `/api/apps/{id}/tree/restart` | Restart all services in app tree |

---

## Database Migration

```csharp
public partial class AddHierarchicalApps : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "ParentAppId",
            table: "Apps",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Apps_ParentAppId",
            table: "Apps",
            column: "ParentAppId");

        migrationBuilder.AddForeignKey(
            name: "FK_Apps_Apps_ParentAppId",
            table: "Apps",
            column: "ParentAppId",
            principalTable: "Apps",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }
}
```

---

## Cascade Logic

### Start Tree
1. Collect all apps in subtree (BFS/DFS)
2. Collect all services from those apps
3. Start in dependency order: deepest children first (leaves → root)

### Stop Tree
1. Collect all apps in subtree
2. Stop in reverse order: root → leaves (parent stops last)

### Cycle Detection
Before moving an app, ensure the target parent is not a descendant of the app being moved:
```csharp
var ancestors = await GetAncestorIdsAsync(newParentId);
if (ancestors.Contains(appId))
    throw new InvalidOperationException("Cannot move app into its own subtree");
```

---

## UI Components

### Tree View
- Collapsible tree sidebar showing app hierarchy
- Each node shows: icon, name, service count badge, status indicator
- Drag-and-drop to rearrange (calls move/reorder endpoints)

### Breadcrumb Navigation
- When viewing a nested app: `E-Commerce > API > REST-Server`
- Click any segment to navigate up

---

## Implementation Phases

### Phase 1: Core Hierarchy (1-2 weeks)
- [ ] Add `ParentAppId` column + migration
- [ ] `IAppTreeService` implementation
- [ ] Tree query endpoints (GET tree, subtree, children)
- [ ] Move + reorder endpoints
- [ ] Cycle detection

### Phase 2: Cascade Operations (1 week)
- [ ] Cascade start/stop/restart
- [ ] DFS ordering for start (leaves first) and stop (root first)
- [ ] SignalR notifications for tree status changes

### Phase 3: UI (1 week)
- [ ] Tree view sidebar component
- [ ] Breadcrumb navigation
- [ ] Drag-and-drop reordering
- [ ] Bulk status indicators

---

## Estimated Effort: 3-4 weeks

## Dependencies

- Feature 021 (Simple App Tabs) — ✅ Done (apps already exist as groups)

## Notes

- `ServiceGroup` is NOT affected — it remains a separate tagging/grouping system (many-to-many with services, variable inheritance). It serves a different purpose than app hierarchy.
- No new `AppGroup` or `AppService` entities — those were removed as they duplicated existing entities.
- `ParentAppId` uses `ReferentialAction.Restrict` to prevent cascade-deleting child apps when a parent is deleted. Users must reassign or delete children first.
