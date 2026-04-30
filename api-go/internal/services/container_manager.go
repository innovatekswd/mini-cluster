package services

import (
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ContainerManager manages the lifecycle of Docker/Podman container services.
// It mirrors ProcessManager exactly — same status machine, same Session/
// LifecycleEvent/LogEntry pipeline, same manuallyStopped guard — so that
// all existing workers (health_check, auto_restart, metrics) work unchanged.
type ContainerManager struct {
	mu              sync.RWMutex
	running         map[string]*runningContainer
	status          map[string]ServiceStatus
	manuallyStopped map[string]bool

	svc    IContainerService
	appDB  *gorm.DB
	logsDB *gorm.DB
	log    *zap.Logger

	// Callbacks — identical signature to ProcessManager
	OnLogLine func(serviceID, sessionID string, logType models.LogType, line string)
	OnStarted func(serviceID, sessionID string)
	OnStopped func(serviceID, sessionID string, exitCode int)
}

type runningContainer struct {
	containerID string
	sessionID   string
	startedAt   time.Time
	cancelWatch context.CancelFunc // cancels watchContainer + bridgeLogs goroutines
}

// NewContainerManager creates a ContainerManager backed by the given IContainerService.
func NewContainerManager(svc IContainerService, appDB, logsDB *gorm.DB, log *zap.Logger) *ContainerManager {
	return &ContainerManager{
		running:         make(map[string]*runningContainer),
		status:          make(map[string]ServiceStatus),
		manuallyStopped: make(map[string]bool),
		svc:             svc,
		appDB:           appDB,
		logsDB:          logsDB,
		log:             log,
	}
}

// GetStatus returns the current runtime status string for a service.
func (cm *ContainerManager) GetStatus(serviceID string) string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if s, ok := cm.status[serviceID]; ok {
		return string(s)
	}
	return string(StatusStopped)
}

// WasManuallyStopped reports whether StopService was explicitly called.
func (cm *ContainerManager) WasManuallyStopped(serviceID string) bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.manuallyStopped[serviceID]
}

// ClearManuallyStopped removes the manual-stop flag (called before auto-restart).
func (cm *ContainerManager) ClearManuallyStopped(serviceID string) {
	cm.mu.Lock()
	delete(cm.manuallyStopped, serviceID)
	cm.mu.Unlock()
}

// ExecInService runs a command inside the running container for serviceID.
// Returns the exit code, or an error if the service is not running.
func (cm *ContainerManager) ExecInService(ctx context.Context, serviceID string, cmd []string) (int, error) {
	cm.mu.RLock()
	rc, ok := cm.running[serviceID]
	cm.mu.RUnlock()
	if !ok {
		return -1, fmt.Errorf("service %s is not running", serviceID)
	}
	result, err := cm.svc.Exec(ctx, rc.containerID, cmd)
	if err != nil {
		return -1, err
	}
	return result.ExitCode, nil
}

// StartService pulls the image if needed, creates the container, starts it,
// opens a session record, and launches background goroutines to watch it.
func (cm *ContainerManager) StartService(serviceID string) (string, error) {
	cm.mu.Lock()
	if s, ok := cm.status[serviceID]; ok && (s == StatusRunning || s == StatusStarting) {
		cm.mu.Unlock()
		return "already running", fmt.Errorf("container service %s is already running", serviceID)
	}
	cm.status[serviceID] = StatusStarting
	cm.mu.Unlock()

	// Load service + container config
	var svc models.Service
	if err := cm.appDB.Preload("ContainerConfig").First(&svc, "id = ?", serviceID).Error; err != nil {
		cm.setStatus(serviceID, StatusFailed)
		return "service not found", err
	}
	if svc.ContainerConfig == nil {
		cm.setStatus(serviceID, StatusFailed)
		return "no container config", fmt.Errorf("service %s has no ContainerConfig", serviceID)
	}
	cfg := svc.ContainerConfig

	ctx := context.Background()
	sessionID := uuid.NewString()

	// ── Image phase ──────────────────────────────────────────────────────────
	imageRef := cfg.Image + ":" + cfg.Tag
	exists, err := cm.svc.ImageExists(ctx, imageRef)
	if err != nil {
		cm.setStatus(serviceID, StatusFailed)
		return "image check failed", err
	}
	if !exists || cfg.PullPolicy == models.PullAlways {
		cm.emitLog(serviceID, sessionID, models.LogTypeStdout, "Pulling image "+imageRef+" …")
		if err := cm.svc.PullImage(ctx, imageRef, func(line string) {
			cm.emitLog(serviceID, sessionID, models.LogTypeStdout, line)
		}); err != nil {
			cm.setStatus(serviceID, StatusFailed)
			return "image pull failed", err
		}
	}

	// ── Create phase ─────────────────────────────────────────────────────────
	envVars := parseEnvMap(svc.EnvironmentVariables)
	containerID, err := cm.svc.CreateContainer(ctx, cfg, envVars)
	if err != nil {
		cm.setStatus(serviceID, StatusFailed)
		return "create failed", err
	}

	// Persist containerID so other code (e.g. exec, logs) can reference it
	cm.appDB.Model(cfg).Update("container_id", containerID)

	// ── Session record ───────────────────────────────────────────────────────
	session := models.ServiceSession{
		ID:             sessionID,
		ServiceID:      serviceID,
		StartTimestamp: time.Now().UTC(),
		Status:         models.SessionRunning,
	}
	cm.logsDB.Create(&session)

	cm.logsDB.Create(&models.LifecycleEvent{
		ServiceID: serviceID,
		SessionID: sessionID,
		EventType: models.LifecycleStarted,
		Timestamp: time.Now().UTC(),
		Message:   "Container started: " + containerID[:12],
	})

	// ── Start container ──────────────────────────────────────────────────────
	if err := cm.svc.StartContainer(ctx, containerID); err != nil {
		cm.setStatus(serviceID, StatusFailed)
		cm.closeSession(sessionID, serviceID, -1)
		return "start failed", err
	}

	watchCtx, cancelWatch := context.WithCancel(context.Background())

	cm.mu.Lock()
	cm.running[serviceID] = &runningContainer{
		containerID: containerID,
		sessionID:   sessionID,
		startedAt:   time.Now().UTC(),
		cancelWatch: cancelWatch,
	}
	cm.status[serviceID] = StatusRunning
	cm.mu.Unlock()

	if cm.OnStarted != nil {
		cm.OnStarted(serviceID, sessionID)
	}

	// ── Background goroutines ────────────────────────────────────────────────
	go cm.watchContainer(watchCtx, serviceID, sessionID, containerID)
	go cm.bridgeLogs(watchCtx, serviceID, sessionID, containerID)

	return "", nil
}

// StopService gracefully stops the container (SIGTERM → 10s → SIGKILL).
// If ContainerConfig.RemoveOnStop is set, removes the container afterwards.
func (cm *ContainerManager) StopService(serviceID string) error {
	cm.mu.Lock()
	rc, ok := cm.running[serviceID]
	if !ok {
		cm.mu.Unlock()
		return nil
	}
	cm.status[serviceID] = StatusStopping
	cm.manuallyStopped[serviceID] = true
	containerID := rc.containerID
	cm.mu.Unlock()

	timeout := 10
	if err := cm.svc.StopContainer(context.Background(), containerID, timeout); err != nil {
		cm.log.Warn("container stop error", zap.String("service", serviceID), zap.Error(err))
	}

	// Remove container if RemoveOnStop is configured
	var cfg models.ContainerConfig
	if err := cm.appDB.Where("service_id = ?", serviceID).First(&cfg).Error; err == nil && cfg.RemoveOnStop {
		if err := cm.svc.RemoveContainer(context.Background(), containerID, false); err != nil {
			cm.log.Warn("container remove error", zap.String("service", serviceID), zap.Error(err))
		} else {
			cm.appDB.Model(&cfg).Update("container_id", "")
		}
	}

	return nil
}

// ─── Internal ────────────────────────────────────────────────────────────────

func (cm *ContainerManager) setStatus(serviceID string, status ServiceStatus) {
	cm.mu.Lock()
	cm.status[serviceID] = status
	cm.mu.Unlock()
}

func (cm *ContainerManager) emitLog(serviceID, sessionID string, logType models.LogType, line string) {
	if cm.OnLogLine != nil {
		cm.OnLogLine(serviceID, sessionID, logType, line)
	}
}

// watchContainer blocks on WaitContainer (blocking call) until the container
// exits, then closes the session and fires the OnStopped callback.
// This is the container equivalent of ProcessManager.waitForExit.
func (cm *ContainerManager) watchContainer(ctx context.Context, serviceID, sessionID, containerID string) {
	exitCode, err := cm.svc.WaitContainer(ctx, containerID)
	if err != nil && ctx.Err() != nil {
		// Context cancelled by StopService — normal stop path
		exitCode = 0
	}

	cm.mu.Lock()
	rc := cm.running[serviceID]
	delete(cm.running, serviceID)
	if exitCode != 0 {
		cm.status[serviceID] = StatusFailed
	} else {
		cm.status[serviceID] = StatusStopped
	}
	cm.mu.Unlock()

	if rc != nil {
		rc.cancelWatch() // also stops bridgeLogs
	}

	cm.closeSession(sessionID, serviceID, exitCode)

	if cm.OnStopped != nil {
		cm.OnStopped(serviceID, sessionID, exitCode)
	}
}

// bridgeLogs streams container stdout/stderr into the existing log pipeline
// (LogBatchService → SQLite → SignalR) via the OnLogLine callback.
func (cm *ContainerManager) bridgeLogs(ctx context.Context, serviceID, sessionID, containerID string) {
	reader, err := cm.svc.StreamLogs(ctx, containerID, true)
	if err != nil {
		cm.log.Warn("container log stream failed", zap.String("service", serviceID), zap.Error(err))
		return
	}
	defer reader.Close()

	for {
		frame, err := ReadDockerLogStream(reader)
		if err != nil {
			if err == io.EOF || ctx.Err() != nil {
				break
			}
			// Transient read error — stop bridging
			cm.log.Warn("docker log stream read error", zap.String("service", serviceID), zap.Error(err))
			break
		}

		lines := strings.SplitAfter(string(frame.Data), "\n")
		logType := models.LogTypeStdout
		if frame.IsStderr {
			logType = models.LogTypeStderr
		}
		for _, line := range lines {
			line = strings.TrimRight(line, "\n\r")
			if line == "" {
				continue
			}
			cm.emitLog(serviceID, sessionID, logType, line)
		}
	}
}

func (cm *ContainerManager) closeSession(sessionID, serviceID string, exitCode int) {
	now := time.Now().UTC()
	status := models.SessionStopped
	if exitCode != 0 {
		status = models.SessionFailed
	}
	cm.logsDB.Model(&models.ServiceSession{}).Where("id = ?", sessionID).Updates(map[string]any{
		"end_timestamp": now,
		"status":        status,
		"exit_code":     exitCode,
	})
	cm.logsDB.Create(&models.LifecycleEvent{
		ServiceID: serviceID,
		SessionID: sessionID,
		EventType: models.LifecycleStopped,
		Timestamp: now,
		Message:   fmt.Sprintf("Container exited with code %d", exitCode),
	})
}

// parseEnvMap deserializes the JSON env-var map stored on Service.
func parseEnvMap(envJSON string) map[string]string {
	if envJSON == "" {
		return nil
	}
	result := make(map[string]string)
	// models already has a parseEnvMap equivalent; reuse if present
	_ = result
	// simple inline parse
	var m map[string]string
	if err := jsonUnmarshal([]byte(envJSON), &m); err == nil {
		return m
	}
	return nil
}
