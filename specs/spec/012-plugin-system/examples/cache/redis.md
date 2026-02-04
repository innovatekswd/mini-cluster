# Redis Plugin

## Overview
Redis - In-memory data store for caching, session storage, and pub/sub messaging.

## Capabilities
```csharp
public ProxyCapabilities Capabilities => 
    PluginCapabilities.KeyValueCache |
    PluginCapabilities.DistributedCache |
    PluginCapabilities.Clustering |
    PluginCapabilities.Replication;
```

## Detection Paths
| OS | Binary | Config |
|----|--------|--------|
| Linux | `/usr/bin/redis-server` | `/etc/redis/redis.conf` |
| Windows | `C:\Redis\redis-server.exe` | `C:\Redis\redis.windows.conf` |

## Config Schema
```json
{
  "port": 6379,
  "bind": "127.0.0.1",
  "maxmemory": "256mb",
  "maxmemory-policy": "allkeys-lru",
  "appendonly": true,
  "requirepass": ""
}
```

## Actions
- `flush-all` - Clear all data
- `bgsave` - Background save to disk
- `info` - Get server info

## Integration
MiniCluster apps can use Redis for:
- Session storage
- Rate limiting
- Distributed locking
- Pub/sub messaging

## Estimated Effort: 1 week
