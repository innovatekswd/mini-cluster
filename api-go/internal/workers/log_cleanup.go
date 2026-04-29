package workers

import (
	"context"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// LogCleanupWorker removes old log entries based on retention policy.
type LogCleanupWorker struct {
	logsDB          *gorm.DB
	intervalMinutes int
	retentionHours  int
	autoVacuum      bool
	log             *zap.Logger
}

func NewLogCleanupWorker(logsDB *gorm.DB, intervalMinutes, retentionHours int, autoVacuum bool, log *zap.Logger) *LogCleanupWorker {
	return &LogCleanupWorker{
		logsDB:          logsDB,
		intervalMinutes: intervalMinutes,
		retentionHours:  retentionHours,
		autoVacuum:      autoVacuum,
		log:             log,
	}
}

func (w *LogCleanupWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(w.intervalMinutes) * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.cleanup()
		}
	}
}

func (w *LogCleanupWorker) cleanup() {
	cutoff := time.Now().UTC().Add(-time.Duration(w.retentionHours) * time.Hour)
	result := w.logsDB.Where("timestamp < ?", cutoff).Delete(&models.SessionLogEntry{})
	if result.Error != nil {
		w.log.Warn("log cleanup error", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		w.log.Info("log cleanup", zap.Int64("deleted", result.RowsAffected))
	}
	if w.autoVacuum {
		w.logsDB.Exec("VACUUM")
	}
}
