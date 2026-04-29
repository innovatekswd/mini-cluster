# Feature 025: Container Lifecycle

> **Status:** 🚧 In Progress  
> **Priority:** HIGH  
> **Effort:** 6–8 weeks  
> **Branch:** `feature/container-registry`  
> **Dependencies:** 006 Container Support (schema done), Docker/Podman daemon  
> **Last Updated:** April 29, 2026

---

## Overview

Implement the **runtime execution layer** for Docker/Podman containers inside MiniCluster. The schema and REST config endpoints already exist (Spec 006). This spec covers everything that happens at runtime: pulling images, creating/starting/stopping containers, bridging logs into the existing `LogBatchService`, health checks, auto-restart, and surfacing metrics — all mirroring the existing process lifecycle exactly so the UI and workers require minimal changes.

**Guiding principle:** A container is just a process to MiniCluster. The same session, lifecycle event, log, health check, and restart machinery is reused. Only the execution driver changes.

---

## State Machine

```
                    ┌───────────────────────────┐
                    │       [Configured]         │  (ContainerConfig saved in DB)
                    └────────────┬──────────────┘
                                 │ POST /execution/start
                                 ▼
                           [Starting]
                          /            \
              image exists?         pull image
              (inspect)             (progress → logs)
                   │                     │
                   └──────┬──────────────┘
                           │ docker create
                           │ docker start
                           ▼
                       [Running] ──── POST /stop ──► [Stopping]
                           │                              │
                           │  exits unexpectedly          │ docker stop (grace)
                           ▼                              │ docker kill (force)
                       [Failed]                      [Stopped]
                           │                              │
               RestartPolicy?                    manuallyStopped=true
               OnFailure/Always ──► [Starting]    → stays Stopped
               Never → stays Failed
```

Status values are identical to the process manager: `Starting | Running | Stopping | Stopped | Failed`.

---

## Implementation Plan

### Phase 1: Model Layer (Week 1)

Add `ServiceType` and `ContainerConfig` to the Go data model (mirroring what .NET already has).

**Go — `internal/models/models.go` additions:**

```go
type ServiceType string

const (
    ServiceTypeProcess   ServiceType = "Process"
    ServiceTypeDocker    ServiceType = "Docker"
    ServiceTypePodman    ServiceType = "Podman"
)

type PullPolicy string

const (
    PullAlways        PullPolicy = "Always"
    PullIfNotPresent  PullPolicy = "IfNotPresent"
    PullNever         PullPolicy = "Never"
)

type ContainerConfig struct {
    ID            string      `gorm:"type:text;primaryKey" json:"id"`
    ServiceID     string      `gorm:"type:text;not null;uniqueIndex" json:"serviceId"`

    // Image
    Image         string      `gorm:"type:text;not null" json:"image"`
    Tag           string      `gorm:"type:text;not null;default:'latest'" json:"tag"`
    Registry      string      `gorm:"type:text" json:"registry"`
    PullPolicy    PullPolicy  `gorm:"type:text;not null;default:'IfNotPresent'" json:"pullPolicy"`

    // Runtime state (set at execution time, not by user)
    ContainerID   string      `gorm:"type:text" json:"containerId"`
    ContainerName string      `gorm:"type:text" json:"containerName"`
    ImageID       string      `gorm:"type:text" json:"imageId"`

    // Networking — stored as JSON string
    Ports         string      `gorm:"type:text" json:"ports"`   // []PortMapping
    NetworkMode   string      `gorm:"type:text" json:"networkMode"`

    // Storage — stored as JSON string
    Volumes       string      `gorm:"type:text" json:"volumes"` // []VolumeMount

    // Resources
    MemoryLimitBytes *int64   `json:"memoryLimitBytes"`
    CpuLimit         *float64 `json:"cpuLimit"`

    // Execution overrides
    Entrypoint    string      `gorm:"type:text" json:"entrypoint"`
    Command       string      `gorm:"type:text" json:"command"`
    User          string      `gorm:"type:text" json:"user"`
    WorkingDir    string      `gorm:"type:text" json:"workingDir"`
    Privileged    bool        `gorm:"not null;default:false" json:"privileged"`
    ReadOnly      bool        `gorm:"not null;default:false" json:"readOnly"`
    RemoveOnStop  bool        `gorm:"not null;default:false" json:"removeOnStop"`

    // Labels — stored as JSON string
    Labels        string      `gorm:"type:text" json:"labels"` // map[string]string

    CreatedAt     time.Time   `json:"createdAt"`
    ModifiedAt    time.Time   `json:"modifiedAt"`

    Service       *Service    `gorm:"foreignKey:ServiceID" json:"-"`
}

type PortMapping struct {
    HostPort      int    `json:"hostPort"`
    ContainerPort int    `json:"containerPort"`
    Protocol      string `json:"protocol"` // tcp | udp
    HostIP        string `json:"hostIp"`   // 0.0.0.0
}

type VolumeMount struct {
    Type      string `json:"type"`      // bind | volume | tmpfs
    Source    string `json:"source"`
    Target    string `json:"target"`
    ReadOnly  bool   `json:"readOnly"`
}
```

**`Service` model gains:**
```go
ServiceType     ServiceType     `gorm:"type:text;not null;default:'Process'" json:"serviceType"`
ContainerConfig *ContainerConfig `gorm:"foreignKey:ServiceID" json:"containerConfig,omitempty"`
```

---

### Phase 2: Container Service Interface (Week 2)

`internal/services/container_service.go` — the contract both Docker and Podman implementations satisfy.

```go
package services

import "context"

// ContainerInfo is returned by GetStatus
type ContainerInfo struct {
    ID        string
    Name      string
    State     string // running | exited | created | paused
    ExitCode  int
    StartedAt time.Time
    FinishedAt *time.Time
    ImageID   string
}

// ContainerStats is returned by GetStats
type ContainerStats struct {
    CPUPercent    float64
    MemoryUsage   int64
    MemoryLimit   int64
    NetworkRx     int64
    NetworkTx     int64
    BlockRead     int64
    BlockWrite    int64
}

// IContainerService is the execution driver interface.
type IContainerService interface {
    // Lifecycle
    PullImage(ctx context.Context, image string, onProgress func(string)) error
    ImageExists(ctx context.Context, image string) (bool, error)
    CreateContainer(ctx context.Context, cfg *models.ContainerConfig, envVars map[string]string) (string, error)
    StartContainer(ctx context.Context, containerID string) error
    StopContainer(ctx context.Context, containerID string, timeoutSecs int) error
    RemoveContainer(ctx context.Context, containerID string, force bool) error
    WaitContainer(ctx context.Context, containerID string) (int, error)   // returns exit code

    // Observation
    GetStatus(ctx context.Context, containerID string) (*ContainerInfo, error)
    GetStats(ctx context.Context, containerID string) (*ContainerStats, error)
    StreamLogs(ctx context.Context, containerID string, follow bool) (io.ReadCloser, error)
    Exec(ctx context.Context, containerID string, cmd []string) (string, int, error)

    // Image management
    ListImages(ctx context.Context) ([]ImageInfo, error)
    RemoveImage(ctx context.Context, image string, force bool) error

    // Runtime info
    Ping(ctx context.Context) error
    Info(ctx context.Context) (*RuntimeInfo, error)
}
```

**Docker implementation** (`internal/services/docker_service.go`) uses `github.com/docker/docker/client`.  
**Podman implementation** (`internal/services/podman_service.go`) uses the same Docker-compatible REST API (Podman socket is Docker API-compatible).

---

### Phase 3: ContainerManager — The Execution Engine (Week 3)

`internal/services/container_manager.go` — parallel to `ProcessManager`, wires `IContainerService` into sessions, logs, lifecycle events, and callbacks.

```go
type ContainerManager struct {
    mu      sync.RWMutex
    running map[string]*runningContainer  // serviceID → state
    status  map[string]ServiceStatus
    manuallyStopped map[string]bool

    containerSvc IContainerService
    appDB        *gorm.DB
    logsDB       *gorm.DB
    log          *zap.Logger

    // Same callbacks as ProcessManager
    OnLogLine func(serviceID, sessionID string, logType models.LogType, line string)
    OnStarted func(serviceID, sessionID string)
    OnStopped func(serviceID, sessionID string, exitCode int)
}

type runningContainer struct {
    containerID string
    sessionID   string
    startedAt   time.Time
    cancelWatch context.CancelFunc
}
```

**`StartService(serviceID)`** flow:
1. Load `Service` + `ContainerConfig` from DB
2. Resolve `image:tag` — call `ImageExists()`, if false call `PullImage()` (stream progress lines to `OnLogLine`)
3. Call `CreateContainer()` — store returned `containerID` back to `ContainerConfig`
4. Create `ServiceSession` in logsDB
5. Write `LifecycleStarted` event
6. Call `StartContainer()`
7. Set status = `Running`, fire `OnStarted`
8. Launch `go watchContainer()` — calls `WaitContainer()` (blocking) then closes session
9. Launch `go bridgeLogs()` — calls `StreamLogs(follow=true)`, pipes to `OnLogLine`

**`StopService(serviceID)`** flow:
1. Set `manuallyStopped = true`
2. Set status = `Stopping`
3. Call `StopContainer(grace=10s)` — sends SIGTERM then SIGKILL
4. If `RemoveOnStop`: call `RemoveContainer()`

**`watchContainer()`** mirrors `waitForExit()` exactly — updates session, writes lifecycle event, fires `OnStopped`, checks `manuallyStopped` for auto-restart.

---

### Phase 4: Unified Service Executor (Week 4)

`internal/services/service_executor.go` — single entry point that routes to the right manager.

```go
type ServiceExecutor struct {
    processManager   *ProcessManager
    containerManager *ContainerManager
    appDB            *gorm.DB
}

func (e *ServiceExecutor) StartService(serviceID string) (string, error) {
    svcType := e.getServiceType(serviceID)
    switch svcType {
    case models.ServiceTypeProcess:
        return e.processManager.StartService(serviceID)
    case models.ServiceTypeDocker, models.ServiceTypePodman:
        return e.containerManager.StartService(serviceID)
    }
    return "", fmt.Errorf("unknown service type: %s", svcType)
}

func (e *ServiceExecutor) StopService(serviceID string) error { ... }
func (e *ServiceExecutor) GetStatus(serviceID string) string  { ... }
func (e *ServiceExecutor) WasManuallyStopped(serviceID string) bool { ... }
func (e *ServiceExecutor) ClearManuallyStopped(serviceID string)    { ... }
```

All existing handlers and workers that currently reference `ProcessManager` are updated to reference `ServiceExecutor` instead. The interface is identical — no worker changes required.

---

### Phase 5: Log Bridging (Week 4)

Container logs are streamed via `docker logs -f <containerID>` and fed into the same `OnLogLine` callback that the process manager uses. This means:

- Real-time SignalR broadcast via `LogHub` — unchanged
- `LogBatchService` batching (50 lines or 2s) — unchanged
- Log search, pagination, cleanup — unchanged
- Log type: stdout lines → `LogTypeStdout`, stderr → `LogTypeStderr`

Docker returns interleaved stdout/stderr with a 8-byte header per frame (Docker multiplexing protocol). The bridge must parse this header to set the correct `LogType`.

---

### Phase 6: Health Checks (Week 5)

The existing `health_check.go` worker calls `ProcessManager.GetStatus()`. After refactor it calls `ServiceExecutor.GetStatus()`.

For containers, health check exec (`HealthCheckExec`) uses `ContainerManager.Exec()` instead of spawning a subprocess. HTTP and TCP checks hit the **host-mapped port** — no change needed.

Auto-restart logic (`auto_restart.go`) uses `ServiceExecutor.WasManuallyStopped()` — no change needed.

---

### Phase 7: Container Infrastructure API (Week 5–6)

New handler: `internal/handlers/containers.go`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/containers/runtime` | Docker/Podman version + socket info |
| GET | `/api/images` | List local images |
| POST | `/api/images/pull` | Pull image (SSE progress stream) |
| DELETE | `/api/images/{name}` | Remove image |
| GET | `/api/volumes` | List volumes |
| POST | `/api/volumes` | Create named volume |
| DELETE | `/api/volumes/{name}` | Remove volume |
| GET | `/api/networks` | List networks |
| POST | `/api/networks` | Create network |
| GET | `/api/services/{id}/container/logs` | Stream container logs (SSE or WS) |
| GET | `/api/services/{id}/container/stats` | Live CPU/mem stats |
| POST | `/api/services/{id}/container/exec` | Run command in container |

---

### Phase 8: Metrics Integration (Week 6)

`metrics_collector.go` currently collects process CPU/mem via `gopsutil`. For containers it calls `ContainerManager.GetStats()` which delegates to `docker stats --no-stream`.

Output fields map directly onto the existing `AppMetric` model — UI charts need no changes.

---

## Configuration

```json
{
  "ContainerRuntime": {
    "Enabled": true,
    "Provider": "Auto",
    "SocketPath": null,
    "DefaultNetwork": "minicluster",
    "DefaultPullPolicy": "IfNotPresent",
    "StopTimeout": 10
  }
}
```

`Provider: "Auto"` tries Docker socket first (`/var/run/docker.sock` on Linux, `npipe:////./pipe/docker_engine` on Windows), then Podman socket (`/run/user/$UID/podman/podman.sock`).

---

## Go Module Dependency

```
github.com/docker/docker v27.x
```

Podman uses the same client — it exposes a Docker-compatible REST API.

---

## Acceptance Criteria

- [ ] `POST /execution/start` on a Docker service pulls image (if absent) and starts container
- [ ] Container stdout/stderr appears in real-time in the UI log viewer
- [ ] `POST /execution/stop` gracefully stops the container (SIGTERM → 10s → SIGKILL)
- [ ] Session records created/closed with correct exit codes
- [ ] `RestartPolicy: OnFailure` restarts the container on non-zero exit
- [ ] `RestartPolicy: Always` restarts even on clean exit (unless manuallyStopped)
- [ ] Health checks work for HTTP, TCP, and Exec types
- [ ] `GET /api/services/{id}/container/stats` returns live CPU/mem usage
- [ ] `POST /api/images/pull` streams progress to the caller
- [ ] Works with both Docker and Podman sockets
- [ ] AutoStart=true containers start on API boot

---

## .NET Parity Note

The .NET API already has `ContainerConfig` schema and REST endpoints (Spec 006 / migration `20260207121832_AddPostMvpFeatures`). The .NET runtime implementation follows the same phases above using `Docker.DotNet` NuGet package and mirrors the Go implementation. .NET work starts after the Go implementation validates the design.
