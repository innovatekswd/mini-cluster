# PostgreSQL Plugin

## Overview
PostgreSQL - Advanced open-source relational database.

## Capabilities
```csharp
public PluginCapabilities Capabilities => 
    PluginCapabilities.Relational |
    PluginCapabilities.Replication |
    PluginCapabilities.Backup;
```

## Detection Paths
| OS | Binary | Data |
|----|--------|------|
| Linux | `/usr/bin/psql`, `/usr/lib/postgresql/*/bin/postgres` | `/var/lib/postgresql/*/main` |
| Windows | `C:\Program Files\PostgreSQL\*\bin\postgres.exe` | `C:\Program Files\PostgreSQL\*\data` |

## Config Schema
```json
{
  "port": 5432,
  "maxConnections": 100,
  "sharedBuffers": "128MB",
  "effectiveCacheSize": "4GB",
  "maintenanceWorkMem": "64MB",
  "walLevel": "replica",
  "users": [
    { "name": "app_user", "password": "", "databases": ["myapp"] }
  ]
}
```

## Actions
- `backup` - Create pg_dump backup
- `restore` - Restore from backup
- `vacuum` - Run VACUUM ANALYZE
- `create-db` - Create database
- `create-user` - Create user

## Integration
MiniCluster can auto-provision databases for apps:
```json
{
  "appId": "my-app",
  "database": {
    "plugin": "postgresql",
    "name": "myapp_db",
    "user": "myapp_user"
  }
}
```

## Estimated Effort: 1-2 weeks
