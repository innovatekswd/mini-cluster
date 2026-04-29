package workers

import (
	"context"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// HeartbeatMonitor watches machine heartbeats and marks agents offline when missed.
type HeartbeatMonitor struct {
	db              *gorm.DB
	checkInterval   time.Duration
	offlineAfter    time.Duration
	log             *zap.Logger
	OnNodeOffline   func(machine *models.Machine)
	OnNodeRecovered func(machine *models.Machine)
}

func NewHeartbeatMonitor(db *gorm.DB, log *zap.Logger) *HeartbeatMonitor {
	return &HeartbeatMonitor{
		db:            db,
		checkInterval: 30 * time.Second,
		offlineAfter:  90 * time.Second, // 3 missed heartbeats at 30s
		log:           log,
	}
}

func (m *HeartbeatMonitor) Run(ctx context.Context) {
	ticker := time.NewTicker(m.checkInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.check()
		}
	}
}

func (m *HeartbeatMonitor) check() {
	var agents []models.Machine
	m.db.Where("connection_type = ? AND is_local = false", models.ConnectionAgent).Find(&agents)

	for _, agent := range agents {
		if agent.LastSeen == nil {
			continue
		}
		elapsed := time.Since(*agent.LastSeen)
		wasOnline := agent.Status == models.MachineOnline || agent.Status == models.MachineDegraded
		if elapsed > m.offlineAfter && wasOnline {
			m.db.Model(&agent).Updates(map[string]any{
				"status":      models.MachineOffline,
				"modified_at": time.Now().UTC(),
			})
			m.log.Info("agent went offline", zap.String("machine", agent.Name))
			if m.OnNodeOffline != nil {
				m.OnNodeOffline(&agent)
			}
		}
	}
}
