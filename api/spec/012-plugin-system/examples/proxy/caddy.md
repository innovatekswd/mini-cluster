# Caddy Plugin Specification

## Overview

Caddy integration plugin with auto-HTTPS and simple configuration.

## Why Caddy First

| Advantage | Benefit |
|-----------|---------|
| Auto-HTTPS | Let's Encrypt without manual setup |
| Single binary | Easy distribution, no dependencies |
| Windows support | Native Windows builds |
| Simple config | Caddyfile is human-readable |
| Hot reload | Zero-downtime config changes |
| HTTP/3 | Modern protocol support |

## Capabilities

```csharp
public class CaddyPlugin : IProxyPlugin
{
    public ProxyCapabilities Capabilities => 
        ProxyCapabilities.ReverseProxy |
        ProxyCapabilities.LoadBalancing |
        ProxyCapabilities.TlsTermination |
        ProxyCapabilities.AutoHttps |
        ProxyCapabilities.WebSocket |
        ProxyCapabilities.Http3 |
        ProxyCapabilities.ConfigHotReload;
}
```

## Detection Paths

| OS | Paths |
|----|-------|
| Linux | `/usr/bin/caddy`, `/usr/local/bin/caddy`, `~/.local/bin/caddy` |
| Windows | `C:\caddy\caddy.exe`, `C:\Program Files\Caddy\caddy.exe` |
| Config | `Caddyfile`, `/etc/caddy/Caddyfile`, `~/.config/caddy/` |

## Config Generation

### Input (Unified)
```json
{
  "routes": [{
    "hosts": ["api.example.com"],
    "paths": ["/api/*"],
    "upstreamId": "api-servers"
  }],
  "upstreams": [{
    "id": "api-servers",
    "servers": [
      { "address": "localhost:8080" },
      { "address": "localhost:8081" }
    ],
    "loadBalance": "round_robin"
  }],
  "tls": {
    "autoHttps": true,
    "email": "admin@example.com"
  }
}
```

### Output (Caddyfile)
```caddyfile
{
    email admin@example.com
}

api.example.com {
    reverse_proxy /api/* {
        to localhost:8080 localhost:8081
        lb_policy round_robin
        health_uri /health
        health_interval 30s
    }
}
```

## API Admin Integration

Caddy has a built-in admin API at `:2019`:

```csharp
public class CaddyPlugin : IProxyPlugin
{
    private readonly HttpClient _adminClient;
    
    public async Task ReloadAsync()
    {
        // Use Caddy's admin API for zero-downtime reload
        var config = await GenerateCaddyConfigAsync();
        await _adminClient.PostAsync("http://localhost:2019/load", 
            new StringContent(config, Encoding.UTF8, "application/json"));
    }
    
    public async Task<ProxyStatus> GetStatusAsync()
    {
        var response = await _adminClient.GetAsync("http://localhost:2019/config/");
        return response.IsSuccessStatusCode 
            ? ProxyStatus.Running 
            : ProxyStatus.Error;
    }
}
```

## Installation

```csharp
public async Task InstallAsync(InstallOptions options)
{
    var os = Environment.OSVersion.Platform;
    var arch = RuntimeInformation.ProcessArchitecture;
    
    // Download from GitHub releases
    var downloadUrl = $"https://github.com/caddyserver/caddy/releases/latest/download/caddy_{os}_{arch}";
    
    var targetPath = os == PlatformID.Win32NT
        ? @"C:\caddy\caddy.exe"
        : "/usr/local/bin/caddy";
    
    await DownloadFileAsync(downloadUrl, targetPath);
    
    if (os != PlatformID.Win32NT)
    {
        // Make executable on Linux
        await RunCommandAsync("chmod", $"+x {targetPath}");
    }
}
```

## Estimated Effort: 1-2 weeks
