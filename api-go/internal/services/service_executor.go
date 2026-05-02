package services

import (
	"context"
	"fmt"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ServiceExecutor is the single entry point for service lifecycle operations.
// It routes Start/Stop/Status calls to either ProcessManager or ContainerManager
// based on Service.ServiceType, so all handlers and workers use one interface.
type ServiceExecutor struct {
	processManager   *ProcessManager
	containerManager *ContainerManager
	appDB            *gorm.DB
	log              *zap.Logger
}

// NewServiceExecutor wires up both managers. containerManager may be nil
// if no container runtime is available — container services will return an error.
func NewServiceExecutor(pm *ProcessManager, cm *ContainerManager, appDB *gorm.DB, log *zap.Logger) *ServiceExecutor {
	return &ServiceExecutor{
		processManager:   pm,
		containerManager: cm,
		appDB:            appDB,
		log:              log,
	}
}

// StartService starts a service, routing to the correct manager.
func (e *ServiceExecutor) StartService(serviceID string) (string, error) {
	svcType, err := e.getServiceType(serviceID)
	if err != nil {
		return "service not found", err
	}
	switch svcType {
	case models.ServiceTypeProcess:
		return e.processManager.StartService(serviceID)
	case models.ServiceTypeDocker, models.ServiceTypePodman:
		if e.containerManager == nil {
			return "no container runtime", fmt.Errorf("container runtime is not configured")
		}
		return e.containerManager.StartService(serviceID)
	default:
		return "unknown type", fmt.Errorf("unknown service type: %s", svcType)
	}
}

// StopService stops a running service.
func (e *ServiceExecutor) StopService(serviceID string) error {
	svcType, err := e.getServiceType(serviceID)
	if err != nil {
		return err
	}
	switch svcType {
	case models.ServiceTypeProcess:
		return e.processManager.StopService(serviceID)
	case models.ServiceTypeDocker, models.ServiceTypePodman:
		if e.containerManager == nil {
			return fmt.Errorf("container runtime is not configured")
		}
		return e.containerManager.StopService(serviceID)
	default:
		return fmt.Errorf("unknown service type: %s", svcType)
	}
}

// GetStatus returns the runtime status string for a service.
func (e *ServiceExecutor) GetStatus(serviceID string) string {
	// Check both managers — only one will have a non-Stopped status
	if s := e.processManager.GetStatus(serviceID); s != string(StatusStopped) {
		return s
	}
	if e.containerManager != nil {
		return e.containerManager.GetStatus(serviceID)
	}
	return string(StatusStopped)
}

// WasManuallyStopped delegates to the correct manager.
func (e *ServiceExecutor) WasManuallyStopped(serviceID string) bool {
	if e.processManager.WasManuallyStopped(serviceID) {
		return true
	}
	if e.containerManager != nil {
		return e.containerManager.WasManuallyStopped(serviceID)
	}
	return false
}

// ClearManuallyStopped clears the flag on the correct manager.
func (e *ServiceExecutor) ClearManuallyStopped(serviceID string) {
	e.processManager.ClearManuallyStopped(serviceID)
	if e.containerManager != nil {
		e.containerManager.ClearManuallyStopped(serviceID)
	}
}

// ExecContainer runs a command inside a running container for the given service.
// Returns the exit code (or error if the service is not a container or not running).
func (e *ServiceExecutor) ExecContainer(ctx context.Context, serviceID string, cmd []string) (int, error) {
	if e.containerManager == nil {
		return -1, fmt.Errorf("container runtime not configured")
	}
	return e.containerManager.ExecInService(ctx, serviceID, cmd)
}

// AutoStartServices starts all services with AutoStart=true on boot.
func (e *ServiceExecutor) AutoStartServices() {
	var services []models.Service
	e.appDB.Where("auto_start = true").Find(&services)
	for _, svc := range services {
		if _, err := e.StartService(svc.ID); err != nil {
			e.log.Warn("auto-start failed", zap.String("service", svc.Name), zap.Error(err))
		}
	}
}

// ─── Internal ─────────────────────────────────────────────────────────────

func (e *ServiceExecutor) getServiceType(serviceID string) (models.ServiceType, error) {
	var svc models.Service
	if err := e.appDB.Select("service_type").First(&svc, "id = ?", serviceID).Error; err != nil {
		return "", err
	}
	if svc.ServiceType == "" {
		return models.ServiceTypeProcess, nil
	}
	return svc.ServiceType, nil
}
