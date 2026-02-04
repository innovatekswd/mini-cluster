# 006: Container Support

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 4 - Containers & Deployment  
**Priority:** 🟢 MEDIUM  
**Effort:** 6-8 weeks  
**Original Spec:** [../spec/006-container-support/spec.md](../../spec/006-container-support/spec.md)

---

## Summary

Add optional Docker/Podman container support alongside native process management. Enables hybrid deployments where some services run as containers and others as native processes.

## Key Features ⬜

### 1. Docker Engine Integration (2 weeks)
- ⬜ Docker Engine API client (Docker.DotNet)
- ⬜ Container lifecycle: create, start, stop, restart, remove
- ⬜ Image management: pull, list, delete
- ⬜ Container listing and inspection
- ⬜ Auto-detect Docker availability

### 2. Podman Support (1 week)
- ⬜ Rootless container support
- ⬜ Podman API compatibility
- ⬜ Auto-detect Podman as fallback

### 3. Container Configuration (2 weeks)
- ⬜ **Image specification** - Which image to run
- ⬜ **Port mapping** - Container → host port mapping
- ⬜ **Volume mounts** - Persist data, bind mounts
- ⬜ **Environment variables** - Pass configuration
- ⬜ **Network configuration** - Bridge, host, custom networks
- ⬜ **Resource limits** - CPU, memory constraints
- ⬜ **Restart policies** - Align with native process policies

### 4. Logs & Monitoring (1-2 weeks)
- ⬜ Stream container logs to UI
- ⬜ Container metrics (CPU, memory, network)
- ⬜ Health checks for containers
- ⬜ Integration with OTLP for observability

### 5. Hybrid Apps (1-2 weeks)
- ⬜ Mix native processes and containers in single app
- ⬜ Dependencies between containers and processes
- ⬜ Unified start/stop operations
- ⬜ Shared environment variables

## Why Optional Containers?

### When to Use Containers
✅ Standardized deployment packages  
✅ Consistent environments (dev == prod)  
✅ Linux apps on Windows (via WSL2)  
✅ Pre-built images from Docker Hub  
✅ Isolation and security  

### When to Use Native Processes
✅ Windows apps (.exe, .dll)  
✅ Better performance (no virtualization)  
✅ Direct filesystem access  
✅ Simpler debugging  
✅ No Docker dependency  

**MiniCluster gives you the choice!**

## Technical Design

### Database Schema
```sql
-- Add container support flag to Apps
ALTER TABLE Apps ADD IsContainer BOOLEAN DEFAULT 0;
ALTER TABLE Apps ADD ContainerConfig TEXT; -- JSON

-- ContainerConfig JSON structure:
{
  "image": "postgres:15",
  "ports": ["5432:5432"],
  "volumes": ["/data/pgdata:/var/lib/postgresql/data"],
  "environment": {
    "POSTGRES_PASSWORD": "secret"
  },
  "network": "bridge",
  "resources": {
    "cpus": 2,
    "memory": "2G"
  }
}
```

### API Endpoints
```
POST   /api/apps                    - Create app (native or container)
POST   /api/apps/:id/containers     - Convert to container
GET    /api/containers              - List all containers
GET    /api/containers/:id          - Container details
POST   /api/containers/:id/start    - Start container
POST   /api/containers/:id/stop     - Stop container
DELETE /api/containers/:id          - Remove container
GET    /api/containers/:id/logs     - Stream container logs
GET    /api/images                  - List images
POST   /api/images/pull             - Pull image from registry
DELETE /api/images/:id              - Remove image
```

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Docker Engine API integration | 2 |
| 2 | Container lifecycle management | 2 |
| 3 | Configuration (ports, volumes, env) | 2 |
| 4 | Logs, metrics, health checks | 1-2 |
| 5 | Podman support | 1 |
| 6 | Hybrid apps (containers + processes) | 1-2 |

**Total:** 6-8 weeks

## Dependencies

- **Recommended:** 005 Reliability (health checks, restart policies)

## Related Features

- **Enhances:** 007 App Versioning (version container images too)
- **Works with:** 008 Hierarchical Apps (containers as services)

---

For complete details, see the [full container support spec](../../spec/006-container-support/spec.md).
