# Feature 021: Simple App Tabs

**Status:** 📋 Spec Ready  
**Priority:** 🔴 HIGH  
**Effort:** 1-2 weeks (40-60 hours)  
**Phase:** 1 of 3 (Incremental Evolution)  
**Target Date:** February 15, 2026

---

## Overview

Add lightweight **app grouping** to organize services into logical containers with tab-based navigation. This is a simplified, flat version before full hierarchical apps.

**Core Concept:**
- **One App** contains **many Services** (1:N relationship)
- Apps are **flat** (no parent-child nesting)
- **Tab UI** for quick navigation between apps
- **Cards view** to browse all apps
- **+ button** to create new apps instantly

---

## Business Value

### Current Pain Points

| Problem | Impact | User Quote |
|---------|--------|------------|
| **Service Sprawl** | 20+ services in one long list | "I can't find the service I need" |
| **No Organization** | Mix of prod/dev/monitoring services | "Everything is cluttered together" |
| **Manual Operations** | Start services one by one | "I want to start all e-commerce services" |
| **Context Switching** | Hard to focus on one system | "I just want to see the API services" |

### Solution Benefits

| Benefit | Value |
|---------|-------|
| **Logical Grouping** | Services organized by purpose/system |
| **Quick Navigation** | Tab between apps in one click |
| **Bulk Operations** | Start/stop entire app |
| **Visual Clarity** | Focus on one app at a time |
| **No Learning Curve** | Familiar tab metaphor (browser tabs) |

---

## User Stories

### Story 1: Browse Apps
```
As a DevOps engineer
I want to see all my apps as cards
So I can quickly navigate to the one I need
```

**Acceptance Criteria:**
- [ ] Apps displayed as grid of cards
- [ ] Card shows: name, description, service count, status
- [ ] Click card opens app in tab view
- [ ] Empty state shows "Create your first app"

### Story 2: Create App
```
As a DevOps engineer  
I want to create a new app with a + button
So I can organize my services
```

**Acceptance Criteria:**
- [ ] + button visible in tab bar and cards view
- [ ] Modal form: name (required), description (optional)
- [ ] Creates app and switches to it immediately
- [ ] Success toast notification

### Story 3: Tab Navigation
```
As a DevOps engineer
I want to switch between apps using tabs
So I can quickly view different service groups
```

**Acceptance Criteria:**
- [ ] Tabs show app names
- [ ] Active tab highlighted
- [ ] Click tab switches to that app's services
- [ ] Keyboard shortcuts: Ctrl+Tab (next), Ctrl+Shift+Tab (prev)
- [ ] Max 10 tabs visible, scroll for more

### Story 4: Manage Services in App
```
As a DevOps engineer
I want to add services to an app
So they're grouped together
```

**Acceptance Criteria:**
- [ ] Service form has "App" dropdown
- [ ] Can select app when creating service
- [ ] Can move service to different app (edit)
- [ ] Services without app appear in "Unassigned" tab

### Story 5: Bulk Operations
```
As a DevOps engineer
I want to start/stop all services in an app
So I don't have to click each one
```

**Acceptance Criteria:**
- [ ] "Start All" button starts all stopped services
- [ ] "Stop All" button stops all running services
- [ ] Progress indicator during bulk operation
- [ ] Toast shows success/failure count

---

## Data Model

### New Entity: App

```csharp
public class App
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Basic Info
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }  // emoji or icon name
    public string? Color { get; set; }  // hex color for visual identity
    
    // Metadata
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
    public int SortOrder { get; set; } = 0;  // for custom tab ordering
    
    // Navigation (for future phases - NULL for now)
    public Guid? ParentAppId { get; set; }  // Phase 3: Hierarchy
    public Guid? GroupId { get; set; }       // Phase 2: Groups
    
    // Relationships
    public ICollection<Service> Services { get; set; } = new List<Service>();
}
```

### Modified Entity: Service

```csharp
public class Service
{
    // ... existing fields ...
    
    // NEW: App relationship
    public Guid? AppId { get; set; }  // Nullable for backward compatibility
    public App? App { get; set; }
}
```

### Database Migration

```csharp
public partial class AddSimpleAppTabs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Create Apps table
        migrationBuilder.CreateTable(
            name: "Apps",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                Description = table.Column<string>(maxLength: 1000, nullable: true),
                Icon = table.Column<string>(maxLength: 50, nullable: true),
                Color = table.Column<string>(maxLength: 20, nullable: true),
                CreatedAt = table.Column<DateTime>(nullable: false),
                ModifiedAt = table.Column<DateTime>(nullable: false),
                SortOrder = table.Column<int>(nullable: false, defaultValue: 0),
                ParentAppId = table.Column<Guid>(nullable: true),  // Future
                GroupId = table.Column<Guid>(nullable: true)        // Future
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Apps", x => x.Id);
                table.ForeignKey(
                    name: "FK_Apps_Apps_ParentAppId",
                    column: x => x.ParentAppId,
                    principalTable: "Apps",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        // Add AppId to Services
        migrationBuilder.AddColumn<Guid>(
            name: "AppId",
            table: "Services",
            nullable: true);

        // Add foreign key
        migrationBuilder.AddForeignKey(
            name: "FK_Services_Apps_AppId",
            table: "Services",
            column: "AppId",
            principalTable: "Apps",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);  // Keep services if app deleted

        // Add indexes
        migrationBuilder.CreateIndex(
            name: "IX_Services_AppId",
            table: "Services",
            column: "AppId");

        migrationBuilder.CreateIndex(
            name: "IX_Apps_Name",
            table: "Apps",
            column: "Name");

        migrationBuilder.CreateIndex(
            name: "IX_Apps_SortOrder",
            table: "Apps",
            column: "SortOrder");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey("FK_Services_Apps_AppId", "Services");
        migrationBuilder.DropColumn("AppId", "Services");
        migrationBuilder.DropTable("Apps");
    }
}
```

---

## API Endpoints

### Apps Controller

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/apps` | List all apps | - | `AppResponseDto[]` |
| GET | `/api/apps/{id}` | Get app by ID | - | `AppResponseDto` |
| GET | `/api/apps/{id}/services` | Get app's services | - | `ServiceResponseDto[]` |
| POST | `/api/apps` | Create app | `CreateAppDto` | `AppResponseDto` |
| PUT | `/api/apps/{id}` | Update app | `UpdateAppDto` | `AppResponseDto` |
| DELETE | `/api/apps/{id}` | Delete app | - | `204 No Content` |
| POST | `/api/apps/{id}/start-all` | Start all services | - | `BulkOperationResult` |
| POST | `/api/apps/{id}/stop-all` | Stop all services | - | `BulkOperationResult` |
| PUT | `/api/apps/reorder` | Reorder tabs | `{ appIds: Guid[] }` | `204 No Content` |

### DTOs

```csharp
public record CreateAppDto
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public required string Name { get; init; }
    
    [StringLength(1000)]
    public string? Description { get; init; }
    
    public string? Icon { get; init; }
    public string? Color { get; init; }
}

public record UpdateAppDto
{
    [StringLength(200, MinimumLength = 1)]
    public string? Name { get; init; }
    
    [StringLength(1000)]
    public string? Description { get; init; }
    
    public string? Icon { get; init; }
    public string? Color { get; init; }
}

public record AppResponseDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public int ServiceCount { get; init; }
    public int RunningCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime ModifiedAt { get; init; }
}

public record BulkOperationResult
{
    public int Total { get; init; }
    public int Succeeded { get; init; }
    public int Failed { get; init; }
    public List<string> Errors { get; init; } = new();
}
```

### Controller Implementation

```csharp
[ApiController]
[Route("api/apps")]
public class AppsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IServiceProcessManager _processManager;
    private readonly IMapper _mapper;

    [HttpGet]
    public async Task<ActionResult<List<AppResponseDto>>> GetAll()
    {
        var apps = await _db.Apps
            .Include(a => a.Services)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync();

        return Ok(apps.Select(MapToDto));
    }

    [HttpPost]
    public async Task<ActionResult<AppResponseDto>> Create([FromBody] CreateAppDto dto)
    {
        var app = new App
        {
            Name = dto.Name,
            Description = dto.Description,
            Icon = dto.Icon,
            Color = dto.Color,
            SortOrder = await _db.Apps.CountAsync()  // Add to end
        };

        _db.Apps.Add(app);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = app.Id }, MapToDto(app));
    }

    [HttpPost("{id}/start-all")]
    public async Task<ActionResult<BulkOperationResult>> StartAll(Guid id)
    {
        var app = await _db.Apps.Include(a => a.Services).FirstOrDefaultAsync(a => a.Id == id);
        if (app == null) return NotFound();

        var result = new BulkOperationResult { Total = app.Services.Count };
        
        foreach (var service in app.Services)
        {
            var startResult = await _processManager.StartServiceAsync(service.Id);
            if (startResult.Success)
                result.Succeeded++;
            else
            {
                result.Failed++;
                result.Errors.Add($"{service.Name}: {startResult.ErrorMessage}");
            }
        }

        return Ok(result);
    }

    private AppResponseDto MapToDto(App app)
    {
        return new AppResponseDto
        {
            Id = app.Id,
            Name = app.Name,
            Description = app.Description,
            Icon = app.Icon,
            Color = app.Color,
            ServiceCount = app.Services.Count,
            RunningCount = app.Services.Count(s => _processManager.GetStatus(s.Id) == ServiceRuntimeStatus.Running),
            CreatedAt = app.CreatedAt,
            ModifiedAt = app.ModifiedAt
        };
    }
}
```

---

## Frontend Implementation

### UI Components

#### 1. App Cards View

```tsx
// routes/apps.tsx
export default function AppsPage() {
  const { data: apps } = useAppsQuery();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Apps</h1>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          New App
        </button>
      </div>

      {apps?.length === 0 ? (
        <EmptyState 
          icon={<FolderIcon />}
          title="No apps yet"
          description="Create your first app to organize services"
          action={<CreateAppButton />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps?.map(app => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 2. App Card Component

```tsx
// components/AppCard.tsx
interface AppCardProps {
  app: AppResponseDto;
}

export function AppCard({ app }: AppCardProps) {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/apps/${app.id}`)}
      className="card hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {app.icon && <span className="text-3xl">{app.icon}</span>}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{app.name}</h3>
          {app.description && (
            <p className="text-sm text-gray-600 mt-1">{app.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-1">
          <ServerIcon className="w-4 h-4" />
          <span>{app.serviceCount} services</span>
        </div>
        <div className="flex items-center gap-1">
          <PlayIcon className="w-4 h-4 text-green-500" />
          <span>{app.runningCount} running</span>
        </div>
      </div>

      {app.color && (
        <div 
          className="absolute top-0 right-0 w-1 h-full rounded-r"
          style={{ backgroundColor: app.color }}
        />
      )}
    </div>
  );
}
```

#### 3. App Tabs View

```tsx
// routes/apps/$id.tsx
export default function AppDetailPage() {
  const { id } = useParams();
  const { data: app } = useAppQuery(id);
  const { data: services } = useAppServicesQuery(id);
  const { data: allApps } = useAppsQuery();

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <AppTabBar apps={allApps} activeAppId={id} />

      {/* App Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {app?.icon && <span>{app.icon}</span>}
              {app?.name}
            </h1>
            {app?.description && (
              <p className="text-gray-600 mt-1">{app.description}</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleStartAll} className="btn-success">
              <PlayIcon /> Start All
            </button>
            <button onClick={handleStopAll} className="btn-danger">
              <StopIcon /> Stop All
            </button>
            <button onClick={openEditModal} className="btn-secondary">
              <SettingsIcon /> Configure
            </button>
          </div>
        </div>

        {/* Services List */}
        <ServicesTable services={services} appId={id} />
      </div>
    </div>
  );
}
```

#### 4. App Tab Bar Component

```tsx
// components/AppTabBar.tsx
interface AppTabBarProps {
  apps: AppResponseDto[];
  activeAppId: string;
}

export function AppTabBar({ apps, activeAppId }: AppTabBarProps) {
  const navigate = useNavigate();
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (appId: string) => {
    navigate(`/apps/${appId}`);
  };

  return (
    <div className="border-b bg-white">
      <div className="flex items-center">
        {/* Scroll left button */}
        {scrollPosition > 0 && (
          <button onClick={scrollLeft} className="p-2">
            <ChevronLeftIcon />
          </button>
        )}

        {/* Tabs container */}
        <div 
          ref={scrollRef}
          className="flex-1 flex overflow-x-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          {apps.map(app => (
            <div
              key={app.id}
              onClick={() => handleTabClick(app.id)}
              className={cn(
                "px-4 py-3 cursor-pointer whitespace-nowrap border-b-2 transition-colors",
                app.id === activeAppId
                  ? "border-blue-500 text-blue-600 font-medium"
                  : "border-transparent hover:border-gray-300 text-gray-600"
              )}
            >
              {app.icon && <span className="mr-2">{app.icon}</span>}
              {app.name}
              <span className="ml-2 text-xs text-gray-500">
                ({app.runningCount}/{app.serviceCount})
              </span>
            </div>
          ))}
        </div>

        {/* Scroll right + Add button */}
        <div className="flex items-center border-l">
          {canScrollRight && (
            <button onClick={scrollRight} className="p-2">
              <ChevronRightIcon />
            </button>
          )}
          <button 
            onClick={openCreateAppModal} 
            className="p-2 hover:bg-gray-100"
            title="New App"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 5. Create/Edit App Modal

```tsx
// components/AppFormModal.tsx
export function AppFormModal({ app, onClose }: AppFormModalProps) {
  const [formData, setFormData] = useState({
    name: app?.name || '',
    description: app?.description || '',
    icon: app?.icon || '📦',
    color: app?.color || '#3B82F6'
  });

  const createMutation = useCreateAppMutation();
  const updateMutation = useUpdateAppMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (app) {
      await updateMutation.mutateAsync({ id: app.id, ...formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    
    toast.success(app ? 'App updated' : 'App created');
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-bold">
          {app ? 'Edit App' : 'Create New App'}
        </h2>

        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="input"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="input"
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Icon (emoji)</label>
            <input
              type="text"
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              className="input"
              placeholder="📦"
              maxLength={10}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {app ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## Implementation Plan

### Sprint 1: Backend (Week 1)

**Day 1-2: Database & Entities**
- [ ] Create `App` entity
- [ ] Add `AppId` to `Service` entity
- [ ] Write migration  
- [ ] Test migration up/down
- [ ] Add seed data (example apps)

**Day 3-4: API Layer**
- [ ] Create `AppsController`
- [ ] Implement CRUD endpoints
- [ ] Implement bulk operations
- [ ] Add validation
- [ ] Write unit tests

**Day 5: Integration**
- [ ] Test with Postman/Swagger
- [ ] Integration tests
- [ ] Performance testing (bulk operations)
- [ ] API documentation

### Sprint 2: Frontend (Week 2)

**Day 1-2: UI Components**
- [ ] `AppCard` component
- [ ] `AppTabBar` component
- [ ] `AppFormModal` component
- [ ] `ServicesTable` (app-scoped)

**Day 3-4: Pages & Routing**
- [ ] `/apps` - Cards view page
- [ ] `/apps/:id` - App detail with tabs
- [ ] Navigation integration
- [ ] Update service forms (add app selector)

**Day 5: Polish & Testing**
- [ ] Keyboard shortcuts
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] End-to-end testing
- [ ] User acceptance testing

---

## Testing Strategy

### Unit Tests

**Backend:**
```csharp
[Fact]
public async Task CreateApp_ValidData_ReturnsCreated()
{
    // Arrange
    var dto = new CreateAppDto { Name = "Test App" };
    
    // Act
    var result = await _controller.Create(dto);
    
    // Assert
    var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
    var app = Assert.IsType<AppResponseDto>(createdResult.Value);
    Assert.Equal("Test App", app.Name);
}

[Fact]
public async Task StartAll_StopsAllServices_ReturnsSuccessCount()
{
    // Arrange
    var app = await CreateAppWithServices(3);
    
    // Act
    var result = await _controller.StartAll(app.Id);
    
    // Assert
    var okResult = Assert.IsType<OkObjectResult>(result.Result);
    var bulkResult = Assert.IsType<BulkOperationResult>(okResult.Value);
    Assert.Equal(3, bulkResult.Total);
    Assert.Equal(3, bulkResult.Succeeded);
}
```

**Frontend:**
```typescript
describe('AppCard', () => {
  it('displays app info correctly', () => {
    const app = { 
      id: '1', 
      name: 'Test App', 
      serviceCount: 5,
      runningCount: 3 
    };
    
    render(<AppCard app={app} />);
    
    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(screen.getByText('5 services')).toBeInTheDocument();
    expect(screen.getByText('3 running')).toBeInTheDocument();
  });

  it('navigates to app detail on click', () => {
    const navigate = jest.fn();
    jest.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
    
    const app = { id: '1', name: 'Test' };
    render(<AppCard app={app} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(navigate).toHaveBeenCalledWith('/apps/1');
  });
});
```

### Integration Tests

```csharp
[Fact]
public async Task FullWorkflow_CreateAppAddServicesStartAll_WorksEndToEnd()
{
    // 1. Create app
    var createDto = new CreateAppDto { Name = "E-Commerce" };
    var appResult = await _client.PostAsJsonAsync("/api/apps", createDto);
    var app = await appResult.Content.ReadFromJsonAsync<AppResponseDto>();
    
    // 2. Create services in app
    var service1 = new CreateServiceDto { Name = "API", AppId = app.Id };
    var service2 = new CreateServiceDto { Name = "Worker", AppId = app.Id };
    await _client.PostAsJsonAsync("/api/services", service1);
    await _client.PostAsJsonAsync("/api/services", service2);
    
    // 3. Start all
    var startResult = await _client.PostAsync($"/api/apps/{app.Id}/start-all", null);
    var bulkResult = await startResult.Content.ReadFromJsonAsync<BulkOperationResult>();
    
    // 4. Verify
    Assert.Equal(2, bulkResult.Total);
    Assert.Equal(2, bulkResult.Succeeded);
    
    // 5. Get app services
    var servicesResult = await _client.GetFromJsonAsync<List<ServiceResponseDto>>($"/api/apps/{app.Id}/services");
    Assert.All(servicesResult, s => Assert.Equal("running", s.Status));
}
```

---

## Migration Strategy

### Phase 1: Deploy with Feature Flag OFF
1. Deploy backend with new tables
2. Run migration
3. Feature flag: `SimpleAppTabs = false`
4. Monitor for issues

### Phase 2: Enable for Internal Testing
1. Feature flag: `SimpleAppTabs = true` (staging only)
2. Internal team creates test apps
3. Gather feedback
4. Fix bugs

### Phase 3: Gradual Rollout
1. Enable for 10% of users
2. Monitor metrics (latency, errors)
3. Increase to 50%, then 100%

### Phase 4: Create Default App
1. Background job: Create "Default App"
2. Assign unassigned services to it
3. Users can rename/reorganize

---

## Success Metrics

### Usage Metrics
- **Adoption Rate:** % of users who create apps (Target: 70% within 1 month)
- **Apps Created:** Average apps per user (Target: 3-5)
- **Services per App:** Average services per app (Target: 3-7)
- **Tab Switches:** Daily tab switches per user (Target: 10+)

### Performance Metrics
- **Tab Switch:** <100ms (Target: <50ms)
- **Cards Load:** <200ms for 20 apps (Target: <150ms)
- **Bulk Start:** <5s for 5 services (Target: <3s)

### User Satisfaction
- **NPS Score:** Target 40+ (Promoters - Detractors)
- **Feedback:** "Easy to organize" rating 4+/5
- **Support Tickets:** <5 tickets per 100 users

---

## Future Enhancements (Out of Scope)

These will be in **Phase 2** (App Groups) and **Phase 3** (Hierarchy):

- [ ] Drag-drop services between apps
- [ ] App templates (create from template)
- [ ] App-level environment variables
- [ ] App dependencies (start order)
- [ ] App health rollup
- [ ] Nested apps (parent-child)
- [ ] Groups with inheritance
- [ ] Marketplace app bundles

**Keep it simple for Phase 1!**

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Performance:** Tab switching slow with many apps | Medium | Low | Virtualize tab list, load services on demand |
| **Data Loss:** Migration fails | High | Low | Thorough testing, rollback script, backup |
| **UX Confusion:** Users don't understand apps | Medium | Medium | Good onboarding, tooltips, examples |
| **Adoption:** Users don't create apps | Medium | Medium | Smart defaults, prompts, demo apps |

---

## Documentation Needs

- [ ] API documentation (Swagger)
- [ ] User guide: "Organizing Services with Apps"
- [ ] Migration guide (for existing users)
- [ ] Video tutorial (2-3 minutes)
- [ ] Release notes

---

## Done Criteria

Feature is considered **DONE** when:

- [x] All user stories accepted by product owner
- [x] Unit tests pass (>80% coverage)
- [x] Integration tests pass
- [x] Performance metrics met
- [x] Documentation complete
- [x] Deployed to production
- [x] Feature flag enabled for 100% users
- [x] Zero P0/P1 bugs for 1 week post-launch

---

**Next Step:** Begin Sprint 1 - Backend implementation!
