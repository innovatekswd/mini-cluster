package workers

import (
	"context"
	"strings"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// healthCheckExecutor is the subset of ServiceExecutor needed by HealthCheckWorker.
type healthCheckExecutor interface {
	GetStatus(serviceID string) string
	ExecContainer(ctx context.Context, serviceID string, cmd []string) (int, error)
}

// HealthCheckWorker probes services with health checks and triggers restarts.
type HealthCheckWorker struct {
	appDB          *gorm.DB
	executor       healthCheckExecutor
	log            *zap.Logger
	OnTriggerStart func(serviceID string)
}

func NewHealthCheckWorker(appDB *gorm.DB, executor healthCheckExecutor, log *zap.Logger) *HealthCheckWorker {
	return &HealthCheckWorker{appDB: appDB, executor: executor, log: log}
}

func (w *HealthCheckWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.checkAll(ctx)
		}
	}
}

func (w *HealthCheckWorker) checkAll(ctx context.Context) {
	var services []models.Service
	w.appDB.Where("health_check_type != ?", models.HealthCheckNone).Find(&services)
	for _, svc := range services {
		select {
		case <-ctx.Done():
			return
		default:
			// Only probe services that are actually running
			if w.executor != nil && w.executor.GetStatus(svc.ID) != "Running" {
				continue
			}
			w.probe(ctx, svc)
		}
	}
}

func (w *HealthCheckWorker) probe(ctx context.Context, svc models.Service) {
	timeout := time.Duration(svc.HealthCheckTimeout) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	var healthy bool
	switch svc.HealthCheckType {
	case models.HealthCheckHttp:
		healthy = probeHTTP(svc.HealthCheckUrl, timeout)
	case models.HealthCheckTcp:
		healthy = probeTCP(svc.HealthCheckUrl, timeout)
	case models.HealthCheckExec:
		if svc.HealthCheckCommand == "" {
			return
		}
		cmd := strings.Fields(svc.HealthCheckCommand)
		if w.executor != nil {
			probeCtx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()
			exitCode, err := w.executor.ExecContainer(probeCtx, svc.ID, cmd)
			healthy = err == nil && exitCode == 0
		}
	default:
		return
	}

	if !healthy {
		w.log.Warn("health check failed", zap.String("service", svc.Name))
		if w.OnTriggerStart != nil {
			w.OnTriggerStart(svc.ID)
		}
	}
}
