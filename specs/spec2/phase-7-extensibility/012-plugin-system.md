# 012: Plugin System

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 7 - Extensibility  
**Priority:** 🟡 HIGH  
**Effort:** 12 weeks  
**Original Spec:** [../spec/012-plugin-system/spec.md](../../spec/012-plugin-system/spec.md)

---

## Summary

**Open plugin architecture** for backend (.NET) and frontend (React) plugins. Third-party developers can create and distribute plugins through the marketplace. Major platform differentiator and revenue opportunity.

## Key Features ⬜

### 1. Backend Plugin SDK (3 weeks)
- ⬜ **IPlugin interface** - Standard plugin contract
- ⬜ **IPluginContext** - Access to MiniCluster services
- ⬜ **Service registration** - Plugins add services to DI
- ⬜ **Route registration** - Plugins expose API endpoints
- ⬜ **AssemblyLoadContext isolation** - Plugin sandboxing
- ⬜ **Plugin lifecycle** - Initialize, load, unload
- ⬜ **NuGet package distribution**

### 2. Frontend Plugin SDK (2 weeks)
- ⬜ **FrontendPlugin type** - React component plugins
- ⬜ **Route registration** - Plugins add UI pages
- ⬜ **Nav item registration** - Appear in sidebar
- ⬜ **Dashboard widgets** - Plugin cards on dashboard
- ⬜ **Settings panels** - Plugin configuration UI
- ⬜ **NPM package distribution**

### 3. Plugin System (3 weeks)
- ⬜ **Plugin manifest** (JSON schema)
- ⬜ **Dependency management** - Plugin dependencies
- ⬜ **Version compatibility** - Require MiniCluster version
- ⬜ **Permission system** - Filesystem, process, network, config
- ⬜ **Plugin installation** - Install from ZIP, URL, marketplace
- ⬜ **Auto-updates** - Check for plugin updates

### 4. Marketplace (2 weeks)
- ⬜ **Browse plugins** - Categories, search, ratings
- ⬜ **Install plugins** - One-click installation
- ⬜ **Publish plugins** - Developer submission
- ⬜ **Plugin reviews** - Ratings and comments
- ⬜ **Analytics** - Download counts, usage stats
- ⬜ **Paid plugins** - Payment integration (optional)

### 5. Plugin CLI (1 week)
- ⬜ **`minicluster-plugin new`** - Scaffold new plugin
- ⬜ **`minicluster-plugin build`** - Build plugin package
- ⬜ **`minicluster-plugin dev`** - Hot-reload development
- ⬜ **`minicluster-plugin pack`** - Create distribution package
- ⬜ **`minicluster-plugin publish`** - Publish to marketplace

### 6. Extension Points (1 week)
- ⬜ **Dashboard widgets** - Add cards to home page
- ⬜ **Settings tabs** - Plugin configuration UI
- ⬜ **App detail tabs** - Extra app info/controls
- ⬜ **Toolbar actions** - Custom buttons/actions
- ⬜ **Context menu items** - Right-click options
- ⬜ **Event hooks** - React to app start/stop/etc.

## Plugin Categories

### Proxy Plugins
- ✅ [Caddy](../../spec/012-plugin-system/examples/proxy/caddy.md)
- ✅ [Nginx](../../spec/012-plugin-system/examples/proxy/nginx.md)
- ✅ [Traefik](../../spec/012-plugin-system/examples/proxy/traefik.md)
- ✅ [HAProxy](../../spec/012-plugin-system/examples/proxy/haproxy.md)

### Cache Plugins
- ✅ [Varnish](../../spec/012-plugin-system/examples/cache/varnish.md)
- ✅ [Redis](../../spec/012-plugin-system/examples/cache/redis.md)

### Auth Plugins
- ✅ [Pomerium](../../spec/012-plugin-system/examples/auth/pomerium.md)

### Monitoring Plugins
- ✅ [Prometheus](../../spec/012-plugin-system/examples/monitoring/prometheus.md)

### Database Plugins
- ✅ [PostgreSQL](../../spec/012-plugin-system/examples/database/postgresql.md)

## Why This Matters

**Without Plugins:**
- ❌ MiniCluster team must build everything
- ❌ Can't adapt to specific use cases
- ❌ Limited to built-in features
- ❌ Slow innovation pace

**With Plugins:**
- ✅ Community can extend platform
- ✅ Ecosystem growth
- ✅ Third-party revenue sharing
- ✅ Specialize for industries/use cases
- ✅ **Major competitive differentiator**

## Example Plugin: PostgreSQL Manager

**Backend (C#):**
```csharp
public class PostgreSqlPlugin : IPlugin
{
    public void Initialize(IPluginContext context)
    {
        // Register services
        context.Services.AddSingleton<IPostgreSqlService, PostgreSqlService>();
        
        // Register API routes
        context.Routes.MapGet("/api/plugins/postgresql/databases", GetDatabases);
        context.Routes.MapPost("/api/plugins/postgresql/backup", BackupDatabase);
    }
}
```

**Frontend (React/TypeScript):**
```tsx
export const PostgreSqlPlugin: FrontendPlugin = {
  name: 'postgresql',
  routes: [
    { path: '/plugins/postgresql', component: PostgreSqlDashboard }
  ],
  navItems: [
    { label: 'PostgreSQL', icon: 'database', path: '/plugins/postgresql' }
  ],
  dashboardWidgets: [
    { component: PostgreSqlStatusWidget, order: 5 }
  ]
};
```

**Manifest (plugin.json):**
```json
{
  "id": "innovatek.postgresql",
  "name": "PostgreSQL Manager",
  "version": "1.0.0",
  "author": "Innovatek",
  "description": "Manage PostgreSQL databases",
  "miniclusterVersion": ">=1.0.0",
  "permissions": [
    "filesystem.read",
    "process.start",
    "network.connect"
  ],
  "backend": {
    "assembly": "Innovatek.MiniCluster.PostgreSql.dll",
    "entryPoint": "PostgreSqlPlugin"
  },
  "frontend": {
    "bundle": "dist/postgresql-plugin.js"
  },
  "configuration": {
    "dataDirectory": "/var/lib/postgresql",
    "port": 5432
  },
  "dependencies": {
    "npgsql": ">=7.0.0"
  }
}
```

## Technical Design

### Plugin Isolation

**Backend:**
- Each plugin loaded in separate `AssemblyLoadContext`
- Plugins can't access other plugin internals
- Controlled API surface via `IPluginContext`

**Frontend:**
- Plugins loaded as separate JS bundles
- React context for plugin communication
- Sandboxed iframe for untrusted plugins (optional)

### Permission System
```json
{
  "permissions": [
    "filesystem.read:/apps",      // Read specific paths
    "filesystem.write:/data",     // Write specific paths
    "process.start",              // Start processes
    "process.stop",               // Stop processes
    "network.connect:5432",       // Connect to specific ports
    "database.read",              // Read database
    "database.write",             // Write database
    "api.call:proxy",             // Call proxy APIs
    "config.read",                // Read system config
    "config.write"                // Write system config
  ]
}
```

### Database Schema
```sql
-- Installed plugins
CREATE TABLE Plugins (
  Id INTEGER PRIMARY KEY,
  PluginId VARCHAR(255) UNIQUE, -- "innovatek.postgresql"
  Name VARCHAR(255),
  Version VARCHAR(50),
  Author VARCHAR(255),
  Enabled BOOLEAN DEFAULT 1,
  InstalledAt DATETIME,
  UpdatedAt DATETIME,
  ManifestJson TEXT,
  ConfigJson TEXT
);

-- Marketplace plugins
CREATE TABLE MarketplacePlugins (
  Id INTEGER PRIMARY KEY,
  PluginId VARCHAR(255) UNIQUE,
  Name VARCHAR(255),
  Category VARCHAR(50),
  Description TEXT,
  Author VARCHAR(255),
  LatestVersion VARCHAR(50),
  Downloads INT DEFAULT 0,
  Rating DECIMAL(3,2),
  PackageUrl VARCHAR(1024),
  IconUrl VARCHAR(1024)
);
```

### API Endpoints
```
-- Plugin management
GET    /api/plugins                  - List installed plugins
POST   /api/plugins/install          - Install plugin
PUT    /api/plugins/:id/enable       - Enable plugin
PUT    /api/plugins/:id/disable      - Disable plugin
DELETE /api/plugins/:id              - Uninstall plugin
PUT    /api/plugins/:id/config       - Update plugin config

-- Marketplace
GET    /api/marketplace/plugins      - Browse marketplace
GET    /api/marketplace/plugins/:id  - Plugin details
POST   /api/marketplace/publish      - Publish plugin
PUT    /api/marketplace/plugins/:id  - Update listing
POST   /api/marketplace/review       - Add review
GET    /api/marketplace/updates      - Check for updates
```

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Backend SDK (IPlugin, IPluginContext) | 3 |
| 2 | Frontend SDK (React plugins) | 2 |
| 3 | Plugin system (manifest, loading, isolation) | 3 |
| 4 | Marketplace (browse, install) | 2 |
| 5 | Plugin CLI (scaffolding, build) | 1 |
| 6 | Extension points (widgets, tabs) | 1 |

**Total:** 12 weeks

## Developer Experience

### Creating a Plugin

1. **Scaffold:**
   ```bash
   npx @minicluster/plugin-cli new my-plugin
   cd my-plugin
   ```

2. **Develop:**
   - Backend: `src/Backend/MyPlugin.cs`
   - Frontend: `src/Frontend/MyPlugin.tsx`
   - Manifest: `plugin.json`

3. **Build:**
   ```bash
   minicluster-plugin build
   ```

4. **Test:**
   ```bash
   minicluster-plugin dev
   # Hot-reload development against local MiniCluster
   ```

5. **Publish:**
   ```bash
   minicluster-plugin pack
   minicluster-plugin publish
   ```

## Business Model

### For MiniCluster
- **30% marketplace fee** on paid plugins
- **Certified plugins** - Premium badge for $99/year
- **Enterprise plugin registry** - Private marketplace for enterprises

### For Plugin Developers
- **Free plugins** - Build reputation, drive consulting
- **Paid plugins** - $5-$500 one-time or subscription
- **Custom plugins** - Client work, proprietary solutions

## Dependencies

- **Recommended:** All core features stable before opening to third parties

## Related Features

- **Enhanced by:** 013 Analytics (plugin usage metrics)
- **Works with:** All features (plugins can extend anything)

---

For complete details, see the [full plugin system spec](../../spec/012-plugin-system/spec.md).
