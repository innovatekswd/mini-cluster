package workers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/innovatek/minicluster/internal/handlers"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/services"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
	psproc "github.com/shirou/gopsutil/v3/process"
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
		CpuUsagePercent:     snap.CpuUsagePercent,
		TotalPhysicalMemory: snap.TotalPhysicalMemory,
		UsedPhysicalMemory:  snap.UsedPhysicalMemory,
		MemoryUsagePercent:  snap.MemoryUsagePercent,
		TotalProcesses:      snap.TotalProcesses,
		SendRate:            snap.TotalNetworkSendRate,
		ReceiveRate:         snap.TotalNetworkReceiveRate,
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
	snap := handlers.SystemMetricsSnapshot{
		Timestamp:         time.Now().UTC(),
		Disks:             []handlers.DiskInfo{},
		NetworkInterfaces: []handlers.NetworkInterfaceInfo{},
	}

	// ── CPU ──────────────────────────────────────────────────────────────────
	if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		snap.CpuUsagePercent = percents[0]
	}

	// ── Memory ───────────────────────────────────────────────────────────────
	if vm, err := mem.VirtualMemory(); err == nil {
		snap.TotalPhysicalMemory = int64(vm.Total)
		snap.UsedPhysicalMemory = int64(vm.Used)
		snap.MemoryUsagePercent = vm.UsedPercent
	}

	// ── Disks ────────────────────────────────────────────────────────────────
	if parts, err := disk.Partitions(false); err == nil {
		for _, p := range parts {
			if usage, err := disk.Usage(p.Mountpoint); err == nil {
				snap.Disks = append(snap.Disks, handlers.DiskInfo{
					Name:         p.Mountpoint,
					TotalSize:    int64(usage.Total),
					UsedSpace:    int64(usage.Used),
					AvailSpace:   int64(usage.Free),
					UsagePercent: usage.UsedPercent,
				})
			}
		}
	}

	// ── Network ──────────────────────────────────────────────────────────────
	if ifaces, err := psnet.IOCounters(true); err == nil {
		var totalSend, totalRecv float64
		for _, iface := range ifaces {
			snap.NetworkInterfaces = append(snap.NetworkInterfaces, handlers.NetworkInterfaceInfo{
				Name:        iface.Name,
				SendRate:    float64(iface.BytesSent),
				ReceiveRate: float64(iface.BytesRecv),
				Status:      "up",
			})
			totalSend += float64(iface.BytesSent)
			totalRecv += float64(iface.BytesRecv)
		}
		snap.TotalNetworkSendRate = totalSend
		snap.TotalNetworkReceiveRate = totalRecv
	}

	// ── Process count ────────────────────────────────────────────────────────
	if procs, err := psproc.Pids(); err == nil {
		snap.TotalProcesses = len(procs)
	}

	// ── Uptime ───────────────────────────────────────────────────────────────
	if info, err := host.Info(); err == nil {
		upSec := time.Duration(info.Uptime) * time.Second
		h := int(upSec.Hours())
		m := int(upSec.Minutes()) % 60
		snap.SystemUptime = fmt.Sprintf("%dd %dh %dm", h/24, h%24, m)
	}

	return snap
}

