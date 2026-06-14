package workers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/services"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	psnet "github.com/shirou/gopsutil/v3/net"
	psproc "github.com/shirou/gopsutil/v3/process"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// networkState tracks previous sample values for delta-based rate computation.
type networkState struct {
	prevBytesSent   uint64
	prevBytesRecv   uint64
	prevPacketsSent uint64
	prevPacketsRecv uint64
	prevTime        time.Time
}

// diskState tracks previous sample values for disk rate computation.
type diskState struct {
	prevReadBytes  uint64
	prevWriteBytes uint64
	prevReadCount  uint64
	prevWriteCount uint64
	prevReadTime   uint64
	prevWriteTime  uint64
	prevTime       time.Time
}

// MetricsCollector collects system and process metrics at regular intervals.
type MetricsCollector struct {
	logsDB          *gorm.DB
	appDB           *gorm.DB // queries active service sessions for container metrics
	intervalSeconds int
	log             *zap.Logger
	containerMgr    *services.ContainerManager // nil when no container runtime available

	mu      sync.RWMutex
	current map[string]models.ProcessMetricsSnapshot
	system  models.SystemMetricsSnapshot

	// Network state for delta computation (keyed by interface name)
	networkState map[string]*networkState
	// Disk state for delta computation (keyed by mount point)
	diskState map[string]*diskState
}

func NewMetricsCollector(logsDB *gorm.DB, intervalSeconds int, log *zap.Logger) *MetricsCollector {
	return &MetricsCollector{
		logsDB:          logsDB,
		intervalSeconds: intervalSeconds,
		log:             log,
		current:         make(map[string]models.ProcessMetricsSnapshot),
		networkState:    make(map[string]*networkState),
		diskState:       make(map[string]*diskState),
	}
}

// computeDelta calculates the rate between two counter values, guarding against counter resets.
// Returns 0 if previous is 0 (first sample) or if current < previous (counter reset).
func computeDelta(current, previous uint64, elapsed float64) float64 {
	if elapsed <= 0 || previous == 0 {
		return 0 // first sample or no elapsed time
	}
	if current < previous {
		return 0 // counter reset (reboot, interface flap)
	}
	return float64(current-previous) / elapsed
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
		Timestamp:            time.Now().UTC(),
		CpuUsagePercent:      snap.CpuUsagePercent,
		CpuLoad1m:            snap.CpuLoad1m,
		CpuLoad5m:            snap.CpuLoad5m,
		CpuLoad15m:           snap.CpuLoad15m,
		TotalPhysicalMemory:  snap.TotalPhysicalMemory,
		UsedPhysicalMemory:   snap.UsedPhysicalMemory,
		AvailableMemory:      snap.AvailableMemory,
		CachedMemory:         snap.CachedMemory,
		BuffersMemory:        snap.BuffersMemory,
		MemoryUsagePercent:   snap.MemoryUsagePercent,
		SwapTotal:            snap.SwapTotal,
		SwapUsed:             snap.SwapUsed,
		SwapPercent:          snap.SwapPercent,
		TotalProcesses:       snap.TotalProcesses,
		NetworkBytesSent:     snap.TotalBytesSent,
		NetworkBytesReceived: snap.TotalBytesRecv,
		SendRate:             snap.TotalNetworkSendRate,
		ReceiveRate:          snap.TotalNetworkReceiveRate,
		NetworkPacketsSent:   snap.TotalPacketsSent,
		NetworkPacketsRecv:   snap.TotalPacketsRecv,
		NetworkErrorsIn:      snap.TotalErrorsIn,
		NetworkErrorsOut:     snap.TotalErrorsOut,
		NetworkDropsIn:       snap.TotalDropsIn,
		NetworkDropsOut:      snap.TotalDropsOut,
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
	snapshots := make(map[string]models.ProcessMetricsSnapshot, len(serviceIDs))

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

		snapshots[serviceID] = models.ProcessMetricsSnapshot{
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
func (c *MetricsCollector) GetAllCurrentMetrics() map[string]models.ProcessMetricsSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make(map[string]models.ProcessMetricsSnapshot, len(c.current))
	for k, v := range c.current {
		result[k] = v
	}
	return result
}

// GetSystemMetrics implements MetricsProvider.
func (c *MetricsCollector) GetSystemMetrics() models.SystemMetricsSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.system
}

// GetSystemProcesses implements MetricsProvider (returns empty list — OS-level enumeration is platform-specific).
func (c *MetricsCollector) GetSystemProcesses() []models.SystemProcessInfo {
	return []models.SystemProcessInfo{}
}

func (c *MetricsCollector) collectSystem() models.SystemMetricsSnapshot {
	snap := models.SystemMetricsSnapshot{
		Timestamp:         time.Now().UTC(),
		Disks:             []models.DiskInfo{},
		NetworkInterfaces: []models.NetworkInterfaceInfo{},
	}

	// ── CPU ──────────────────────────────────────────────────────────────────
	if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		snap.CpuUsagePercent = percents[0]
	}

	// ── Load averages ────────────────────────────────────────────────────────
	if avg, err := load.Avg(); err == nil {
		snap.CpuLoad1m = avg.Load1
		snap.CpuLoad5m = avg.Load5
		snap.CpuLoad15m = avg.Load15
	}

	// ── Memory ───────────────────────────────────────────────────────────────
	if vm, err := mem.VirtualMemory(); err == nil {
		snap.TotalPhysicalMemory = int64(vm.Total)
		snap.UsedPhysicalMemory = int64(vm.Used)
		snap.AvailableMemory = int64(vm.Available)
		snap.CachedMemory = int64(vm.Cached)
		snap.BuffersMemory = int64(vm.Buffers)
		snap.MemoryUsagePercent = vm.UsedPercent
	}
	if sw, err := mem.SwapMemory(); err == nil {
		snap.SwapTotal = int64(sw.Total)
		snap.SwapUsed = int64(sw.Used)
		snap.SwapPercent = sw.UsedPercent
	}

	// ── Disks ────────────────────────────────────────────────────────────────
	now := time.Now()
	if parts, err := disk.Partitions(false); err == nil {
		// Get IO counters for rate computation
		ioCounters, _ := disk.IOCounters()
		
		for _, p := range parts {
			if usage, err := disk.Usage(p.Mountpoint); err == nil {
				diskInfo := models.DiskInfo{
					Name:          p.Mountpoint,
					TotalSize:     int64(usage.Total),
					UsedSpace:     int64(usage.Used),
					AvailSpace:    int64(usage.Free),
					UsagePercent:  usage.UsedPercent,
					InodesUsed:    int64(usage.InodesUsed),
					InodesFree:    int64(usage.InodesFree),
					InodesPercent: usage.InodesUsedPercent,
				}
				
				// Compute IO rates if available
				if io, ok := ioCounters[p.Device]; ok {
					prev := c.diskState[p.Mountpoint]
					if prev == nil {
						prev = &diskState{prevTime: now}
						c.diskState[p.Mountpoint] = prev
					}
					
					elapsed := now.Sub(prev.prevTime).Seconds()
					
					diskInfo.ReadBytes = int64(io.ReadBytes)
					diskInfo.WriteBytes = int64(io.WriteBytes)
					diskInfo.ReadOps = int64(io.ReadCount)
					diskInfo.WriteOps = int64(io.WriteCount)
					diskInfo.ReadTimeMs = int64(io.ReadTime)
					diskInfo.WriteTimeMs = int64(io.WriteTime)
					
					// Compute rates
					diskInfo.ReadRate = computeDelta(io.ReadBytes, prev.prevReadBytes, elapsed)
					diskInfo.WriteRate = computeDelta(io.WriteBytes, prev.prevWriteBytes, elapsed)
					diskInfo.ReadOpsRate = computeDelta(io.ReadCount, prev.prevReadCount, elapsed)
					diskInfo.WriteOpsRate = computeDelta(io.WriteCount, prev.prevWriteCount, elapsed)
					
					// Update state
					prev.prevReadBytes = io.ReadBytes
					prev.prevWriteBytes = io.WriteBytes
					prev.prevReadCount = io.ReadCount
					prev.prevWriteCount = io.WriteCount
					prev.prevReadTime = io.ReadTime
					prev.prevWriteTime = io.WriteTime
					prev.prevTime = now
				}
				
				snap.Disks = append(snap.Disks, diskInfo)
			}
		}
	}

	// ── Network ──────────────────────────────────────────────────────────────
	if ifaces, err := psnet.IOCounters(true); err == nil {
		var totalSendRate, totalRecvRate float64
		var totalBytesSent, totalBytesRecv int64
		var totalPacketsSent, totalPacketsRecv int64
		var totalErrorsIn, totalErrorsOut int64
		var totalDropsIn, totalDropsOut int64

		for _, iface := range ifaces {
			prev := c.networkState[iface.Name]
			if prev == nil {
				prev = &networkState{prevTime: now}
				c.networkState[iface.Name] = prev
			}

			elapsed := now.Sub(prev.prevTime).Seconds()

			// Compute rates from deltas
			sendRate := computeDelta(iface.BytesSent, prev.prevBytesSent, elapsed)
			recvRate := computeDelta(iface.BytesRecv, prev.prevBytesRecv, elapsed)

			snap.NetworkInterfaces = append(snap.NetworkInterfaces, models.NetworkInterfaceInfo{
				Name:           iface.Name,
				BytesSentTotal: int64(iface.BytesSent),
				BytesRecvTotal: int64(iface.BytesRecv),
				PacketsSent:    int64(iface.PacketsSent),
				PacketsRecv:    int64(iface.PacketsRecv),
				ErrorsIn:       int64(iface.Errin),
				ErrorsOut:      int64(iface.Errout),
				DropsIn:        int64(iface.Dropin),
				DropsOut:       int64(iface.Dropout),
				SendRate:       sendRate,
				ReceiveRate:    recvRate,
				Status:         "up",
			})

			// Update state for next sample
			prev.prevBytesSent = iface.BytesSent
			prev.prevBytesRecv = iface.BytesRecv
			prev.prevPacketsSent = iface.PacketsSent
			prev.prevPacketsRecv = iface.PacketsRecv
			prev.prevTime = now

			totalSendRate += sendRate
			totalRecvRate += recvRate
			totalBytesSent += int64(iface.BytesSent)
			totalBytesRecv += int64(iface.BytesRecv)
			totalPacketsSent += int64(iface.PacketsSent)
			totalPacketsRecv += int64(iface.PacketsRecv)
			totalErrorsIn += int64(iface.Errin)
			totalErrorsOut += int64(iface.Errout)
			totalDropsIn += int64(iface.Dropin)
			totalDropsOut += int64(iface.Dropout)
		}
		snap.TotalNetworkSendRate = totalSendRate
		snap.TotalNetworkReceiveRate = totalRecvRate
		snap.TotalBytesSent = totalBytesSent
		snap.TotalBytesRecv = totalBytesRecv
		snap.TotalPacketsSent = totalPacketsSent
		snap.TotalPacketsRecv = totalPacketsRecv
		snap.TotalErrorsIn = totalErrorsIn
		snap.TotalErrorsOut = totalErrorsOut
		snap.TotalDropsIn = totalDropsIn
		snap.TotalDropsOut = totalDropsOut
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

