package services

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ServiceStatus string

const (
	StatusRunning  ServiceStatus = "Running"
	StatusStarting ServiceStatus = "Starting"
	StatusStopping ServiceStatus = "Stopping"
	StatusStopped  ServiceStatus = "Stopped"
	StatusFailed   ServiceStatus = "Failed"
)

type runningProcess struct {
	cmd       *exec.Cmd
	cancel    context.CancelFunc
	sessionID string
	startedAt time.Time
}

// ProcessManager manages service process lifecycle.
type ProcessManager struct {
	mu              sync.RWMutex
	running         map[string]*runningProcess
	status          map[string]ServiceStatus
	manuallyStopped map[string]bool // tracks explicit StopService calls

	appDB  *gorm.DB
	logsDB *gorm.DB
	log    *zap.Logger

	// callbacks for event broadcasting
	OnLogLine func(serviceID, sessionID string, logType models.LogType, line string)
	OnStarted func(serviceID, sessionID string)
	OnStopped func(serviceID, sessionID string, exitCode int)
}

func NewProcessManager(appDB, logsDB *gorm.DB, log *zap.Logger) *ProcessManager {
	return &ProcessManager{
		running:         make(map[string]*runningProcess),
		status:          make(map[string]ServiceStatus),
		manuallyStopped: make(map[string]bool),
		appDB:           appDB,
		logsDB:          logsDB,
		log:             log,
	}
}

// GetStatus returns the current runtime status of a service.
func (pm *ProcessManager) GetStatus(serviceID string) string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	if s, ok := pm.status[serviceID]; ok {
		return string(s)
	}
	return string(StatusStopped)
}

// StartService starts a service by ID.
func (pm *ProcessManager) StartService(serviceID string) (string, error) {
	pm.mu.Lock()
	if s, ok := pm.status[serviceID]; ok && (s == StatusRunning || s == StatusStarting) {
		pm.mu.Unlock()
		return "already running", fmt.Errorf("service %s is already running", serviceID)
	}
	pm.status[serviceID] = StatusStarting
	pm.mu.Unlock()

	var svc models.Service
	if err := pm.appDB.First(&svc, "id = ?", serviceID).Error; err != nil {
		pm.setStatus(serviceID, StatusFailed)
		return "service not found", err
	}

	// resolve executable
	exePath := svc.ExecutablePath
	if !filepath.IsAbs(exePath) {
		if resolved, err := exec.LookPath(exePath); err == nil {
			exePath = resolved
		}
	}

	// build args
	var args []string
	if svc.Arguments != "" {
		args = splitArgs(svc.Arguments)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, exePath, args...)
	cmd.Dir = svc.WorkingDirectory
	cmd.Env = buildEnv(svc.EnvironmentVariables)

	// create session
	sessionID := uuid.NewString()
	session := models.ServiceSession{
		ID:             sessionID,
		ServiceID:      serviceID,
		StartTimestamp: time.Now().UTC(),
		Status:         models.SessionRunning,
	}
	pm.logsDB.Create(&session)

	// lifecycle event
	pm.logsDB.Create(&models.LifecycleEvent{
		ServiceID: serviceID,
		SessionID: sessionID,
		EventType: models.LifecycleStarted,
		Timestamp: time.Now().UTC(),
		Message:   "Service started",
	})

	// wire capture
	if svc.CaptureOutput != models.CaptureModeNone {
		if stdout, err := cmd.StdoutPipe(); err == nil {
			go pm.captureLines(stdout, serviceID, sessionID, models.LogTypeStdout)
		}
	}
	if svc.CaptureOutput == models.CaptureModeBoth {
		if stderr, err := cmd.StderrPipe(); err == nil {
			go pm.captureLines(stderr, serviceID, sessionID, models.LogTypeStderr)
		}
	}

	if err := cmd.Start(); err != nil {
		cancel()
		pm.setStatus(serviceID, StatusFailed)
		pm.logsDB.Create(&models.LifecycleEvent{
			ServiceID: serviceID,
			SessionID: sessionID,
			EventType: models.LifecycleFailed,
			Timestamp: time.Now().UTC(),
			Message:   err.Error(),
		})
		return err.Error(), err
	}

	pm.mu.Lock()
	pm.running[serviceID] = &runningProcess{
		cmd:       cmd,
		cancel:    cancel,
		sessionID: sessionID,
		startedAt: time.Now().UTC(),
	}
	pm.status[serviceID] = StatusRunning
	pm.mu.Unlock()

	if pm.OnStarted != nil {
		pm.OnStarted(serviceID, sessionID)
	}

	// wait in background
	go pm.waitForExit(serviceID, sessionID, cmd, cancel)

	return "", nil
}

// StopService sends SIGTERM/SIGKILL to the running process.
func (pm *ProcessManager) StopService(serviceID string) error {
	pm.mu.Lock()
	proc, ok := pm.running[serviceID]
	if !ok {
		pm.mu.Unlock()
		return nil
	}
	pm.status[serviceID] = StatusStopping
	pm.manuallyStopped[serviceID] = true // mark as intentional stop
	pm.mu.Unlock()

	// cancel context (sends SIGKILL on some platforms) + SIGTERM
	if proc.cmd.Process != nil {
		_ = proc.cmd.Process.Signal(os.Interrupt)
	}

	// give 5s then force kill
	done := make(chan struct{})
	go func() {
		_ = proc.cmd.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		proc.cancel()
	}
	return nil
}

// AutoStartServices starts all services with AutoStart=true on boot.
func (pm *ProcessManager) AutoStartServices() {
	var services []models.Service
	pm.appDB.Where("auto_start = true").Find(&services)
	for _, svc := range services {
		if _, err := pm.StartService(svc.ID); err != nil {
			pm.log.Warn("auto-start failed", zap.String("service", svc.Name), zap.Error(err))
		}
	}
}

// ─── Internal ──────────────────────────────────────────────────────────────

func (pm *ProcessManager) setStatus(serviceID string, status ServiceStatus) {
	pm.mu.Lock()
	pm.status[serviceID] = status
	pm.mu.Unlock()
}

func (pm *ProcessManager) waitForExit(serviceID, sessionID string, cmd *exec.Cmd, cancel context.CancelFunc) {
	defer cancel()
	err := cmd.Wait()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	pm.mu.Lock()
	delete(pm.running, serviceID)
	if exitCode != 0 {
		pm.status[serviceID] = StatusFailed
	} else {
		pm.status[serviceID] = StatusStopped
	}
	pm.mu.Unlock()

	// close session
	now := time.Now().UTC()
	status := models.SessionStopped
	if exitCode != 0 {
		status = models.SessionFailed
	}
	pm.logsDB.Model(&models.ServiceSession{}).Where("id = ?", sessionID).Updates(map[string]any{
		"end_timestamp": now,
		"status":        status,
		"exit_code":     exitCode,
	})

	pm.logsDB.Create(&models.LifecycleEvent{
		ServiceID: serviceID,
		SessionID: sessionID,
		EventType: models.LifecycleStopped,
		Timestamp: now,
		Message:   fmt.Sprintf("Exit code: %d", exitCode),
	})

	if pm.OnStopped != nil {
		pm.OnStopped(serviceID, sessionID, exitCode)
	}
}

// WasManuallyStopped reports whether StopService was explicitly called for the service.
// Auto-restart workers should check this before deciding to restart.
func (pm *ProcessManager) WasManuallyStopped(serviceID string) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.manuallyStopped[serviceID]
}

// ClearManuallyStopped removes the manual-stop flag, e.g. when a service is restarted.
func (pm *ProcessManager) ClearManuallyStopped(serviceID string) {
	pm.mu.Lock()
	delete(pm.manuallyStopped, serviceID)
	pm.mu.Unlock()
}

func (pm *ProcessManager) captureLines(r io.Reader, serviceID, sessionID string, logType models.LogType) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	for scanner.Scan() {
		line := scanner.Text()
		entry := models.SessionLogEntry{
			SessionID: sessionID,
			ServiceID: serviceID,
			Type:      logType,
			Timestamp: time.Now().UTC(),
			Line:      line,
		}
		pm.logsDB.Create(&entry)

		if pm.OnLogLine != nil {
			pm.OnLogLine(serviceID, sessionID, logType, line)
		}
	}
}

func splitArgs(args string) []string {
	// simple split respecting quoted strings
	var result []string
	var current strings.Builder
	inQuote := false
	quoteChar := byte(0)

	for i := 0; i < len(args); i++ {
		c := args[i]
		if inQuote {
			if c == quoteChar {
				inQuote = false
			} else {
				current.WriteByte(c)
			}
		} else {
			switch c {
			case '"', '\'':
				inQuote = true
				quoteChar = c
			case ' ', '\t':
				if current.Len() > 0 {
					result = append(result, current.String())
					current.Reset()
				}
			default:
				current.WriteByte(c)
			}
		}
	}
	if current.Len() > 0 {
		result = append(result, current.String())
	}
	return result
}

func buildEnv(envVarsJSON string) []string {
	// start with current process environment
	env := os.Environ()
	if envVarsJSON == "" {
		return env
	}
	// parse JSON map and append/override
	var m map[string]string
	if err := jsonUnmarshal([]byte(envVarsJSON), &m); err != nil {
		return env
	}
	for k, v := range m {
		env = append(env, k+"="+v)
	}
	return env
}
