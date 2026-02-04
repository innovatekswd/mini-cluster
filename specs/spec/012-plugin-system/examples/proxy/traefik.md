# Traefik Plugin Specification

## Overview

Traefik integration - cloud-native reverse proxy with automatic service discovery.

## Why Traefik

| Advantage | Benefit |
|-----------|---------|
| Service discovery | Auto-detects running services |
| Docker-native | Labels-based config |
| Dashboard built-in | Visual route management |
| Let's Encrypt | Auto HTTPS like Caddy |
| Middleware | Auth, rate-limit, retry chains |

## Capabilities

```csharp
public class TraefikPlugin : IProxyPlugin
{
    public ProxyCapabilities Capabilities => 
        ProxyCapabilities.ReverseProxy |
        ProxyCapabilities.LoadBalancing |
        ProxyCapabilities.TlsTermination |
        ProxyCapabilities.AutoHttps |
        ProxyCapabilities.RateLimiting |
        ProxyCapabilities.WebSocket |
        ProxyCapabilities.ServiceDiscovery |
        ProxyCapabilities.ConfigHotReload;
}
```

## Service Discovery Integration

Traefik can auto-discover MiniCluster apps:

```csharp
public class TraefikServiceDiscovery
{
    // Traefik polls this endpoint for dynamic config
    [HttpGet("/api/traefik/config")]
    public async Task<TraefikDynamicConfig> GetDynamicConfig()
    {
        var apps = await _db.Apps
            .Where(a => a.Status == AppStatus.Running && a.ExposeViaProxy)
            .ToListAsync();
        
        return new TraefikDynamicConfig
        {
            Http = new
            {
                Routers = apps.ToDictionary(
                    a => a.Name,
                    a => new { 
                        Rule = $"Host(`{a.ProxyHost}`)",
                        Service = a.Name
                    }),
                Services = apps.ToDictionary(
                    a => a.Name,
                    a => new {
                        LoadBalancer = new {
                            Servers = new[] { new { Url = $"http://localhost:{a.Port}" } }
                        }
                    })
            }
        };
    }
}
```

## Config Generation

### Traefik Static Config (traefik.yml)
```yaml
# MiniCluster managed
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  http:
    endpoint: "http://localhost:5147/api/traefik/config"
    pollInterval: "5s"

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

## Estimated Effort: 1-2 weeks
