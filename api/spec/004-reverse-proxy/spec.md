# Feature 004: Reverse Proxy for Internal Services

## Overview

Add reverse proxy capabilities to MiniCluster to provide secure, centralized access to internal services (Seq, Grafana, RabbitMQ Management, internal APIs, etc.) without exposing multiple ports or requiring direct network access.

---

## Technology Decision: YARP (Recommended)

**YARP (Yet Another Reverse Proxy)** is Microsoft's official reverse proxy library and is the recommended implementation approach.

### Why YARP?

| Feature | YARP | Custom Implementation |
|---------|------|----------------------|
| HTTP/HTTPS forwarding | ✅ Built-in | 8+ hours |
| WebSocket proxy | ✅ Built-in | 5+ hours |
| Header forwarding | ✅ Built-in | 2+ hours |
| Streaming/large files | ✅ Built-in | 3+ hours |
| Health checks | ✅ Built-in | 3+ hours |
| Load balancing | ✅ Bonus | N/A |
| Connection pooling | ✅ Built-in | 2+ hours |
| Request transforms | ✅ Built-in | 4+ hours |
| Retry policies | ✅ Built-in | 2+ hours |
| **Total Effort Saved** | | **~30 hours** |

### YARP Package

```xml
<PackageReference Include="Yarp.ReverseProxy" Version="2.1.0" />
```

### What YARP Handles

```
┌─────────────────────────────────────────────────────────────────┐
│                         YARP Handles                             │
├─────────────────────────────────────────────────────────────────┤
│ ✅ HTTP/1.1, HTTP/2, HTTP/3                                      │
│ ✅ WebSocket connections                                         │
│ ✅ Server-Sent Events (SSE)                                      │
│ ✅ Large file streaming                                          │
│ ✅ Header forwarding (X-Forwarded-*)                             │
│ ✅ Request/response body streaming                               │
│ ✅ Connection keep-alive and pooling                             │
│ ✅ Timeout handling                                              │
│ ✅ Health probes                                                 │
│ ✅ Path transforms (strip/add prefix)                            │
│ ✅ Header transforms                                             │
└─────────────────────────────────────────────────────────────────┘
```

### What We Still Need to Build

```
┌─────────────────────────────────────────────────────────────────┐
│                      Custom Implementation                       │
├─────────────────────────────────────────────────────────────────┤
│ 🔧 Database-driven configuration provider                        │
│ 🔧 Dynamic route reload on DB changes                           │
│ 🔧 URL rewriting in HTML/CSS/JS (path-prefix mode)              │
│ 🔧 Authentication middleware integration                         │
│ 🔧 Multi-port listener management                                │
│ 🔧 CRUD API for proxy routes                                     │
│ 🔧 UI for configuration                                          │
└─────────────────────────────────────────────────────────────────┘
```

### YARP Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MiniCluster API                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐    ┌────────────────┐    ┌───────────────┐ │
│  │ Auth Middleware │───▶│ Proxy Auth    │───▶│     YARP      │ │
│  │ (existing JWT)  │    │ (route-based) │    │ Reverse Proxy │ │
│  └────────────────┘    └────────────────┘    └───────┬───────┘ │
│                                                       │         │
│  ┌────────────────────────────────────────────────────┴───────┐ │
│  │              DatabaseProxyConfigProvider                    │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │ - Loads RouteConfig[] from SQLite                   │   │ │
│  │  │ - Loads ClusterConfig[] from SQLite                 │   │ │
│  │  │ - Watches for DB changes → triggers reload          │   │ │
│  │  │ - Generates routes for: path-prefix, subdomain      │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           UrlRewriteTransformProvider (Custom)              │ │
│  │  - Rewrites HTML/CSS/JS for path-prefix mode               │ │
│  │  - Strips X-Frame-Options for iframe mode                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### YARP Configuration Examples

**Path Prefix Route:**
```csharp
new RouteConfig
{
    RouteId = "seq-path",
    ClusterId = "seq-cluster",
    Match = new RouteMatch 
    { 
        Path = "/proxy/seq/{**catch-all}" 
    },
    Transforms = new List<Dictionary<string, string>>
    {
        new() { { "PathRemovePrefix", "/proxy/seq" } },
        new() { { "RequestHeader", "X-Forwarded-Prefix" }, { "Set", "/proxy/seq" } }
    }
}
```

**Subdomain Route:**
```csharp
new RouteConfig
{
    RouteId = "seq-subdomain",
    ClusterId = "seq-cluster",
    Match = new RouteMatch 
    { 
        Hosts = new[] { "seq.192.168.1.50.nip.io", "seq.*.nip.io" },
        Path = "{**catch-all}" 
    }
}
```

**Cluster (Target):**
```csharp
new ClusterConfig
{
    ClusterId = "seq-cluster",
    Destinations = new Dictionary<string, DestinationConfig>
    {
        { "seq", new DestinationConfig { Address = "http://localhost:5341" } }
    },
    HealthCheck = new HealthCheckConfig
    {
        Active = new ActiveHealthCheckConfig
        {
            Enabled = true,
            Interval = TimeSpan.FromSeconds(30),
            Path = "/"
        }
    }
}
```

### Database Config Provider

```csharp
public class DatabaseProxyConfigProvider : IProxyConfigProvider, IDisposable
{
    private readonly IServiceProvider _services;
    private CancellationTokenSource _changeToken = new();
    
    public IProxyConfig GetConfig()
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        var proxyRoutes = db.ProxyRoutes.Where(r => r.IsEnabled).ToList();
        
        var routes = new List<RouteConfig>();
        var clusters = new List<ClusterConfig>();
        
        foreach (var route in proxyRoutes)
        {
            // Add cluster for this target
            clusters.Add(CreateCluster(route));
            
            // Add routes based on enabled access methods
            if (route.EnablePathPrefix)
                routes.Add(CreatePathPrefixRoute(route));
            
            if (route.EnableSubdomain)
                routes.Add(CreateSubdomainRoute(route));
        }
        
        return new DatabaseProxyConfig(routes, clusters, _changeToken.Token);
    }
    
    // Call when proxy routes change in database
    public void SignalChange()
    {
        var oldToken = _changeToken;
        _changeToken = new CancellationTokenSource();
        oldToken.Cancel();
    }
}
```

### Time Savings Summary

| Component | Without YARP | With YARP |
|-----------|--------------|-----------|
| Core proxy engine | 20 hours | 2 hours (config) |
| WebSocket support | 7 hours | 0 hours |
| Health checks | 4 hours | 1 hour (config) |
| Header handling | 4 hours | 0 hours |
| Path transforms | 4 hours | 1 hour (config) |
| URL rewriting (HTML) | 6 hours | 6 hours (still needed) |
| Auth integration | 3 hours | 3 hours |
| Database provider | 0 hours | 4 hours (new) |
| **Total** | **~48 hours** | **~17 hours** |

**Savings: ~31 hours (~4 days)**

---

## Problem Statement

Internal services run on various ports and are only accessible from the server or internal network:
- Seq: `http://localhost:5341`
- RabbitMQ Management: `http://localhost:15672`
- Grafana: `http://localhost:3000`
- Internal APIs: Various ports

**Current Pain Points:**
1. Need VPN or direct server access to reach these services
2. Multiple ports to remember and manage
3. No centralized authentication
4. No audit trail of who accessed what
5. Firewall rules for each service

**Solution:**
MiniCluster acts as a reverse proxy, providing multiple access methods with unified authentication.

---

## Access Methods

This feature supports **four access methods** to accommodate different use cases and compatibility requirements:

| Method | URL Example | Compatibility | DNS Required | Use Case |
|--------|-------------|---------------|--------------|----------|
| **Path Prefix** | `/proxy/seq/...` | Medium | No | Quick access, simple UIs |
| **Subdomain** | `seq.192.168.1.50.nip.io:5000` | Full | No (nip.io) | Complex apps, SPAs |
| **Port-Based** | `192.168.1.50:5001` | Full | No | Fallback, maximum compat |
| **Embedded (Iframe)** | In MiniCluster UI | Medium | No | Quick glances |

---

## Method 1: Path Prefix Proxy

### How It Works

```
Request:  GET http://minicluster:5000/proxy/seq/api/events
                                      └──────┘ └─────────┘
                                       prefix   path

Proxy:    GET http://localhost:5341/api/events
```

### URL Rewriting (Required for Compatibility)

Since internal apps use absolute paths, the proxy must rewrite URLs in responses:

**Original Response from Seq:**
```html
<!DOCTYPE html>
<html>
<head>
    <link href="/css/style.css" rel="stylesheet">
    <script src="/js/app.js"></script>
</head>
<body>
    <a href="/events">Events</a>
</body>
</html>
```

**Rewritten Response:**
```html
<!DOCTYPE html>
<html>
<head>
    <link href="/proxy/seq/css/style.css" rel="stylesheet">
    <script src="/proxy/seq/js/app.js"></script>
</head>
<body>
    <a href="/proxy/seq/events">Events</a>
</body>
</html>
```

### What Must Be Rewritten

| Content Type | Pattern | Rewrite |
|--------------|---------|---------|
| HTML attributes | `href="/..."`, `src="/..."`, `action="/..."` | Prefix with `/proxy/{name}` |
| CSS | `url(/images/...)` | Prefix path |
| JavaScript | `fetch('/api/...')`, `'/path'` | Prefix (best effort) |
| HTTP Headers | `Location: /login` | `Location: /proxy/{name}/login` |
| Cookies | `Path=/` | `Path=/proxy/{name}` |
| WebSocket | `ws://host/hub` | `ws://host/proxy/{name}/hub` |

### Limitations

- **Complex SPAs**: Apps that dynamically construct URLs in JavaScript may not work
- **WebSocket URLs**: Hard to catch all WebSocket connection strings
- **Hardcoded checks**: Apps that check `window.location.pathname` may fail
- **Binary content**: Images, fonts, etc. pass through unchanged

### Best For

- Simple web UIs and dashboards
- Documentation sites
- Static content
- APIs (no URL rewriting needed for JSON)

---

## Method 2: Subdomain Proxy (Full Compatibility)

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser: http://seq.192.168.1.50.nip.io:5000/api/events        │
│                 └─┘ └───────────────┘                           │
│              subdomain    nip.io resolves to 192.168.1.50       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ MiniCluster receives request                                     │
│                                                                  │
│ Host header: seq.192.168.1.50.nip.io:5000                       │
│ Extract subdomain: "seq"                                         │
│ Lookup proxy config: seq → http://localhost:5341                │
│ Forward request as-is to target                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Seq (localhost:5341)                                             │
│                                                                  │
│ Receives: GET /api/events                                        │
│ No URL issues - paths work correctly!                            │
└─────────────────────────────────────────────────────────────────┘
```

### Why It Works

When using subdomains, the target app's root is the proxy's root:

```
App thinks:     /js/app.js
Browser loads:  http://seq.192.168.1.50.nip.io:5000/js/app.js
Proxy forwards: http://localhost:5341/js/app.js
✅ Path unchanged, everything works!
```

### Using nip.io / sslip.io

These free services provide wildcard DNS without configuration:

| Service | Pattern | Example |
|---------|---------|---------|
| nip.io | `{subdomain}.{ip}.nip.io` | `seq.192.168.1.50.nip.io` |
| sslip.io | `{subdomain}.{ip}.sslip.io` | `seq.192-168-1-50.sslip.io` |

**No DNS configuration required!**

### Custom Domain Support

For production, users can configure their own domain:

```json
{
  "proxySettings": {
    "baseDomain": "minicluster.company.local",
    "domainType": "custom"
  }
}
```

Then access via: `seq.minicluster.company.local:5000`

(Requires DNS entry: `*.minicluster.company.local → server IP`)

### Host Header Handling

The proxy can optionally modify the Host header sent to the target:

```json
{
  "preserveHostHeader": false,  // Send "localhost:5341" to target
  "preserveHostHeader": true    // Send "seq.192.168.1.50.nip.io:5000" to target
}
```

Most apps work with `preserveHostHeader: false`.

---

## Method 3: Port-Based Proxy

### How It Works

Each proxy route gets a dedicated port:

```
MiniCluster API:  :5000
Seq proxy:        :5001 → localhost:5341
RabbitMQ proxy:   :5002 → localhost:15672
Grafana proxy:    :5003 → localhost:3000
```

### Implementation Options

**Option A: MiniCluster Listens on Multiple Ports**
```csharp
// In Program.cs
builder.WebHost.UseUrls("http://0.0.0.0:5000", "http://0.0.0.0:5001", "http://0.0.0.0:5002");
```

**Option B: Dynamic Port Binding**
- Start additional Kestrel listeners dynamically
- More complex but allows runtime configuration

**Option C: Use YARP with Multiple Endpoints**
- Configure YARP to listen on multiple ports
- Each port routes to a different target

### Advantages

- No DNS whatsoever
- Maximum compatibility (same as subdomain)
- Works in restricted network environments
- Simple to understand

### Disadvantages

- Multiple ports to manage
- More firewall rules
- Less elegant URLs
- Port conflicts possible

---

## Method 4: Embedded Iframe Mode

### How It Works

Display proxied content inside MiniCluster UI:

```
┌─────────────────────────────────────────────────────────────────┐
│ MiniCluster                              [Home] [Apps] [Proxies]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────┐  ┌─────────────────────────────────────────────────┐│
│ │ 📊 Seq  │  │ ┌─────────────────────────────────────────────┐ ││
│ │ 📈 Graf │  │ │                                             │ ││
│ │ 🐰 Rabbit│ │ │         Seq UI in iframe                   │ ││
│ │         │  │ │     (loaded via port proxy internally)     │ ││
│ │         │  │ │                                             │ ││
│ │         │  │ └─────────────────────────────────────────────┘ ││
│ └─────────┘  │                                   [Open in Tab] ││
│              └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Security Considerations

- Iframe loads from port-proxy URL (same authentication)
- X-Frame-Options must be handled
- May need to strip `X-Frame-Options` header from target responses

### Limitations

- Some apps prevent iframe embedding
- Size constraints
- Cannot do certain interactions (downloads, popups)

### Configuration

```json
{
  "enableIframe": true,
  "stripXFrameOptions": true,  // Remove X-Frame-Options from target response
  "iframeHeight": "800px"
}
```

---

## Data Model

### ProxyRoute Entity

```csharp
public class ProxyRoute
{
    public int Id { get; set; }
    
    // Basic Info
    public string Name { get; set; }              // "Seq Logs"
    public string Description { get; set; }       // "Centralized logging"
    public string Icon { get; set; }              // "📊" or URL
    public string TargetUrl { get; set; }         // "http://localhost:5341"
    
    // Path Prefix Mode
    public bool EnablePathPrefix { get; set; }    // true/false
    public string PathPrefix { get; set; }        // "seq" → /proxy/seq
    public bool RewriteUrls { get; set; }         // Attempt URL rewriting
    public bool RewriteWebSocket { get; set; }    // Rewrite WS URLs
    
    // Subdomain Mode  
    public bool EnableSubdomain { get; set; }     // true/false
    public string Subdomain { get; set; }         // "seq"
    
    // Port Mode
    public bool EnablePort { get; set; }          // true/false
    public int? ProxyPort { get; set; }           // 5001
    
    // Iframe Mode
    public bool EnableIframe { get; set; }        // true/false
    public bool StripXFrameOptions { get; set; }  // Remove X-Frame-Options
    
    // Security
    public bool RequireAuth { get; set; }         // Require authentication
    public string AllowedRoles { get; set; }      // "Admin,Developer" (comma-separated)
    
    // Advanced Options
    public bool PreserveHostHeader { get; set; }  // Send original Host to target
    public int TimeoutSeconds { get; set; }       // Request timeout
    public Dictionary<string, string> CustomHeaders { get; set; }  // Add headers to requests
    
    // Metadata
    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
```

### ProxySettings Entity (Global Configuration)

```csharp
public class ProxySettings
{
    public int Id { get; set; }
    
    // Subdomain Configuration
    public string BaseDomainType { get; set; }    // "nip.io", "sslip.io", "custom"
    public string CustomBaseDomain { get; set; }  // "minicluster.company.local"
    
    // Port Range (for port-based proxies)
    public int PortRangeStart { get; set; }       // 5001
    public int PortRangeEnd { get; set; }         // 5099
    
    // Security Defaults
    public bool DefaultRequireAuth { get; set; }  // Default for new proxies
    
    // Server IP (for nip.io URLs)
    public string ServerIp { get; set; }          // Auto-detected or manual
}
```

---

## Database Schema

```sql
CREATE TABLE ProxyRoutes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Description TEXT,
    Icon TEXT,
    TargetUrl TEXT NOT NULL,
    
    -- Path Prefix Mode
    EnablePathPrefix INTEGER DEFAULT 0,
    PathPrefix TEXT,
    RewriteUrls INTEGER DEFAULT 1,
    RewriteWebSocket INTEGER DEFAULT 1,
    
    -- Subdomain Mode
    EnableSubdomain INTEGER DEFAULT 0,
    Subdomain TEXT,
    
    -- Port Mode
    EnablePort INTEGER DEFAULT 0,
    ProxyPort INTEGER,
    
    -- Iframe Mode
    EnableIframe INTEGER DEFAULT 0,
    StripXFrameOptions INTEGER DEFAULT 1,
    
    -- Security
    RequireAuth INTEGER DEFAULT 1,
    AllowedRoles TEXT,
    
    -- Advanced
    PreserveHostHeader INTEGER DEFAULT 0,
    TimeoutSeconds INTEGER DEFAULT 30,
    CustomHeaders TEXT,  -- JSON
    
    -- Metadata
    IsEnabled INTEGER DEFAULT 1,
    CreatedAt TEXT NOT NULL,
    UpdatedAt TEXT,
    
    UNIQUE(PathPrefix),
    UNIQUE(Subdomain),
    UNIQUE(ProxyPort)
);

CREATE TABLE ProxySettings (
    Id INTEGER PRIMARY KEY,
    BaseDomainType TEXT DEFAULT 'nip.io',
    CustomBaseDomain TEXT,
    PortRangeStart INTEGER DEFAULT 5001,
    PortRangeEnd INTEGER DEFAULT 5099,
    DefaultRequireAuth INTEGER DEFAULT 1,
    ServerIp TEXT
);
```

---

## API Endpoints

### Proxy Routes Management

```
GET    /api/proxy-routes              # List all proxy routes
GET    /api/proxy-routes/{id}         # Get specific route
POST   /api/proxy-routes              # Create new route
PUT    /api/proxy-routes/{id}         # Update route
DELETE /api/proxy-routes/{id}         # Delete route
POST   /api/proxy-routes/{id}/test    # Test connectivity to target
```

### Proxy Settings

```
GET    /api/proxy-settings            # Get global proxy settings
PUT    /api/proxy-settings            # Update settings
GET    /api/proxy-settings/server-ip  # Get detected server IP
```

### Proxy Access URLs

```
GET    /api/proxy-routes/{id}/urls    # Get all access URLs for a route
```

Response:
```json
{
  "id": 1,
  "name": "Seq Logs",
  "urls": {
    "pathPrefix": "http://192.168.1.50:5000/proxy/seq",
    "subdomain": "http://seq.192.168.1.50.nip.io:5000",
    "port": "http://192.168.1.50:5001",
    "iframe": "/proxies/1/embed"
  },
  "recommended": "subdomain",
  "warnings": {
    "pathPrefix": "URL rewriting enabled. Some features may not work with complex SPAs."
  }
}
```

---

## Request/Response DTOs

### CreateProxyRouteDto

```csharp
public class CreateProxyRouteDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; }
    
    [StringLength(500)]
    public string Description { get; set; }
    
    [StringLength(50)]
    public string Icon { get; set; }
    
    [Required]
    [Url]
    public string TargetUrl { get; set; }
    
    // Access Methods
    public bool EnablePathPrefix { get; set; }
    
    [StringLength(50)]
    [RegularExpression(@"^[a-z0-9-]+$")]
    public string PathPrefix { get; set; }
    
    public bool RewriteUrls { get; set; } = true;
    
    public bool EnableSubdomain { get; set; }
    
    [StringLength(50)]
    [RegularExpression(@"^[a-z0-9-]+$")]
    public string Subdomain { get; set; }
    
    public bool EnablePort { get; set; }
    
    [Range(1024, 65535)]
    public int? ProxyPort { get; set; }
    
    public bool EnableIframe { get; set; }
    
    // Security
    public bool RequireAuth { get; set; } = true;
    public List<string> AllowedRoles { get; set; }
    
    // Advanced
    public int TimeoutSeconds { get; set; } = 30;
    public Dictionary<string, string> CustomHeaders { get; set; }
}
```

### ProxyRouteDto (Response)

```csharp
public class ProxyRouteDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Icon { get; set; }
    public string TargetUrl { get; set; }
    
    // Access Methods Status
    public PathPrefixConfig PathPrefix { get; set; }
    public SubdomainConfig Subdomain { get; set; }
    public PortConfig Port { get; set; }
    public IframeConfig Iframe { get; set; }
    
    // Security
    public bool RequireAuth { get; set; }
    public List<string> AllowedRoles { get; set; }
    
    // Status
    public bool IsEnabled { get; set; }
    public bool IsHealthy { get; set; }  // Last health check result
    public DateTime? LastHealthCheck { get; set; }
    
    // Generated URLs
    public ProxyUrlsDto Urls { get; set; }
}

public class PathPrefixConfig
{
    public bool Enabled { get; set; }
    public string Prefix { get; set; }
    public bool RewriteUrls { get; set; }
    public string Url { get; set; }  // Generated URL
}

public class SubdomainConfig
{
    public bool Enabled { get; set; }
    public string Subdomain { get; set; }
    public string Url { get; set; }  // Generated URL
}

public class PortConfig
{
    public bool Enabled { get; set; }
    public int? Port { get; set; }
    public string Url { get; set; }  // Generated URL
}

public class IframeConfig
{
    public bool Enabled { get; set; }
    public string EmbedUrl { get; set; }  // Internal embed URL
}
```

---

## Proxy Middleware Implementation

### Path Prefix Proxy

```
Request Flow:
1. Request arrives at /proxy/{prefix}/{path}
2. Middleware matches route by prefix
3. Check authentication if required
4. Forward request to target (strip prefix from path)
5. Receive response from target
6. If HTML/CSS/JS: Rewrite URLs
7. If redirect: Rewrite Location header
8. Return modified response
```

### Subdomain Proxy

```
Request Flow:
1. Request arrives with Host header containing subdomain
2. Middleware extracts subdomain from Host
3. Lookup route by subdomain
4. Check authentication if required
5. Forward request to target as-is
6. Return response unchanged
```

### Port Proxy

```
Request Flow:
1. Request arrives on specific port (e.g., 5001)
2. Middleware maps port to route
3. Check authentication if required
4. Forward request to target
5. Return response unchanged
```

---

## URL Rewriting Engine

### HTML Rewriting

```csharp
public class HtmlUrlRewriter
{
    private readonly string _prefix;
    
    public string Rewrite(string html)
    {
        // Patterns to rewrite:
        // href="/..."  → href="/proxy/{prefix}/..."
        // src="/..."   → src="/proxy/{prefix}/..."
        // action="/..." → action="/proxy/{prefix}/..."
        // srcset="/..." → srcset="/proxy/{prefix}/..."
        
        // Use HTML parser (AngleSharp) for accuracy
        // Regex fallback for performance
    }
}
```

### JavaScript Rewriting (Best Effort)

```csharp
public class JsUrlRewriter
{
    public string Rewrite(string js)
    {
        // Attempt to rewrite common patterns:
        // fetch('/api/...')
        // '/path'
        // "/path"
        // `${baseUrl}/path`
        
        // WARNING: This is fragile and may break code
        // Only enabled when RewriteUrls = true
    }
}
```

### Header Rewriting

```csharp
public class HeaderRewriter
{
    public void RewriteResponseHeaders(HttpResponseMessage response, string prefix)
    {
        // Location header (redirects)
        if (response.Headers.Location != null)
        {
            var location = response.Headers.Location;
            if (location.IsAbsoluteUri == false || location.Host == targetHost)
            {
                response.Headers.Location = new Uri($"/proxy/{prefix}{location.PathAndQuery}", UriKind.Relative);
            }
        }
        
        // Set-Cookie Path attribute
        foreach (var cookie in response.Headers.GetValues("Set-Cookie"))
        {
            // Rewrite Path=/ to Path=/proxy/{prefix}
        }
    }
}
```

---

## Authentication Integration

### Flow for Protected Proxies

```
1. User requests proxy URL (any method)
2. Proxy middleware checks RequireAuth flag
3. If RequireAuth:
   a. Check for valid JWT (cookie or header)
   b. If no JWT: Redirect to login (path) or return 401 (API)
   c. Validate JWT and extract user/roles
   d. Check AllowedRoles if specified
   e. If role mismatch: Return 403 Forbidden
4. If authenticated or no auth required:
   a. Forward request to target
   b. Return response
```

### JWT Handling for Subdomains

For subdomain proxies, JWT cookie must be accessible:

```csharp
// Cookie must be set with domain that covers subdomains
options.Cookie.Domain = ".192.168.1.50.nip.io";  // Note leading dot

// Or use header-based JWT for more control
```

---

## Low-Fidelity UI Wireframes

### Navigation Integration

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [📱Apps] [📁Files] [🔌Proxies] [💻Term] [📊Monitor] [⚙️]│
│                                                              admin ▼  🔔 │
└──────────────────────────────────────────────────────────────────────────┘
                              ↑
                      NEW: Proxies link added to top nav
```

---

### Screen 1: Proxy Routes List (Empty State)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                  ┌─────────────────────────────────────────────┐        │
│                  │                                             │        │
│                  │           🔌                                │        │
│                  │                                             │        │
│                  │    No proxy routes configured               │        │
│                  │                                             │        │
│                  │    Proxy routes let you access internal     │        │
│                  │    services like Seq, Grafana, RabbitMQ     │        │
│                  │    through MiniCluster.                     │        │
│                  │                                             │        │
│                  │         [ + Add Proxy Route ]               │        │
│                  │                                             │        │
│                  └─────────────────────────────────────────────┘        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 2: Proxy Routes List (With Data)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Proxy Routes                                           [ + Add Route ] │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📊  Seq Logs                                           ● Online    │ │
│  │     http://localhost:5341                                          │ │
│  │     [Path] [Subdomain] [Port] [Embed]     🔒 Admin, Dev   [Edit][⋮]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🐰  RabbitMQ                                           ● Online    │ │
│  │     http://localhost:15672                                         │ │
│  │     [Path] [Subdomain]                        🔒 Admin    [Edit][⋮]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📈  Grafana                                            ○ Offline   │ │
│  │     http://localhost:3000                                          │ │
│  │     [Subdomain] [Port]                        🔓 Public   [Edit][⋮]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Add/Edit Proxy Route Form

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Add Proxy Route                                                         │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                          │
│  [ Basic ]  [ Access Methods ]  [ Security ]  [ Advanced ]              │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  Name *              [Seq Logs________________________]                 │
│  Description         [Centralized logging_____________]                 │
│  Icon                [📊]                                               │
│  Target URL *        [http://localhost:5341___________]  [Test ▶]       │
│                      ✓ Target is reachable (45ms)                       │
│                                                                          │
│                                          [ Cancel ]  [ Next: Access → ] │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 4: Access Methods Tab

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ Basic ]  [ Access Methods ]  [ Security ]  [ Advanced ]              │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Path Prefix                                                  │   │
│  │     /proxy/[seq____]  →  http://192.168.1.50:5000/proxy/seq     │   │
│  │     [✓] Rewrite URLs   ⚠️ May not work with complex SPAs        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Subdomain (Recommended)                                      │   │
│  │     [seq____].192.168.1.50.nip.io                                │   │
│  │     ✓ Full compatibility                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [ ] Dedicated Port    [5001]  →  http://192.168.1.50:5001       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Embed in MiniCluster UI   [✓] Strip X-Frame-Options         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                    [ ← Back ]  [ Next: Security → ]     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 5: Proxy Route Detail (Access URLs)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ← Back    📊 Seq Logs                               ● Online   [Edit]  │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Target: http://localhost:5341                                           │
│                                                                          │
│  Access URLs:                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 📁 Path:      http://192.168.1.50:5000/proxy/seq       [📋][↗]  │   │
│  │               ⚠️ URL rewriting - may not work with SPAs          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🌐 Subdomain: http://seq.192.168.1.50.nip.io:5000 ⭐  [📋][↗]  │   │
│  │               ✓ Full compatibility (Recommended)                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🖼️ Embedded:  [ Open in Panel ]                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Security: 🔒 Auth Required (Admin, Developer)                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 6: Embedded Proxy View (Iframe)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│  📊 Seq Logs                                          [ ↗ Open in Tab ] │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │                                                                      ││
│ │                    ╔════════════════════════════════╗                ││
│ │                    ║                                ║                ││
│ │                    ║         SEQ LOGS UI            ║                ││
│ │                    ║      (loaded in iframe)        ║                ││
│ │                    ║                                ║                ││
│ │                    ║  [Events] [Query] [Settings]   ║                ││
│ │                    ║                                ║                ││
│ │                    ╚════════════════════════════════╝                ││
│ │                                                                      ││
│ └──────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 7: Global Proxy Settings

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔷 MiniCluster    [Apps] [Files] [Proxies] [Term] [Monitor]  admin ▼ 🔔 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Settings > Proxy Configuration                                          │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                          │
│  Server IP: 192.168.1.50                                    [Refresh]   │
│                                                                          │
│  Subdomain DNS:                                                          │
│  (●) nip.io     →  seq.192.168.1.50.nip.io                              │
│  ( ) sslip.io   →  seq.192-168-1-50.sslip.io                            │
│  ( ) Custom     →  seq.[__________________]                              │
│                                                                          │
│  Port Range:  [5001] to [5099]    Used: 2 of 99                         │
│                                                                          │
│  [✓] Require auth by default                                             │
│                                                                          │
│                                           [ Cancel ]  [ Save Settings ] │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Proxy Routes List Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Proxy Routes                                            [+ Add New] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📊 Seq Logs                                    ● Healthy        │ │
│ │ http://localhost:5341                                           │ │
│ │                                                                  │ │
│ │ Access:  [Path] [Subdomain] [Port] [Embed]                      │ │
│ │ 🔒 Auth Required (Admin, Developer)                             │ │
│ │                                                   [Edit] [Delete]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🐰 RabbitMQ Management                         ● Healthy        │ │
│ │ http://localhost:15672                                          │ │
│ │                                                                  │ │
│ │ Access:  [Path] [Subdomain] [Port]                              │ │
│ │ 🔒 Auth Required (Admin)                                        │ │
│ │                                                   [Edit] [Delete]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Proxy Route Detail / Access URLs

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Seq Logs                                                         │
│ Centralized logging dashboard                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Target: http://localhost:5341                          ● Healthy    │
│                                                                      │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│ Access Methods:                                                      │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📁 Path Prefix                                                 │   │
│ │ http://192.168.1.50:5000/proxy/seq                    [Copy]  │   │
│ │ ⚠️ URL rewriting enabled. May not work with complex SPAs.     │   │
│ │                                                      [Open →] │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🌐 Subdomain (Recommended)                                     │   │
│ │ http://seq.192.168.1.50.nip.io:5000                   [Copy]  │   │
│ │ ✅ Full compatibility with all apps                            │   │
│ │                                                      [Open →] │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🔌 Port                                                        │   │
│ │ http://192.168.1.50:5001                              [Copy]  │   │
│ │ ✅ No DNS required. Full compatibility.                        │   │
│ │                                                      [Open →] │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 🖼️ Embedded View                                               │   │
│ │ View Seq logs without leaving MiniCluster                      │   │
│ │                                              [Open in Panel →] │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Add/Edit Proxy Route Form

```
┌─────────────────────────────────────────────────────────────────────┐
│ Add Proxy Route                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Basic Information                                                    │
│ ─────────────────                                                   │
│ Name:         [Seq Logs________________________]                    │
│ Description:  [Centralized logging dashboard___]                    │
│ Icon:         [📊] (emoji or image URL)                             │
│ Target URL:   [http://localhost:5341___________]     [Test ▶]       │
│                                                                      │
│ Access Methods                                                       │
│ ──────────────                                                      │
│ ☑ Path Prefix                                                       │
│   Prefix: /proxy/[seq_______]                                       │
│   ☑ Rewrite URLs in responses                                       │
│   ☐ Rewrite WebSocket URLs (experimental)                           │
│                                                                      │
│ ☑ Subdomain                                                         │
│   Subdomain: [seq_______].192.168.1.50.nip.io                       │
│                                                                      │
│ ☐ Dedicated Port                                                    │
│   Port: [5001____] (5001-5099 available)                            │
│                                                                      │
│ ☑ Embed in MiniCluster UI                                           │
│   ☑ Strip X-Frame-Options header                                    │
│                                                                      │
│ Security                                                             │
│ ────────                                                            │
│ ☑ Require Authentication                                            │
│ Allowed Roles: [Admin, Developer_______________]                    │
│                (leave empty for all authenticated users)            │
│                                                                      │
│ Advanced Options                                                     │
│ ────────────────                                                    │
│ Timeout:       [30___] seconds                                      │
│ ☐ Preserve original Host header                                     │
│ Custom Headers:                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ X-Forwarded-For: {client-ip}                           [+ Add] │ │
│ │ X-Custom-Header: value                                 [Remove] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│                                         [Cancel]   [Save Proxy]     │
└─────────────────────────────────────────────────────────────────────┘
```

### Embedded Proxy View

```
┌─────────────────────────────────────────────────────────────────────┐
│ MiniCluster                                    [Dashboard] [Proxies]│
├───────────┬─────────────────────────────────────────────────────────┤
│ Proxies   │  📊 Seq Logs                            [Open in Tab ↗] │
│           │ ─────────────────────────────────────────────────────── │
│ ├ 📊 Seq  │ ┌─────────────────────────────────────────────────────┐ │
│ ├ 📈 Graf │ │                                                     │ │
│ ├ 🐰 RabbitM │                                                     │ │
│ │         │ │                                                     │ │
│ │         │ │              Seq UI in iframe                       │ │
│ │         │ │          (full functionality)                       │ │
│ │         │ │                                                     │ │
│ │         │ │                                                     │ │
│ │         │ │                                                     │ │
│ │         │ │                                                     │ │
│ │         │ └─────────────────────────────────────────────────────┘ │
│ └─────────┴─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

### Global Proxy Settings

```
┌─────────────────────────────────────────────────────────────────────┐
│ Proxy Settings                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Server Configuration                                                 │
│ ────────────────────                                                │
│ Detected Server IP: 192.168.1.50                         [Refresh]  │
│ ☐ Override IP: [_______________]                                    │
│                                                                      │
│ Subdomain Configuration                                              │
│ ───────────────────────                                             │
│ Domain Type:                                                         │
│ ○ nip.io  (no configuration required)                               │
│   Example: seq.192.168.1.50.nip.io:5000                             │
│                                                                      │
│ ○ sslip.io  (no configuration required)                             │
│   Example: seq.192-168-1-50.sslip.io:5000                           │
│                                                                      │
│ ○ Custom Domain                                                      │
│   Base Domain: [minicluster.company.local___]                       │
│   Example: seq.minicluster.company.local:5000                       │
│   ⚠️ Requires DNS configuration: *.minicluster.company.local → IP   │
│                                                                      │
│ Port Proxy Configuration                                             │
│ ────────────────────────                                            │
│ Port Range: [5001] to [5099]                                        │
│ Used Ports: 5001, 5002 (2 of 99 available)                          │
│                                                                      │
│ Security Defaults                                                    │
│ ─────────────────                                                   │
│ ☑ Require authentication by default for new proxies                 │
│                                                                      │
│                                            [Cancel]   [Save Settings]│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Health Checking

### Automatic Health Checks

```csharp
public class ProxyHealthChecker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var routes = await _repository.GetAllEnabledRoutes();
            
            foreach (var route in routes)
            {
                try
                {
                    var response = await _httpClient.GetAsync(route.TargetUrl);
                    route.IsHealthy = response.IsSuccessStatusCode;
                }
                catch
                {
                    route.IsHealthy = false;
                }
                
                route.LastHealthCheck = DateTime.UtcNow;
                await _repository.UpdateHealthStatus(route);
            }
            
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

### Manual Health Check Endpoint

```
POST /api/proxy-routes/{id}/test
```

Response:
```json
{
  "isHealthy": true,
  "statusCode": 200,
  "responseTime": 45,
  "message": "Target is reachable"
}
```

---

## WebSocket Proxy Support

### Challenge

WebSocket connections need special handling:

```javascript
// Client code in Seq
const ws = new WebSocket('ws://localhost:5341/hub');
```

### Solutions

**Path Prefix Mode:**
- Rewrite WS URL in JavaScript (fragile)
- Or: Client connects to `ws://host/proxy/seq/hub`, middleware upgrades

**Subdomain Mode:**
- Works automatically: `ws://seq.192.168.1.50.nip.io:5000/hub`

**Port Mode:**
- Works automatically: `ws://192.168.1.50:5001/hub`

### Implementation

```csharp
// In proxy middleware
if (context.WebSockets.IsWebSocketRequest)
{
    var clientWs = await context.WebSockets.AcceptWebSocketAsync();
    var targetWs = new ClientWebSocket();
    await targetWs.ConnectAsync(targetWsUri, CancellationToken.None);
    
    // Bidirectional forwarding
    await Task.WhenAll(
        ForwardAsync(clientWs, targetWs),
        ForwardAsync(targetWs, clientWs)
    );
}
```

---

## Configuration

### appsettings.json

```json
{
  "Proxy": {
    "Enabled": true,
    "BaseDomainType": "nip.io",
    "CustomBaseDomain": null,
    "ServerIpOverride": null,
    "PortRange": {
      "Start": 5001,
      "End": 5099
    },
    "DefaultRequireAuth": true,
    "HealthCheckIntervalSeconds": 60,
    "RequestTimeoutSeconds": 30,
    "MaxRequestBodySize": 104857600,
    "BufferResponses": false
  }
}
```

---

## Security Considerations

### 1. Target Validation
- Only allow localhost/127.0.0.1 targets by default
- Optional: Allow internal network ranges (10.x, 192.168.x, etc.)
- Never allow external targets without explicit configuration

### 2. Path Traversal Prevention
- Sanitize path prefix input
- Prevent `../` in proxy paths

### 3. SSRF Prevention
- Validate target URLs before creating routes
- Disallow redirects to external hosts

### 4. Rate Limiting
- Apply rate limits per user per proxy route
- Prevent abuse of proxy for DoS

### 5. Audit Logging
- Log all proxy access with user, route, timestamp
- Track failed authentication attempts

---

## Implementation Phases (Using YARP)

### Phase 1: Core Infrastructure
| Task | Estimate |
|------|----------|
| Add YARP NuGet package | 0.5 hours |
| ProxyRoute entity and database migration | 2 hours |
| ProxySettings entity and migration | 1 hour |
| DatabaseProxyConfigProvider for YARP | 4 hours |
| CRUD API for proxy routes | 3 hours |
| Settings API | 1 hour |
| Server IP detection utility | 1 hour |
| **Phase 1 Total** | **12.5 hours** |

### Phase 2: Proxy Routing with YARP
| Task | Estimate |
|------|----------|
| YARP basic setup in Program.cs | 1 hour |
| Path prefix route configuration | 2 hours |
| Subdomain route configuration | 2 hours |
| Port-based routing (if feasible) | 3 hours |
| Hot-reload on database changes | 2 hours |
| **Phase 2 Total** | **10 hours** |

### Phase 3: Custom Transforms & Rewriting
| Task | Estimate |
|------|----------|
| HTML URL rewriting transform | 4 hours |
| CSS URL rewriting | 2 hours |
| Header rewriting (Location, Set-Cookie) | 2 hours |
| X-Frame-Options stripping for iframe | 1 hour |
| **Phase 3 Total** | **9 hours** |

### Phase 4: Authentication Integration
| Task | Estimate |
|------|----------|
| Proxy authentication middleware | 3 hours |
| Role-based access per route | 2 hours |
| Cookie domain handling for subdomains | 2 hours |
| **Phase 4 Total** | **7 hours** |

### Phase 5: UI Implementation
| Task | Estimate |
|------|----------|
| ProxyRoutesList component | 3 hours |
| ProxyRouteForm (multi-tab) | 5 hours |
| ProxyRouteDetail / Access URLs view | 2 hours |
| ProxyEmbed (iframe view) | 2 hours |
| ProxySettings page | 2 hours |
| Navigation integration | 1 hour |
| **Phase 5 Total** | **15 hours** |

### Phase 6: Health & Polish
| Task | Estimate |
|------|----------|
| YARP health check configuration | 1 hour |
| Health status display in UI | 1 hour |
| Connection test endpoint | 1 hour |
| Error handling & edge cases | 2 hours |
| Testing & bug fixes | 4 hours |
| **Phase 6 Total** | **9 hours** |

### Total Estimate

| Phase | Hours |
|-------|-------|
| Phase 1: Core Infrastructure | 12.5 |
| Phase 2: Proxy Routing (YARP) | 10 |
| Phase 3: Custom Transforms | 9 |
| Phase 4: Authentication | 7 |
| Phase 5: UI Implementation | 15 |
| Phase 6: Health & Polish | 9 |
| **Total** | **~62.5 hours (~8 days)** |

**Savings vs Manual Implementation: ~30 hours (~4 days)**

---

## Dependencies

### NuGet Packages

```xml
<!-- YARP - Microsoft's reverse proxy (RECOMMENDED) -->
<PackageReference Include="Yarp.ReverseProxy" Version="2.1.0" />

<!-- For HTML parsing (URL rewriting in path-prefix mode) -->
<PackageReference Include="AngleSharp" Version="1.1.0" />
```

### Frontend

```json
{
  "dependencies": {
    // Existing dependencies should suffice
    // No additional packages needed
  }
}
```

---

## Testing Strategy

### Unit Tests
- URL rewriting functions
- Path prefix extraction
- Subdomain extraction
- Target URL validation

### Integration Tests
- Proxy routing with mock targets
- Authentication flow
- Header forwarding

### E2E Tests
- Create proxy route via UI
- Access via all methods
- Verify target receives requests

---

## Future Enhancements

1. **Load Balancing**: Multiple targets per route
2. **Caching**: Cache static assets from proxied sites
3. **Compression**: Gzip/Brotli compression
4. **Request Logging**: Detailed request/response logging
5. **Bandwidth Throttling**: Limit throughput per route
6. **Circuit Breaker**: Auto-disable unhealthy targets
7. **Custom Error Pages**: Show MiniCluster error page on target failure
8. **SSL Termination**: HTTPS to HTTP proxy
9. **Request Transformation**: Modify requests before forwarding
10. **Response Transformation**: Modify responses beyond URL rewriting

---

## Open Questions

1. ~~**YARP vs Custom Implementation?**~~ → **Decided: Use YARP**

2. **Port proxy: Static or Dynamic binding?**
   - Static: Configure in startup, requires restart
   - Dynamic: Add/remove at runtime, more complex
   - **Recommendation**: Start with static, enhance later if needed

3. **Default access method for new proxies?**
   - **Recommendation**: Enable Subdomain by default (best compatibility)

4. **How to handle HTTPS targets?**
   - Accept self-signed certs?
   - **Recommendation**: Add toggle "Skip SSL validation" per route

5. **JavaScript URL rewriting?**
   - Very fragile, may break apps
   - **Recommendation**: Disable by default, warn users about limitations

---

## Appendix A: YARP Configuration Example

```csharp
// If using YARP for proxy implementation
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// Or programmatic configuration
builder.Services.AddReverseProxy()
    .LoadFromMemory(GetRoutesFromDatabase(), GetClustersFromDatabase());
```

---

## Appendix B: Manual Proxy Implementation Example

```csharp
public class ProxyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly HttpClient _httpClient;
    
    public async Task InvokeAsync(HttpContext context)
    {
        var route = await GetMatchingRoute(context);
        if (route == null)
        {
            await _next(context);
            return;
        }
        
        // Build target request
        var targetUri = BuildTargetUri(context, route);
        var requestMessage = CreateProxyRequest(context, targetUri);
        
        // Forward request
        var response = await _httpClient.SendAsync(requestMessage);
        
        // Copy response
        await CopyResponseAsync(context, response, route);
    }
}
```

---

## Appendix C: nip.io / sslip.io Examples

```
# nip.io (uses dots)
app.10.0.0.1.nip.io         → 10.0.0.1
app.192.168.1.50.nip.io     → 192.168.1.50
customer1.app.10.0.0.1.nip.io → 10.0.0.1

# sslip.io (uses dashes for IP)
app.10-0-0-1.sslip.io       → 10.0.0.1
app.192-168-1-50.sslip.io   → 192.168.1.50

# Both support IPv6
app.2001-db8--1.sslip.io    → 2001:db8::1
```
