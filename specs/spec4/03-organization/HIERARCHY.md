# Application Hierarchy & Organization

> **Version:** 2.0  
> **Status:** 🔶 Partially Implemented (App Tabs done, Hierarchy WIP)  
> **Priority:** MEDIUM-HIGH  
> **Effort:** 2 weeks remaining

---

## Overview

MiniCluster supports flexible application organization through a hierarchical structure with tabs as the primary grouping mechanism and smart filtering capabilities.

---

## Concepts

### Hierarchy Levels

```
Cluster                           # Optional: Future multi-cluster support
  └─ App                          # Top-level application container
       └─ Tab                     # Visual grouping (tabs UI)
            └─ Service            # Actual running process
            └─ Static File        # Optional web content
```

### Entity Relationships

```
┌─────────────────────────────────────────────────────────┐
│  App (minicluster-stack)                                │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Tab: "API"  │  │ Tab: "Jobs" │  │ Tab: "UI"   │     │
│  │             │  │             │  │             │     │
│  │ • api       │  │ • worker-1  │  │ • web-ui    │     │
│  │ • gateway   │  │ • worker-2  │  │ • admin     │     │
│  │             │  │ • scheduler │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Current Implementation (✅)

### App Tabs

Tabs provide visual organization within an app on the dashboard.

```csharp
// AppTab Entity
public AppTab
{
    Guid Id
    Guid AppId
    string Name              // "Backend Services"
    int Order               // Tab display order
    string? Icon            // Optional lucide icon
    string? Description     // Optional tab description
}

// Service belongs to tab
public Service
{
    Guid? AppTabId          // null = default tab
    // ... other properties
}
```

### Implemented UI
- Tab bar within app card
- Tab creation via inline form
- Tab reordering (drag & drop)
- Services grouped by tab
- "All Services" default view

### API Endpoints (Existing)
```
GET    /api/apps/{appId}/tabs
POST   /api/apps/{appId}/tabs
PUT    /api/apps/{appId}/tabs/{id}
DELETE /api/apps/{appId}/tabs/{id}
PUT    /api/apps/{appId}/tabs/order     # Bulk update order
```

---

## Planned: Enhanced Organization

### 1. Smart Filters (📋 Phase 1)

Predefined and custom filters that work across the hierarchy.

#### Built-in Filters
```json
{
  "filters": [
    { "id": "all", "name": "All Services", "query": {} },
    { "id": "running", "name": "Running", "query": { "status": "running" } },
    { "id": "stopped", "name": "Stopped", "query": { "status": "stopped" } },
    { "id": "errors", "name": "Has Errors", "query": { "hasErrors": true } },
    { "id": "recent", "name": "Recently Changed", "query": { "changedInLast": "1h" } }
  ]
}
```

#### Custom Filters (User-Defined)
```json
{
  "customFilters": [
    {
      "id": "prod-apis",
      "name": "Production APIs",
      "query": {
        "tags": ["production"],
        "type": "api",
        "app.environment": "prod"
      },
      "icon": "server",
      "color": "blue"
    }
  ]
}
```

#### Filter UI
- Filter sidebar (collapsible)
- Active filter badge
- Filter combination (AND)
- Save filter as preset
- URL reflects active filter

---

### 2. Tags & Labels (📋 Phase 1)

Flexible tagging for cross-cutting organization.

```csharp
public class Tag
{
    public Guid Id { get; set; }
    public string Name { get; set; }          // "production", "critical"
    public string Color { get; set; }         // "#ef4444"
    public string? Icon { get; set; }         // Optional lucide icon
}

public class ServiceTag
{
    public Guid ServiceId { get; set; }
    public Guid TagId { get; set; }
}
```

#### Auto-Tags
System-generated tags based on conventions:
```yaml
autoTags:
  - pattern: "*-api"
    tag: "api"
  - pattern: "*-worker"
    tag: "background"
  - pattern: "*-prod-*"
    tag: "production"
```

---

### 3. Service Grouping Modes (📋 Phase 2)

Multiple ways to view services in the dashboard.

| Mode | Description | Use Case |
|------|-------------|----------|
| **By App** | Current default | Overview of application stacks |
| **By Tab** | Group by tab across apps | Focus on functional areas |
| **By Tag** | Group by tags | Cross-cutting views |
| **By Status** | Running/Stopped/Error | Operations monitoring |
| **Flat** | All services ungrouped | Search & filter |

#### Mode Selector UI
```
[ 🗂️ Apps ] [ 📑 Tabs ] [ 🏷️ Tags ] [ 📊 Status ] [ 📋 Flat ]
```

---

### 4. Favorites & Pinned (📋 Phase 2)

Quick access to frequently used items.

```csharp
public class UserFavorite
{
    public Guid UserId { get; set; }
    public string EntityType { get; set; }    // "app", "service", "filter"
    public Guid EntityId { get; set; }
    public int Order { get; set; }
}
```

#### UI Features
- Star icon on hover
- Favorites sidebar section
- Pin to dashboard (widgets)
- Recently accessed list

---

### 5. Dashboard Layouts (💡 Future)

Customizable dashboard configurations.

```json
{
  "layouts": [
    {
      "id": "default",
      "name": "Standard View",
      "grid": [
        { "type": "appList", "position": "main", "filter": {} },
        { "type": "metrics", "position": "sidebar" }
      ]
    },
    {
      "id": "ops",
      "name": "Operations View",
      "grid": [
        { "type": "statusOverview", "position": "top" },
        { "type": "alertList", "position": "main" },
        { "type": "recentLogs", "position": "sidebar" }
      ]
    }
  ]
}
```

---

## Service Properties for Filtering

### Current Properties
```csharp
// Filterable fields
service.Status           // "running", "stopped", "error"
service.AppId            // Parent app
service.AppTabId         // Parent tab
service.Type             // "executable", "dotnet", etc.
service.CreatedAt        // Timestamp
service.UpdatedAt        // Timestamp
```

### Extended Properties (Planned)
```csharp
service.Tags[]           // User-defined tags
service.Environment      // "dev", "prod", "staging"
service.Tier             // "frontend", "backend", "database"
service.Owner            // Team/user responsible
service.HealthStatus     // "healthy", "degraded", "unhealthy"
service.LastErrorAt      // For "has errors" filter
```

---

## Search Capabilities

### Quick Search (Global)
```
Ctrl+K → Search modal
  - Apps by name
  - Services by name
  - Tabs by name
  - Recent items
```

### Advanced Search
```
app:minicluster status:running tag:production
│               │              │
└─ App filter   └─ Status      └─ Tag filter
```

### Search Syntax
```
name:api            # Name contains "api"
status:running      # Status equals "running"
app:myapp           # In app "myapp"
tag:production      # Has tag "production"
type:dotnet         # Service type
updated:>1d         # Updated in last day
-status:stopped     # Exclude stopped
```

---

## Implementation Plan

### Phase 1: Filters & Tags (1 week)
1. Add tags table and service_tags junction
2. Implement tag CRUD API
3. Add filter state to frontend
4. Build filter sidebar component
5. Implement search with filter syntax
6. Add tag management UI

### Phase 2: Grouping Modes (1 week)
1. Add grouping mode state
2. Implement grouping transformations
3. Build mode selector UI
4. Add favorites system
5. Implement recently accessed
6. URL state for view mode

---

## UI Components

### Filter Sidebar
```tsx
<FilterSidebar
  filters={builtInFilters}
  customFilters={userFilters}
  activeFilter={activeFilter}
  onFilterChange={handleFilterChange}
/>
```

### Tag Pill
```tsx
<TagPill tag={tag} removable={editable} onRemove={handleRemove} />
```

### Service Card (Enhanced)
```tsx
<ServiceCard
  service={service}
  showTags={true}
  showApp={groupMode !== 'app'}
  onTagClick={handleTagFilter}
/>
```

---

## References

- App Tabs implementation: `ControlCenter.Api/Controllers/AppTabsController.cs`
- Frontend app grouping: `minicluster-ui/app/components/AppGroupedServicesView.tsx`
- Original hierarchy spec: `../spec2/`
