package workers

import (
	"context"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// HealthCheckWorker probes services with health checks and triggers restarts.
type HealthCheckWorker struct {
	appDB          *gorm.DB
	log            *zap.Logger
	OnTriggerStart func(serviceID string)
}

func NewHealthCheckWorker(appDB *gorm.DB, log *zap.Logger) *HealthCheckWorker {
	return &HealthCheckWorker{appDB: appDB, log: log}
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
			w.probe(svc)
		}
	}
}

func (w *HealthCheckWorker) probe(svc models.Service) {
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
