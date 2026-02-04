# Feature 012: Plugin System

## Overview

A general-purpose, **open plugin architecture** for extending MiniCluster with external infrastructure components. Both **backend (.NET)** and **frontend (React)** plugins are supported. Third-party developers can create and distribute plugins.

---

## Business Value

| Problem | Solution |
|---------|----------|
| Different tools, different UIs | Single control plane |
| Manual installation | One-click install |
| Scattered config files | Unified configuration |
| No visibility | All infrastructure in one dashboard |
| Vendor lock-in | Swap plugins without code changes |
| **Closed ecosystem** | **Open plugin marketplace** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PLUGIN SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PLUGIN PACKAGE                        │   │
│  │  ┌─────────────────┐    ┌─────────────────┐            │   │
│  │  │  Backend (.NET) │    │ Frontend (React)│            │   │
│  │  │  - IPlugin      │    │ - UI Components │            │   │
│  │  │  - Services     │    │ - Config Forms  │            │   │
│  │  │  - API Routes   │    │ - Dashboard     │            │   │
│  │  └─────────────────┘    └─────────────────┘            │   │
│  │                                                         │   │
│  │  manifest.json + plugin.dll + plugin-ui.js              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   PLUGIN HOST                            │   │
│  │                                                         │   │
│  │  BACKEND HOST              FRONTEND HOST                │   │
│  │  ├── Plugin Loader         ├── Plugin Loader            │   │
│  │  ├── Dependency Injection  ├── Module Federation        │   │
│  │  ├── API Router            ├── Route Registration       │   │
│  │  ├── Config Storage        ├── UI Extension Points      │   │
│  │  └── Sandboxing            └── State Management         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────┐     │
│  │                  PLUGIN REGISTRY                       │     │
│  │  Local plugins + Remote marketplace                    │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Plugin Package Structure

```
my-plugin/
├── manifest.json           # Plugin metadata & configuration
├── backend/
│   ├── MyPlugin.dll        # Compiled .NET assembly
│   └── dependencies/       # Additional DLLs if needed
├── frontend/
│   ├── index.js            # Bundled React components
│   ├── index.css           # Styles
│   └── assets/             # Icons, images
└── README.md               # Documentation
```

---

## Part 1: Backend Plugin SDK

### Plugin Interface

```csharp
namespace MiniCluster.Plugins;

public interface IPlugin
{
    // Identity
    string Id { get; }
    string Name { get; }
    string Version { get; }
    PluginCategory Category { get; }
    
    // Lifecycle
    Task InitializeAsync(IPluginContext context, CancellationToken ct);
    Task StartAsync(CancellationToken ct);
    Task StopAsync(CancellationToken ct);
    Task ShutdownAsync(CancellationToken ct);
    
    // Configuration
    Type? ConfigurationType { get; }  // POCO for config
    Task ApplyConfigAsync(object config, CancellationToken ct);
    Task<object?> GetConfigAsync(CancellationToken ct);
    
    // Health
    Task<HealthCheckResult> HealthCheckAsync(CancellationToken ct);
}

public interface IPluginContext
{
    // Services
    IServiceProvider Services { get; }
    ILogger Logger { get; }
    
    // Storage
    string DataDirectory { get; }      // Plugin-specific storage
    IPluginStorage Storage { get; }    // Key-value storage
    
    // Communication
    IEventBus EventBus { get; }        // Pub/sub between plugins
    
    // Host info
    string HostVersion { get; }
    PluginEnvironment Environment { get; }
}

public interface IPluginStorage
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct);
    Task SetAsync<T>(string key, T value, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}
```

### Registering Services & Routes

```csharp
public interface IPluginWithServices : IPlugin
{
    void ConfigureServices(IServiceCollection services);
}

public interface IPluginWithRoutes : IPlugin
{
    void MapRoutes(IEndpointRouteBuilder routes);
}

// Example: Nginx Plugin
public class NginxPlugin : IPlugin, IPluginWithServices, IPluginWithRoutes
{
    public string Id => "nginx";
    public string Name => "Nginx";
    public string Version => "1.0.0";
    public PluginCategory Category => PluginCategory.Proxy;
    
    public Type? ConfigurationType => typeof(NginxConfig);
    
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<INginxService, NginxService>();
        services.AddSingleton<INginxConfigGenerator, NginxConfigGenerator>();
    }
    
    public void MapRoutes(IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/plugins/nginx");
        
        group.MapGet("/status", async (INginxService svc) => 
            await svc.GetStatusAsync());
        
        group.MapPost("/reload", async (INginxService svc) => 
            await svc.ReloadAsync());
        
        group.MapGet("/config/test", async (INginxService svc) => 
            await svc.TestConfigAsync());
    }
    
    public async Task InitializeAsync(IPluginContext context, CancellationToken ct)
    {
        _logger = context.Logger;
        _dataDir = context.DataDirectory;
        await DetectInstallationAsync(ct);
    }
    
    // ... other methods
}
```

### Plugin Loader

```csharp
public class PluginLoader
{
    private readonly string _pluginsDirectory;
    private readonly List<PluginAssemblyLoadContext> _loadContexts = new();
    
    public async Task<IPlugin> LoadPluginAsync(string pluginPath)
    {
        var manifest = await LoadManifestAsync(pluginPath);
        
        // Create isolated AssemblyLoadContext for plugin
        var loadContext = new PluginAssemblyLoadContext(pluginPath);
        _loadContexts.Add(loadContext);
        
        var assemblyPath = Path.Combine(pluginPath, "backend", manifest.Assembly);
        var assembly = loadContext.LoadFromAssemblyPath(assemblyPath);
        
        // Find IPlugin implementation
        var pluginType = assembly.GetTypes()
            .FirstOrDefault(t => typeof(IPlugin).IsAssignableFrom(t) && !t.IsAbstract);
        
        if (pluginType == null)
            throw new InvalidOperationException($"No IPlugin found in {manifest.Assembly}");
        
        return (IPlugin)Activator.CreateInstance(pluginType)!;
    }
    
    public void UnloadPlugin(string pluginId)
    {
        var context = _loadContexts.FirstOrDefault(c => c.PluginId == pluginId);
        context?.Unload();
        _loadContexts.Remove(context);
    }
}

// Isolated load context for plugin sandbox
public class PluginAssemblyLoadContext : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver _resolver;
    
    public PluginAssemblyLoadContext(string pluginPath) : base(isCollectible: true)
    {
        _resolver = new AssemblyDependencyResolver(pluginPath);
    }
    
    protected override Assembly? Load(AssemblyName assemblyName)
    {
        var path = _resolver.ResolveAssemblyToPath(assemblyName);
        return path != null ? LoadFromAssemblyPath(path) : null;
    }
}
```

---

## Part 2: Frontend Plugin SDK

### Plugin Entry Point

```typescript
// plugin-sdk/types.ts
export interface FrontendPlugin {
  id: string;
  name: string;
  version: string;
  
  // UI Components
  ConfigPanel?: React.ComponentType<ConfigPanelProps>;
  DashboardWidget?: React.ComponentType<WidgetProps>;
  SettingsPage?: React.ComponentType<SettingsProps>;
  
  // Routes
  routes?: PluginRoute[];
  
  // Navigation
  navItems?: NavItem[];
  
  // Hooks into host
  onInstall?: (context: PluginContext) => void;
  onUninstall?: (context: PluginContext) => void;
}

export interface PluginRoute {
  path: string;
  component: React.ComponentType;
  title?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
  parent?: string;  // For nested nav
}

export interface PluginContext {
  // API
  api: PluginApiClient;
  
  // Storage
  storage: PluginStorage;
  
  // Events
  events: EventEmitter;
  
  // UI utilities
  toast: ToastApi;
  modal: ModalApi;
  
  // Host info
  hostVersion: string;
}

export interface ConfigPanelProps {
  pluginId: string;
  config: unknown;
  schema: JSONSchema;
  onSave: (config: unknown) => Promise<void>;
}
```

### Example Frontend Plugin

```tsx
// nginx-plugin/src/index.tsx
import { FrontendPlugin, ConfigPanelProps } from '@minicluster/plugin-sdk';

const NginxConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave }) => {
  const [formData, setFormData] = useState(config);
  
  return (
    <div className="nginx-config">
      <h3>Nginx Configuration</h3>
      
      <FormField label="Worker Processes">
        <Input 
          type="number"
          value={formData.workerProcesses}
          onChange={e => setFormData({...formData, workerProcesses: e.target.value})}
        />
      </FormField>
      
      <FormField label="Worker Connections">
        <Input 
          type="number"
          value={formData.workerConnections}
          onChange={e => setFormData({...formData, workerConnections: e.target.value})}
        />
      </FormField>
      
      <Button onClick={() => onSave(formData)}>Save</Button>
    </div>
  );
};

const NginxDashboard: React.FC = () => {
  const { data: status } = usePluginApi<NginxStatus>('/api/plugins/nginx/status');
  
  return (
    <div className="nginx-dashboard">
      <StatCard label="Active Connections" value={status?.activeConnections} />
      <StatCard label="Requests/sec" value={status?.requestsPerSecond} />
      <StatCard label="Uptime" value={formatUptime(status?.uptime)} />
    </div>
  );
};

const NginxRoutes: React.FC = () => {
  const { data: routes } = usePluginApi<Route[]>('/api/plugins/nginx/routes');
  
  return (
    <Table>
      {/* Route management UI */}
    </Table>
  );
};

// Plugin export
export const plugin: FrontendPlugin = {
  id: 'nginx',
  name: 'Nginx',
  version: '1.0.0',
  
  ConfigPanel: NginxConfigPanel,
  DashboardWidget: NginxDashboard,
  
  routes: [
    { path: '/plugins/nginx', component: NginxDashboard, title: 'Nginx Dashboard' },
    { path: '/plugins/nginx/routes', component: NginxRoutes, title: 'Routes' },
  ],
  
  navItems: [
    { id: 'nginx', label: 'Nginx', icon: <NginxIcon />, path: '/plugins/nginx', parent: 'proxy' }
  ],
};

export default plugin;
```

### Frontend Plugin Loader

```tsx
// Host application
import { lazy, Suspense } from 'react';

interface LoadedPlugin {
  id: string;
  module: FrontendPlugin;
}

class FrontendPluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  
  async loadPlugin(manifest: PluginManifest): Promise<FrontendPlugin> {
    // Dynamic import with Module Federation or script loading
    const pluginUrl = `/plugins/${manifest.id}/frontend/index.js`;
    
    // Using dynamic import
    const module = await import(/* webpackIgnore: true */ pluginUrl);
    const plugin = module.default as FrontendPlugin;
    
    this.plugins.set(manifest.id, { id: manifest.id, module: plugin });
    
    return plugin;
  }
  
  getRoutes(): PluginRoute[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.module.routes || []);
  }
  
  getNavItems(): NavItem[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.module.navItems || []);
  }
  
  getConfigPanel(pluginId: string): React.ComponentType<ConfigPanelProps> | null {
    return this.plugins.get(pluginId)?.module.ConfigPanel || null;
  }
}

// Usage in host app
function App() {
  const { plugins, loading } = usePluginLoader();
  
  return (
    <Router>
      <Sidebar navItems={plugins.getNavItems()} />
      <Routes>
        {/* Built-in routes */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps" element={<Apps />} />
        
        {/* Plugin routes - dynamically registered */}
        {plugins.getRoutes().map(route => (
          <Route 
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={<Loading />}>
                <route.component />
              </Suspense>
            }
          />
        ))}
      </Routes>
    </Router>
  );
}
```

---

## Part 3: Plugin Manifest

```json
{
  "$schema": "https://minicluster.io/schemas/plugin-manifest-v1.json",
  "id": "nginx",
  "name": "Nginx",
  "version": "1.0.0",
  "description": "High-performance HTTP server and reverse proxy",
  "author": {
    "name": "MiniCluster Team",
    "email": "plugins@minicluster.io",
    "url": "https://minicluster.io"
  },
  "license": "MIT",
  "repository": "https://github.com/minicluster/plugin-nginx",
  
  "category": "proxy",
  "tags": ["proxy", "web-server", "load-balancing", "reverse-proxy"],
  "icon": "icon.svg",
  
  "platforms": ["linux", "windows"],
  "minHostVersion": "1.0.0",
  
  "capabilities": [
    "reverse_proxy",
    "load_balancing", 
    "tls_termination",
    "websocket",
    "config_hot_reload"
  ],
  
  "backend": {
    "assembly": "NginxPlugin.dll",
    "entryPoint": "NginxPlugin.NginxPlugin",
    "dependencies": []
  },
  
  "frontend": {
    "entry": "index.js",
    "styles": "index.css"
  },
  
  "detection": {
    "linux": {
      "paths": ["/usr/sbin/nginx", "/usr/local/nginx/sbin/nginx"],
      "configPaths": ["/etc/nginx/nginx.conf"]
    },
    "windows": {
      "paths": ["C:\\nginx\\nginx.exe"],
      "configPaths": ["C:\\nginx\\conf\\nginx.conf"]
    }
  },
  
  "configSchema": {
    "type": "object",
    "properties": {
      "workerProcesses": {
        "type": "integer",
        "default": 4,
        "description": "Number of worker processes"
      },
      "workerConnections": {
        "type": "integer", 
        "default": 1024,
        "description": "Max connections per worker"
      }
    }
  },
  
  "actions": [
    {
      "id": "reload",
      "name": "Reload Config",
      "description": "Reload configuration without downtime",
      "icon": "refresh"
    },
    {
      "id": "test-config",
      "name": "Test Configuration",
      "description": "Validate configuration syntax"
    }
  ],
  
  "permissions": [
    "filesystem:read:/etc/nginx",
    "filesystem:write:/etc/nginx",
    "process:start:nginx",
    "process:stop:nginx",
    "network:listen:80",
    "network:listen:443"
  ]
}
```

---

## Part 4: Plugin API & Security

### Permission System

```csharp
public enum PluginPermission
{
    // Filesystem
    FilesystemRead,
    FilesystemWrite,
    
    // Process
    ProcessStart,
    ProcessStop,
    ProcessList,
    
    // Network
    NetworkListen,
    NetworkConnect,
    
    // MiniCluster
    AppsRead,
    AppsWrite,
    ConfigRead,
    ConfigWrite,
    
    // System
    SystemInfo,
    SystemShutdown
}

public interface IPermissionValidator
{
    bool HasPermission(string pluginId, PluginPermission permission, string? resource = null);
    void ValidatePermission(string pluginId, PluginPermission permission, string? resource = null);
}

// Plugin requests permission in manifest, user approves on install
```

### Plugin API Client (Frontend)

```typescript
// @minicluster/plugin-sdk
export class PluginApiClient {
  constructor(private pluginId: string) {}
  
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`/api/plugins/${this.pluginId}${path}`, {
      headers: { 'X-Plugin-Id': this.pluginId }
    });
    return response.json();
  }
  
  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await fetch(`/api/plugins/${this.pluginId}${path}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Plugin-Id': this.pluginId 
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

// Hook for plugin components
export function usePluginApi<T>(path: string) {
  const context = usePluginContext();
  return useQuery({
    queryKey: ['plugin', context.pluginId, path],
    queryFn: () => context.api.get<T>(path)
  });
}
```

---

## Part 5: Plugin Marketplace

### Registry API

```csharp
public interface IPluginRegistry
{
    // Browse
    Task<PagedResult<PluginInfo>> SearchAsync(PluginSearchQuery query);
    Task<PluginInfo?> GetPluginAsync(string pluginId);
    Task<List<PluginInfo>> GetFeaturedAsync();
    Task<List<PluginInfo>> GetByCategory(PluginCategory category);
    
    // Install
    Task<Stream> DownloadPluginAsync(string pluginId, string version);
    
    // Publish (for developers)
    Task<PublishResult> PublishPluginAsync(Stream package, string apiKey);
}

// Public marketplace API
[ApiController]
[Route("api/marketplace")]
public class MarketplaceController : ControllerBase
{
    [HttpGet("plugins")]
    public async Task<ActionResult<PagedResult<PluginInfo>>> Search(
        [FromQuery] string? q,
        [FromQuery] PluginCategory? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        return await _registry.SearchAsync(new PluginSearchQuery
        {
            Query = q,
            Category = category,
            Page = page,
            PageSize = pageSize
        });
    }
    
    [HttpGet("plugins/{id}")]
    public async Task<ActionResult<PluginInfo>> GetPlugin(string id)
    {
        var plugin = await _registry.GetPluginAsync(id);
        return plugin == null ? NotFound() : Ok(plugin);
    }
    
    [HttpGet("plugins/{id}/download")]
    public async Task<IActionResult> Download(string id, [FromQuery] string? version)
    {
        var stream = await _registry.DownloadPluginAsync(id, version ?? "latest");
        return File(stream, "application/zip", $"{id}.zip");
    }
}
```

### Developer Portal

```typescript
// Plugin submission
function PublishPlugin() {
  const publishMutation = usePublishPlugin();
  
  return (
    <div className="publish-plugin">
      <h1>Publish Plugin</h1>
      
      <FileUpload
        accept=".zip"
        onUpload={file => publishMutation.mutate(file)}
      />
      
      <div className="guidelines">
        <h3>Plugin Requirements</h3>
        <ul>
          <li>Valid manifest.json</li>
          <li>Backend assembly must implement IPlugin</li>
          <li>Frontend must export FrontendPlugin</li>
          <li>README.md with documentation</li>
          <li>Passes automated security scan</li>
        </ul>
      </div>
    </div>
  );
}
```

---

## Part 6: Plugin Development CLI

```bash
# Install CLI
npm install -g @minicluster/plugin-cli
# or
dotnet tool install -g MiniCluster.PluginCli

# Create new plugin
minicluster-plugin new my-plugin --category proxy
# Creates:
# my-plugin/
# ├── manifest.json
# ├── backend/
# │   └── MyPlugin.cs
# ├── frontend/
# │   └── src/
# │       └── index.tsx
# └── README.md

# Build plugin
minicluster-plugin build

# Test locally
minicluster-plugin dev
# Starts local MiniCluster with plugin hot-reload

# Package for distribution
minicluster-plugin pack
# Creates my-plugin-1.0.0.zip

# Publish to marketplace
minicluster-plugin publish --api-key <key>
```

---

## API Endpoints (Updated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Registry** |||
| GET | `/api/plugins/available` | List available plugins |
| GET | `/api/plugins/search?q=nginx` | Search plugins |
| GET | `/api/marketplace/plugins` | Browse marketplace |
| GET | `/api/marketplace/plugins/{id}` | Plugin details |
| GET | `/api/marketplace/plugins/{id}/download` | Download plugin |
| **Installation** |||
| POST | `/api/plugins/install` | Install from marketplace |
| POST | `/api/plugins/install/local` | Install from file |
| DELETE | `/api/plugins/installed/{id}` | Uninstall |
| GET | `/api/plugins/installed` | List installed |
| **Lifecycle** |||
| POST | `/api/plugins/installed/{id}/start` | Start |
| POST | `/api/plugins/installed/{id}/stop` | Stop |
| POST | `/api/plugins/installed/{id}/restart` | Restart |
| **Plugin API** |||
| * | `/api/plugins/{pluginId}/*` | Plugin-defined routes |

---

## UI Extension Points

```tsx
// Host provides extension points
const EXTENSION_POINTS = {
  // Dashboard widgets
  'dashboard.widgets': [],
  
  // Settings sections
  'settings.sections': [],
  
  // App detail tabs
  'app.detail.tabs': [],
  
  // Navigation items
  'nav.items': [],
  
  // Context menus
  'contextmenu.app': [],
  'contextmenu.service': [],
  
  // Toolbar actions
  'toolbar.actions': [],
};

// Plugin registers
export const plugin: FrontendPlugin = {
  // ...
  extensions: {
    'dashboard.widgets': [
      { component: NginxWidget, priority: 10 }
    ],
    'app.detail.tabs': [
      { id: 'proxy', label: 'Proxy', component: ProxyTab }
    ]
  }
};
```

---

## Estimated Effort (Updated)

| Phase | Effort |
|-------|--------|
| Backend plugin SDK | 3 weeks |
| Frontend plugin SDK | 3 weeks |
| Plugin loader & sandboxing | 2 weeks |
| CLI & dev tools | 2 weeks |
| Marketplace | 2 weeks |
| **Total** | **12 weeks** |

---

## Open Source Strategy

| Component | License | Reason |
|-----------|---------|--------|
| Plugin SDK | MIT | Encourage adoption |
| Core plugins | MIT | Reference implementations |
| Plugin CLI | MIT | Developer tooling |
| Marketplace | Proprietary* | Revenue potential |

*Consider: Free for open-source plugins, paid tier for commercial plugins

---

## Dependencies
- Feature 003 (Authentication) - for API keys
- Feature 005 (Reliability) - health checks apply to plugins
