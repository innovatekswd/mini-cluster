# Database Split Architecture

## Overview
The application now uses **two separate SQLite databases** for better performance, maintenance, and scalability:

1. **controlcenter.db** - Static configuration data (rarely changes)
2. **logs.db** - High-volume transient logging data (frequently written, periodically cleaned)

## Benefits

### 1. Easy Log Management
- Can delete/recreate `logs.db` without touching control configuration
- Backup `controlcenter.db` frequently, `logs.db` can be expendable
- Separate retention policies for each database

### 2. Performance
- Different WAL settings optimized for each use case
- Smaller control DB = faster queries and backups
- Log DB can use aggressive batching without affecting control operations

### 3. Maintenance
- VACUUM logs DB independently to reclaim space
- Separate connection pools with different timeout settings
- Easier to troubleshoot issues (control vs logging problems)

## Database Structure

### Control Database (`controlcenter.db`)
**Tables:**
- `ControlledApps` - Application definitions
- `VariableGroups` - Variable group configurations
- `AppFiles` - File metadata for apps

**Characteristics:**
- Low write frequency
- Critical data (must be backed up)
- Small size (typically < 10 MB)

### Logs Database (`logs.db`)
**Tables:**
- `SessionLogs` - Individual log entries from app output
- `AppSessions` - Session metadata (start/end times, exit codes)
- `AppLifecycleEvents` - App lifecycle events (start, stop, crash)

**Characteristics:**
- High write frequency (100-1000/sec)
- Transient data (can be deleted)
- Large size (can grow to GB)

## Configuration

### appsettings.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=controlcenter.db;Mode=ReadWriteCreate;Cache=Shared;Pooling=True;BusyTimeout=5000;Journal Mode=WAL",
    "LogsConnection": "Data Source=logs.db;Mode=ReadWriteCreate;Cache=Shared;Pooling=True;BusyTimeout=5000;Journal Mode=WAL"
  },
  "LogCleanup": {
    "IntervalMinutes": 10,
    "RetentionHours": 24,
    "AutoVacuum": true
  }
}
```

## Automatic Log Cleanup

### Background Service
**LogCleanupService** runs every 10 minutes (configurable) and:
1. Deletes logs older than 24 hours (configurable)
2. Deletes completed sessions older than retention period
3. Deletes lifecycle events older than retention period
4. Optionally runs VACUUM to reclaim disk space

### Configuration Options
- `LogCleanup:IntervalMinutes` - How often cleanup runs (default: 10)
- `LogCleanup:RetentionHours` - How long to keep logs (default: 24)
- `LogCleanup:AutoVacuum` - Run VACUUM after cleanup (default: true)

## API Endpoints

### Log Management

#### 1. Truncate All Logs (DANGEROUS)
```http
DELETE /api/logs/truncate?confirm=true
```
Permanently deletes ALL logs. Requires `confirm=true` parameter.

**Response:**
```json
{
  "message": "All logs truncated successfully",
  "deleted": {
    "logs": 125000,
    "events": 450,
    "sessions": 320
  }
}
```

#### 2. Manual Cleanup
```http
DELETE /api/logs/cleanup?olderThanHours=48
```
Delete logs older than specified hours.

#### 3. Database Statistics
```http
GET /api/logs/stats
```
**Response:**
```json
{
  "logsDatabase": {
    "totalLogs": 125000,
    "totalSessions": 450,
    "totalEvents": 1200,
    "oldestLog": "2026-01-01T10:00:00Z",
    "newestLog": "2026-01-02T15:30:00Z",
    "activeSessions": 3
  },
  "controlDatabase": {
    "totalApps": 12,
    "totalVariableGroups": 5,
    "autoStartApps": 7
  }
}
```

#### 4. Export Logs
```http
GET /api/logs/export?appId={guid}&from={date}&to={date}
```
Export logs for specific app and date range (max 10,000 entries).

#### 5. App Uptime Statistics
```http
GET /api/logs/uptime/{appId}?lastDays=7
```
**Response:**
```json
{
  "appId": "...",
  "period": "Last 7 days",
  "totalSessions": 45,
  "crashedSessions": 3,
  "crashRate": 6.67,
  "averageRuntimeSeconds": 3600,
  "totalRuntimeHours": 45
}
```

## Migration Guide

### For Existing Installations

1. **Backup your existing database:**
   ```bash
   cp controlcenter.db controlcenter.db.backup
   ```

2. **The application will automatically create `logs.db` on first run**
   - Existing data in `controlcenter.db` will remain untouched
   - New log entries will go to `logs.db`
   - Old logs in `controlcenter.db` will not be migrated (run cleanup manually if needed)

3. **Optional: Migrate existing logs to new database:**
   ```bash
   # Use SQLite attach command
   sqlite3 logs.db "ATTACH 'controlcenter.db' AS old; 
                    INSERT INTO SessionLogs SELECT * FROM old.SessionLogs;
                    INSERT INTO AppSessions SELECT * FROM old.AppSessions;
                    INSERT INTO AppLifecycleEvents SELECT * FROM old.LifecycleEvents;"
   ```

4. **Clean up old database (optional):**
   ```bash
   sqlite3 controlcenter.db "DROP TABLE IF EXISTS SessionLogs;
                              DROP TABLE IF EXISTS AppSessions;
                              DROP TABLE IF EXISTS AppLifecycleEvents;
                              VACUUM;"
   ```

## Monitoring

### Check Database Sizes
```bash
ls -lh *.db
```

### Monitor Log Growth
```http
GET /api/logs/stats
```
Check `totalLogs` and `totalSessions` regularly.

### Adjust Retention Policy
If `logs.db` grows too large, reduce retention:
```json
{
  "LogCleanup": {
    "RetentionHours": 12  // Keep only 12 hours
  }
}
```

## Troubleshooting

### Database Locked Errors
- Both databases use WAL mode with 5-second busy timeout
- If still seeing lock errors, check:
  1. Antivirus scanning database files
  2. NFS/network storage (not recommended for SQLite)
  3. Disk full condition

### Logs DB Growing Too Large
1. Reduce retention period in appsettings.json
2. Run manual cleanup: `DELETE /api/logs/cleanup?olderThanHours=6`
3. Truncate and start fresh: `DELETE /api/logs/truncate?confirm=true`
4. Enable AutoVacuum: `"AutoVacuum": true`

### Missing Logs
- Check LogBatchService is running: `GET /api/health`
- Check logs.db file exists and is writable
- Review application logs for batch service errors

## Future Enhancements

1. **Per-App Retention Policies** - Store retention hours in ControlledApp entity
2. **Log Archiving** - Compress old logs before deletion
3. **Log Severity Levels** - Keep ERROR logs longer than INFO
4. **Metrics Dashboard** - Visualize app uptime, crash rates, trends
5. **Log Streaming** - Real-time log streaming via SignalR
6. **Database Sharding** - Split logs by app or time period

## Performance Recommendations

1. **Regular VACUUM** - Run weekly on logs.db to reclaim space
2. **Index Monitoring** - Check query performance with EXPLAIN QUERY PLAN
3. **Batch Size Tuning** - Adjust LogBatchService batch size based on log volume
4. **Connection Pooling** - Ensure proper connection pool settings in production
5. **Disk I/O** - Use SSD for logs.db for better write performance
