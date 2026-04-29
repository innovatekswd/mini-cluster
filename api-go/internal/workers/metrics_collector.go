package workers

import (
	"context"
	"runtime"
	"sync"
	"time"

	"github.com/innovatek/minicluster/internal/handlers"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// MetricsCollector collects system and process metrics at regular intervals.
type MetricsCollector struct {
	logsDB          *gorm.DB
	intervalSeconds int
	log             *zap.Logger

	mu      sync.RWMutex
	current map[string]handlers.ProcessMetricsSnapshot
	system  handlers.SystemMetricsSnapshot
}

func NewMetricsCollector(logsDB *gorm.DB, intervalSeconds int, log *zap.Logger) *MetricsCollector {
	return &MetricsCollector{
		logsDB:          logsDB,
		intervalSeconds: intervalSeconds,
		log:             log,
		current:         make(map[string]handlers.ProcessMetricsSnapshot),
	}
}

func (c *MetricsCollector) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(c.intervalSeconds) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.collect()
		}
	}
}

func (c *MetricsCollector) collect() {
	snap := c.collectSystem()
	c.mu.Lock()
	c.system = snap
	c.mu.Unlock()

	c.logsDB.Create(&models.SystemMetrics{
		Timestamp:           time.Now().UTC(),
		CpuUsagePercent:     snap.CpuPercent,
		TotalPhysicalMemory: snap.TotalMemoryMB * 1024 * 1024,
		UsedPhysicalMemory:  snap.UsedMemoryMB * 1024 * 1024,
		MemoryUsagePercent:  snap.MemoryPercent,
	})
}

// GetAllCurrentMetrics implements MetricsProvider.
func (c *MetricsCollector) GetAllCurrentMetrics() map[string]handlers.ProcessMetricsSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make(map[string]handlers.ProcessMetricsSnapshot, len(c.current))
	for k, v := range c.current {
		result[k] = v
	}
	return result
}

// GetSystemMetrics implements MetricsProvider.
func (c *MetricsCollector) GetSystemMetrics() handlers.SystemMetricsSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.system
}

// GetSystemProcesses implements MetricsProvider (returns empty list — OS-level enumeration is platform-specific).
func (c *MetricsCollector) GetSystemProcesses() []handlers.SystemProcessInfo {
	return []handlers.SystemProcessInfo{}
}

func (c *MetricsCollector) collectSystem() handlers.SystemMetricsSnapshot {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	total := int64(ms.Sys / 1024 / 1024)
	used := int64(ms.Alloc / 1024 / 1024)
	percent := 0.0
	if total > 0 {
		percent = float64(used) / float64(total) * 100
	}
	return handlers.SystemMetricsSnapshot{
		MemoryPercent: percent,
		TotalMemoryMB: total,
		UsedMemoryMB:  used,
		Timestamp:     time.Now().UTC(),
	}
}
