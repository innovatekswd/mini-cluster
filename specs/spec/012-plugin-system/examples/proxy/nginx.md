# Nginx Plugin Specification

## Overview

Nginx integration plugin - industry standard reverse proxy and web server.

## Why Nginx

| Advantage | Benefit |
|-----------|---------|
| Industry standard | Familiar to most ops teams |
| Battle-tested | Proven at massive scale |
| Rich ecosystem | Modules for everything |
| Performance | Excellent under high load |
| Documentation | Extensive resources |

## Capabilities

```csharp
public class NginxPlugin : IProxyPlugin
{
    public ProxyCapabilities Capabilities => 
        ProxyCapabilities.ReverseProxy |
        ProxyCapabilities.LoadBalancing |
        ProxyCapabilities.TlsTermination |
        ProxyCapabilities.Caching |
        ProxyCapabilities.RateLimiting |
        ProxyCapabilities.WebSocket;
}
```

## Detection Paths

| OS | Binary | Config |
|----|--------|--------|
| Linux | `/usr/sbin/nginx`, `/usr/local/nginx/sbin/nginx` | `/etc/nginx/nginx.conf` |
| Windows | `C:\nginx\nginx.exe` | `C:\nginx\conf\nginx.conf` |

## Config Generation

### Input (Unified)
```json
{
  "routes": [{
    "hosts": ["api.example.com"],
    "paths": ["/api/"],
    "upstreamId": "api-servers"
  }],
  "upstreams": [{
    "id": "api-servers",
    "servers": [
      { "address": "localhost:8080", "weight": 3 },
      { "address": "localhost:8081", "weight": 1 }
    ],
    "loadBalance": "weighted_round_robin"
  }]
}
```

### Output (nginx.conf)
```nginx
# MiniCluster managed - do not edit manually
# Generated: 2026-01-26T10:00:00Z

upstream api-servers {
    server localhost:8080 weight=3;
    server localhost:8081 weight=1;
}

server {
    listen 80;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://api-servers;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Config Management Strategy

MiniCluster manages a separate include file, not the main nginx.conf:

```nginx
# /etc/nginx/nginx.conf (user's file, untouched)
http {
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/minicluster.conf;  # ← MiniCluster adds this line
}
```

```nginx
# /etc/nginx/minicluster.conf (MiniCluster owned)
# All routes managed here
```

## Reload Implementation

```csharp
public class NginxPlugin : IProxyPlugin
{
    public async Task<ValidationResult> ValidateConfigAsync(ProxyConfig config)
    {
        var tempFile = Path.GetTempFileName();
        await GenerateNginxConfigAsync(config, tempFile);
        
        // nginx -t validates without applying
        var result = await RunCommandAsync(_binaryPath, $"-t -c {tempFile}");
        
        return new ValidationResult
        {
            IsValid = result.ExitCode == 0,
            Errors = ParseNginxErrors(result.StdErr)
        };
    }
    
    public async Task ReloadAsync()
    {
        // Graceful reload - no dropped connections
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            await RunCommandAsync(_binaryPath, "-s reload");
        }
        else
        {
            await RunCommandAsync("nginx", "-s reload");
            // Or: kill -HUP $(cat /var/run/nginx.pid)
        }
    }
}
```

## Windows Specifics

```csharp
public async Task InstallAsync(InstallOptions options)
{
    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
    {
        // Download Windows build
        var url = "https://nginx.org/download/nginx-1.24.0.zip";
        var zipPath = Path.GetTempFileName() + ".zip";
        await DownloadFileAsync(url, zipPath);
        
        // Extract to C:\nginx
        ZipFile.ExtractToDirectory(zipPath, @"C:\nginx");
        
        // Register as Windows service (optional)
        await RunCommandAsync("sc", @"create nginx binPath= ""C:\nginx\nginx.exe""");
    }
}
```

## Health Check

```csharp
public async Task<HealthCheckResult> HealthCheckAsync()
{
    try
    {
        // Check process
        var processes = Process.GetProcessesByName("nginx");
        if (processes.Length == 0)
            return HealthCheckResult.Unhealthy("Nginx not running");
        
        // Check stub_status if configured
        var response = await _http.GetAsync("http://localhost/nginx_status");
        if (response.IsSuccessStatusCode)
        {
            var status = await ParseNginxStatus(response);
            return HealthCheckResult.Healthy($"Active connections: {status.ActiveConnections}");
        }
        
        return HealthCheckResult.Healthy("Running");
    }
    catch (Exception ex)
    {
        return HealthCheckResult.Unhealthy(ex.Message);
    }
}
```

## Estimated Effort: 1-2 weeks
