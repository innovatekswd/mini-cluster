# Prometheus Plugin

## Overview
Prometheus - Metrics collection and alerting system.

## Capabilities
```csharp
public PluginCapabilities Capabilities => 
    PluginCapabilities.TimeSeries |
    PluginCapabilities.ConfigHotReload;
```

## Detection Paths
| OS | Binary | Config |
|----|--------|--------|
| Linux | `/usr/bin/prometheus` | `/etc/prometheus/prometheus.yml` |
| Windows | `C:\prometheus\prometheus.exe` | `C:\prometheus\prometheus.yml` |

## Auto-Discovery Integration
Prometheus can auto-discover MiniCluster apps:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'minicluster'
    http_sd_configs:
      - url: 'http://localhost:5147/api/prometheus/targets'
```

MiniCluster exposes targets endpoint:
```csharp
[HttpGet("/api/prometheus/targets")]
public async Task<List<PrometheusTarget>> GetTargets()
{
    return await _db.Apps
        .Where(a => a.MetricsEnabled && a.Status == AppStatus.Running)
        .Select(a => new PrometheusTarget
        {
            Targets = new[] { $"localhost:{a.MetricsPort}" },
            Labels = new { 
                job = a.Name,
                app_id = a.Id.ToString()
            }
        })
        .ToListAsync();
}
```

## Config Schema
```json
{
  "retention": "15d",
  "scrapeInterval": "15s",
  "alertmanagerUrl": "",
  "additionalScrapeConfigs": []
}
```

## Actions
- `reload` - Reload configuration
- `snapshot` - Create data snapshot

## Estimated Effort: 1 week
