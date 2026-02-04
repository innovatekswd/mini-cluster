# Core Platform

> **Version:** 1.0  
> **Status:** ✅ Mostly Implemented  
> **Priority:** Foundational

---

## Overview

The MiniCluster Core Platform provides fundamental service and application management capabilities. This document covers the foundational features that are largely implemented.

---

## 1. Service Management (✅ Implemented)

### Service Entity
```csharp
public class Service
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string ExecutablePath { get; set; }
    public string? WorkingDirectory { get; set; }
    public string? Arguments { get; set; }
    public ServiceStatus Status { get; set; }
    public Guid? AppId { get; set; }
    public Guid? AppTabId { get; set; }
    public int? ProcessId { get; set; }
    public ServiceType Type { get; set; }
    public bool AutoStart { get; set; }
    public int RestartCount { get; set; }
    public int MaxRestarts { get; set; }
    public DateTime? LastStarted { get; set; }
    public DateTime? LastStopped { get; set; }
}
```

### Service Types
| Type | Description |
|------|-------------|
| `Executable` | Standalone executable (.exe, binary) |
| `DotNet` | .NET application (dotnet run/dll) |
| `Node` | Node.js application |
| `Python` | Python script |
| `Java` | Java application |
| `Script` | Shell/Batch script |
| `Custom` | Custom command |

### API Endpoints
```
GET    /api/services                    List all services
POST   /api/services                    Create service
GET    /api/services/{id}               Get service
PUT    /api/services/{id}               Update service
DELETE /api/services/{id}               Delete service
POST   /api/services/{id}/start         Start service
POST   /api/services/{id}/stop          Stop service
POST   /api/services/{id}/restart       Restart service
GET    /api/services/{id}/logs          Get service logs
```

---

## 2. Application Management (✅ Implemented)

### App Entity
```csharp
public class App
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }           // Emoji or icon name
    public string? Color { get; set; }          // Hex color
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // Navigation
    public List<Service> Services { get; set; }
    public List<AppTab> Tabs { get; set; }
}
```

### API Endpoints
```
GET    /api/apps                        List all apps
POST   /api/apps                        Create app
GET    /api/apps/{id}                   Get app with services
PUT    /api/apps/{id}                   Update app
DELETE /api/apps/{id}                   Delete app (and services)
POST   /api/apps/{id}/start             Start all services
POST   /api/apps/{id}/stop              Stop all services
```

---

## 3. File Explorer (✅ Implemented)

### Features
- Browse any directory on the system
- View file contents
- Create/Edit/Delete files
- Create directories
- File upload

### API Endpoints
```
GET    /api/files?path=/path            List directory
GET    /api/files/content?path=/file    Get file content
POST   /api/files                       Create file
PUT    /api/files                       Update file content
DELETE /api/files?path=/file            Delete file/directory
POST   /api/files/upload                Upload files
```

### Security
- Path traversal prevention
- Configurable root restrictions
- Permission checking (Linux)

---

## 4. Process Metrics (✅ Implemented)

### Metrics Collected
```csharp
public class ProcessMetrics
{
    public double CpuUsagePercent { get; set; }
    public long MemoryUsageBytes { get; set; }
    public long PrivateMemoryBytes { get; set; }
    public int ThreadCount { get; set; }
    public int HandleCount { get; set; }
    public DateTime StartTime { get; set; }
    public TimeSpan TotalProcessorTime { get; set; }
}
```

### Real-Time Updates
SignalR hub for live metrics:
```typescript
connection.on("serviceMetrics", (metrics) => {
  // { serviceId, cpu, memory, threads, ... }
});

connection.on("systemMetrics", (metrics) => {
  // { totalCpu, totalMemory, diskUsage, ... }
});
```

### API Endpoints
```
GET    /api/metrics/services/{id}       Service metrics
GET    /api/metrics/system              System-wide metrics
GET    /api/metrics/processes           All system processes
```

---

## 5. Service Logs (✅ Implemented)

### Log Storage
- Stdout/Stderr capture
- File-based logging per service
- Log rotation (configurable)

### Log Retrieval
```
GET /api/services/{id}/logs?lines=100&level=error
```

### Real-Time Streaming
```typescript
connection.on("serviceLog", (log) => {
  // { serviceId, line, level, timestamp }
});
```

---

## 6. Environment Variables (✅ Implemented)

### Service Environment
```csharp
public class ServiceEnvironmentVariable
{
    public Guid Id { get; set; }
    public Guid ServiceId { get; set; }
    public string Key { get; set; }
    public string Value { get; set; }
    public bool IsSecret { get; set; }     // Mask in UI
}
```

### Variable Resolution
- Service-specific variables
- App-level variables (inherited)
- Global variables
- System environment passthrough

### API Endpoints
```
GET    /api/services/{id}/env           List env vars
POST   /api/services/{id}/env           Add env var
PUT    /api/services/{id}/env/{key}     Update env var
DELETE /api/services/{id}/env/{key}     Delete env var
```

---

## 7. Reverse Proxy (✅ Implemented)

### YARP Integration
Dynamic reverse proxy for exposing services.

### Route Configuration
```csharp
public class ProxyRoute
{
    public Guid Id { get; set; }
    public Guid ServiceId { get; set; }
    public string Path { get; set; }           // "/api/myservice"
    public int TargetPort { get; set; }        // 5001
    public bool StripPath { get; set; }        // Remove /api/myservice prefix
    public bool RequireAuth { get; set; }      // Require authentication
}
```

### API Endpoints
```
GET    /api/proxy/routes                List routes
POST   /api/proxy/routes                Create route
PUT    /api/proxy/routes/{id}           Update route
DELETE /api/proxy/routes/{id}           Delete route
POST   /api/proxy/reload                Reload configuration
```

---

## 8. Configuration (✅ Implemented)

### appsettings.json
```json
{
  "MiniCluster": {
    "DataDirectory": "/var/minicluster/data",
    "LogDirectory": "/var/minicluster/logs",
    "DefaultShell": "/bin/bash",
    "MaxLogSize": "10MB",
    "LogRetentionDays": 30
  },
  "Authentication": {
    "Enabled": true,
    "JwtSecret": "...",
    "TokenExpiryMinutes": 15
  },
  "Proxy": {
    "Enabled": true,
    "BasePort": 5147
  }
}
```

---

## 9. Database (✅ Implemented)

### SQLite Database
- Single file: `minicluster.db`
- Entity Framework Core
- Migrations support

### Tables
```
- Apps
- AppTabs
- Services
- ServiceEnvironmentVariables
- Users
- ProxyRoutes
- AuditLogs (future)
```

---

## API Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response
```json
{
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Service with ID xxx not found",
    "details": null
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "name": ["Name is required"],
      "executablePath": ["File does not exist"]
    }
  }
}
```

---

## SignalR Hubs

### MetricsHub
```
/hubs/metrics
  - serviceMetrics(ServiceMetrics)
  - systemMetrics(SystemMetrics)
  - serviceStatusChanged(ServiceStatusUpdate)
```

### LogsHub
```
/hubs/logs
  - serviceLog(ServiceLogEntry)
  - subscribe(serviceId)
  - unsubscribe(serviceId)
```

---

## References

- Service controller: `ControlCenter.Api/Controllers/ServicesController.cs`
- App controller: `ControlCenter.Api/Controllers/AppsController.cs`
- Process manager: `ControlCenter.Api/Services/ProcessManager.cs`
- Metrics service: `ControlCenter.Api/Services/MetricsService.cs`
