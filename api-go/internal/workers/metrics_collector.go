package workers

import (
	"context"
	"runtime"
	"sync"
	"time"

	"github.com/innovatek/minicluster/internal/handlers"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/services"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// MetricsCollector collects system and process metrics at regular intervals.
type MetricsCollector struct {
	logsDB          *gorm.DB
	appDB           *gorm.DB // queries active service sessions for container metrics
	intervalSeconds int
	log             *zap.Logger
	containerMgr    *services.ContainerManager // nil when no container runtime available

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

// SetContainerManager wires the optional container runtime into the collector.
// Must be called before Run.
func (c *MetricsCollector) SetContainerManager(cm *services.ContainerManager, appDB *gorm.DB) {
	c.containerMgr = cm
	c.appDB = appDB
}

func (c *MetricsCollector) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(c.intervalSeconds) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.collect(ctx)
		}
	}
}

func (c *MetricsCollector) collect(ctx context.Context) {
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

	if c.containerMgr != nil {
		c.collectContainerMetrics(ctx)
	}
}

// collectContainerMetrics fetches docker stats for every running container
// service and stores them as ProcessMetrics rows, mirroring what the
// process-level collector does for native processes.
func (c *MetricsCollector) collectContainerMetrics(ctx context.Context) {
	serviceIDs := c.containerMgr.RunningServiceIDs()
	if len(serviceIDs) == 0 {
		return
	}

	// Resolve active session IDs in bulk.
	type row struct {
		ServiceID string
		SessionID string
	}
	var sessions []row
	if c.appDB != nil {
		// ServiceSession lives in logsDB
		c.logsDB.
			Model(&models.ServiceSession{}).
			Select("service_id, id as session_id").
			Where("service_id IN ? AND status = ?", serviceIDs, models.SessionRunning).
			Scan(&sessions)
	}
	sessionByService := make(map[string]string, len(sessions))
	for _, s := range sessions {
		sessionByService[s.ServiceID] = s.SessionID
	}

	now := time.Now().UTC()
	snapshots := make(map[string]handlers.ProcessMetricsSnapshot, len(serviceIDs))

	for _, serviceID := range serviceIDs {
		stats, err := c.containerMgr.GetStats(ctx, serviceID)
		if err != nil {
			c.log.Warn("container stats error", zap.String("service", serviceID), zap.Error(err))
			continue
		}
		if stats == nil {
			continue // service stopped between the two calls
		}

		memMB := float64(stats.MemoryUsage) / (1024 * 1024)

		snapshots[serviceID] = handlers.ProcessMetricsSnapshot{
			ServiceID:  serviceID,
			CpuPercent: stats.CPUPercent,
			MemoryMB:   memMB,
			Timestamp:  now,
		}

		c.logsDB.Create(&models.ProcessMetrics{
			ServiceID:            serviceID,
			SessionID:            sessionByService[serviceID],
			Timestamp:            now,
			WorkingSetMemory:     stats.MemoryUsage,
			PrivateMemory:        stats.MemoryUsage,
			CpuUsagePercent:      stats.CPUPercent,
			NetworkBytesReceived: stats.NetworkRxB,
			NetworkBytesSent:     stats.NetworkTxB,
			DiskBytesRead:        stats.BlockReadB,
			DiskBytesWritten:     stats.BlockWriteB,
		})
	}

	c.mu.Lock()
	for id, snap := range snapshots {
		c.current[id] = snap
	}
	c.mu.Unlock()
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

