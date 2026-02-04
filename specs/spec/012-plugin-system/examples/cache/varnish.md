# Varnish Plugin Specification

## Overview

Varnish Cache integration - high-performance HTTP accelerator.

## Why Varnish

| Advantage | Benefit |
|-----------|---------|
| Speed | In-memory caching, sub-ms responses |
| VCL | Powerful cache configuration language |
| Edge caching | Reduce backend load 90%+ |
| ESI | Edge Side Includes for partial caching |
| Proven | Wikipedia, NYTimes, etc. |

## Capabilities

```csharp
public class VarnishPlugin : IProxyPlugin
{
    public ProxyCapabilities Capabilities => 
        ProxyCapabilities.ReverseProxy |
        ProxyCapabilities.Caching |
        ProxyCapabilities.LoadBalancing;
    
    // Note: Linux only
    public bool IsSupported => !RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
}
```

## Config Generation

### Input (Unified)
```json
{
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "rules": [
      { "path": "/static/*", "ttl": 86400 },
      { "path": "/api/*", "ttl": 0 }
    ]
  },
  "upstreams": [{
    "id": "backend",
    "servers": [{ "address": "localhost:8080" }]
  }]
}
```

### Output (default.vcl)
```vcl
# MiniCluster managed
vcl 4.1;

backend default {
    .host = "localhost";
    .port = "8080";
}

sub vcl_recv {
    # Don't cache API
    if (req.url ~ "^/api/") {
        return (pass);
    }
}

sub vcl_backend_response {
    # Static files cache 1 day
    if (bereq.url ~ "^/static/") {
        set beresp.ttl = 86400s;
    } else {
        set beresp.ttl = 3600s;
    }
}
```

## Cache Management

```csharp
public class VarnishPlugin : IProxyPlugin
{
    public async Task PurgeCacheAsync(string pattern)
    {
        // Use varnishadm to purge
        await RunCommandAsync("varnishadm", $"ban req.url ~ {pattern}");
    }
    
    public async Task<CacheStats> GetCacheStatsAsync()
    {
        var result = await RunCommandAsync("varnishstat", "-1 -j");
        return ParseVarnishStats(result.StdOut);
    }
}
```

## UI: Cache Controls

```tsx
function VarnishCachePanel({ pluginId }: Props) {
  const { data: stats } = useVarnishStats(pluginId);
  const purgeMutation = usePurgeCache();
  
  return (
    <Panel title="Cache Statistics">
      <Stat label="Hit Rate" value={`${stats?.hitRate}%`} />
      <Stat label="Cached Objects" value={stats?.objects} />
      <Stat label="Memory Used" value={formatBytes(stats?.memoryUsed)} />
      
      <div className="cache-actions">
        <Button onClick={() => purgeMutation.mutate('.*')}>
          Purge All
        </Button>
        <PurgePatternInput onPurge={(p) => purgeMutation.mutate(p)} />
      </div>
    </Panel>
  );
}
```

## Estimated Effort: 1 week
