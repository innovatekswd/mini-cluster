# HAProxy Plugin Specification

## Overview

HAProxy integration - high-performance TCP/HTTP load balancer.

## Why HAProxy

| Advantage | Benefit |
|-----------|---------|
| Performance | Fastest load balancer |
| TCP support | Not just HTTP |
| Health checks | Advanced backend monitoring |
| Stats page | Built-in dashboard |
| Reliability | Used by GitHub, Twitter, etc. |

## Capabilities

```csharp
public class HAProxyPlugin : IProxyPlugin
{
    public ProxyCapabilities Capabilities => 
        ProxyCapabilities.ReverseProxy |
        ProxyCapabilities.LoadBalancing |
        ProxyCapabilities.TlsTermination |
        ProxyCapabilities.RateLimiting |
        ProxyCapabilities.WebSocket;
    
    // Note: Linux only
    public bool IsSupported => !RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
}
```

## Config Generation

### Input (Unified)
```json
{
  "upstreams": [{
    "id": "api-servers",
    "servers": [
      { "address": "localhost:8080" },
      { "address": "localhost:8081" }
    ],
    "healthCheck": {
      "path": "/health",
      "interval": 5
    }
  }]
}
```

### Output (haproxy.cfg)
```haproxy
# MiniCluster managed
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5s
    timeout client 50s
    timeout server 50s
    option httplog

frontend http_front
    bind *:80
    default_backend api-servers

backend api-servers
    balance roundrobin
    option httpchk GET /health
    server srv1 localhost:8080 check inter 5s
    server srv2 localhost:8081 check inter 5s

listen stats
    bind *:8404
    stats enable
    stats uri /stats
```

## Stats Integration

```csharp
public async Task<HAProxyStats> GetStatsAsync()
{
    // HAProxy exposes stats via Unix socket or HTTP
    var response = await _http.GetAsync("http://localhost:8404/stats;csv");
    return ParseHAProxyStats(await response.Content.ReadAsStringAsync());
}
```

## Estimated Effort: 1 week
