package models

import "time"

// ─── Sessions ──────────────────────────────────────────────────────────────

type SessionStatus string

const (
	SessionRunning SessionStatus = "Running"
	SessionStopped SessionStatus = "Stopped"
	SessionFailed  SessionStatus = "Failed"
)

type ServiceSession struct {
	ID             string        `gorm:"type:text;primaryKey" json:"id"`
	ServiceID      string        `gorm:"type:text;not null;index" json:"serviceId"`
	StartTimestamp time.Time     `gorm:"index" json:"startTimestamp"`
	EndTimestamp   *time.Time    `json:"endTimestamp"`
	Status         SessionStatus `gorm:"type:text;default:'Running'" json:"status"`
	ExitCode       *int          `json:"exitCode"`
	PID            int           `json:"pid"`
}

func (ServiceSession) TableName() string { return "app_sessions" }

// ─── Logs ──────────────────────────────────────────────────────────────────

type LogType string

const (
	LogTypeStdout LogType = "stdout"
	LogTypeStderr LogType = "stderr"
	LogTypeSystem LogType = "system"
)

type SessionLogEntry struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	SessionID string    `gorm:"type:text;not null;index" json:"sessionId"`
	ServiceID string    `gorm:"type:text;not null;index" json:"serviceId"`
	Type      LogType   `gorm:"type:text;default:'stdout'" json:"type"`
	Timestamp time.Time `gorm:"index" json:"timestamp"`
	Line      string    `gorm:"type:text;not null" json:"line"`
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

type LifecycleEventType string

const (
	LifecycleStarted LifecycleEventType = "Started"
	LifecycleStopped LifecycleEventType = "Stopped"
	LifecycleFailed  LifecycleEventType = "Failed"
	LifecycleRestart LifecycleEventType = "Restarted"
)

type LifecycleEvent struct {
	ID        int64              `gorm:"primaryKey;autoIncrement" json:"id"`
	ServiceID string             `gorm:"type:text;not null;index" json:"serviceId"`
	SessionID string             `gorm:"type:text;index" json:"sessionId"`
	EventType LifecycleEventType `gorm:"type:text;not null" json:"eventType"`
	Timestamp time.Time          `gorm:"index" json:"timestamp"`
	Message   string             `gorm:"type:text" json:"message"`
}

func (LifecycleEvent) TableName() string { return "lifecycle_events" }

// ─── Process Metrics ───────────────────────────────────────────────────────

type ProcessMetrics struct {
	ID                   int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ServiceID            string    `gorm:"type:text;not null;index:idx_pm_service_ts" json:"serviceId"`
	SessionID            string    `gorm:"type:text;index" json:"sessionId"`
	Timestamp            time.Time `gorm:"index:idx_pm_service_ts" json:"timestamp"`
	WorkingSetMemory     int64     `json:"workingSetMemory"`
	PrivateMemory        int64     `json:"privateMemory"`
	VirtualMemory        int64     `json:"virtualMemory"`
	PeakWorkingSetMemory int64     `json:"peakWorkingSetMemory"`
	SharedMemory         int64     `json:"sharedMemory"`         // Linux: shared memory bytes
	CpuUsagePercent      float64   `json:"cpuUsagePercent"`
	TotalProcessorTime   float64   `json:"totalProcessorTime"`
	UserProcessorTime    float64   `json:"userProcessorTime"`
	ThreadCount          int       `json:"threadCount"`
	HandleCount          int       `json:"handleCount"`
	OpenFDs              int       `json:"openFds"`              // Linux: open file descriptors
	NetworkBytesSent     int64     `json:"networkBytesSent"`     // cumulative total
	NetworkBytesReceived int64     `json:"networkBytesReceived"` // cumulative total
	NetworkSendRate      float64   `json:"networkSendRate"`      // bytes/sec (delta)
	NetworkReceiveRate   float64   `json:"networkReceiveRate"`   // bytes/sec (delta)
	DiskBytesRead        int64     `json:"diskBytesRead"`        // cumulative total
	DiskBytesWritten     int64     `json:"diskBytesWritten"`     // cumulative total
	DiskReadRate         float64   `json:"diskReadRate"`         // bytes/sec (delta)
	DiskWriteRate        float64   `json:"diskWriteRate"`        // bytes/sec (delta)
	DiskReadOps          int64     `json:"diskReadOps"`          // I/O read operations
	DiskWriteOps         int64     `json:"diskWriteOps"`         // I/O write operations
	GpuUsagePercent      float64   `json:"gpuUsagePercent"`
	IsResponding         bool      `json:"isResponding"`
	ProcessID            int       `json:"processId"`
	Priority             int       `json:"priority"`
	Status               string    `gorm:"type:text" json:"status"` // Running/Sleeping/Zombie etc.
}

type SystemMetrics struct {
	ID                   int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp            time.Time `gorm:"index" json:"timestamp"`
	
	// CPU metrics
	CpuUsagePercent      float64   `json:"cpuUsagePercent"`
	CpuLoad1m            float64   `json:"cpuLoad1m"`            // 1-minute load average
	CpuLoad5m            float64   `json:"cpuLoad5m"`            // 5-minute load average
	CpuLoad15m           float64   `json:"cpuLoad15m"`           // 15-minute load average
	CpuContextSwitches   int64     `json:"cpuContextSwitches"`   // context switches per interval
	CpuInterrupts        int64     `json:"cpuInterrupts"`        // interrupts per interval
	
	// System uptime
	SystemUptime         float64   `json:"systemUptime"`         // seconds
	
	// Memory metrics
	TotalPhysicalMemory  int64     `json:"totalPhysicalMemory"`
	UsedPhysicalMemory   int64     `json:"usedPhysicalMemory"`
	AvailableMemory      int64     `json:"availableMemory"`      // available memory bytes
	CachedMemory         int64     `json:"cachedMemory"`         // cached memory bytes
	BuffersMemory        int64     `json:"buffersMemory"`        // buffers memory bytes
	MemoryUsagePercent   float64   `json:"memoryUsagePercent"`
	SwapTotal            int64     `json:"swapTotal"`            // total swap bytes
	SwapUsed             int64     `json:"swapUsed"`             // used swap bytes
	SwapPercent          float64   `json:"swapPercent"`          // swap usage percent
	
	// Disk metrics (aggregated across all disks for system-level)
	TotalDiskSpace       int64     `json:"totalDiskSpace"`
	UsedDiskSpace        int64     `json:"usedDiskSpace"`
	DiskUsagePercent     float64   `json:"diskUsagePercent"`
	
	// Network metrics (aggregated across all interfaces)
	NetworkBytesSent     int64     `json:"networkBytesSent"`     // cumulative total
	NetworkBytesReceived int64     `json:"networkBytesReceived"` // cumulative total
	SendRate             float64   `json:"networkSendRate"`      // bytes/sec (delta)
	ReceiveRate          float64   `json:"networkReceiveRate"`   // bytes/sec (delta)
	NetworkPacketsSent   int64     `json:"networkPacketsSent"`   // cumulative packets sent
	NetworkPacketsRecv   int64     `json:"networkPacketsRecv"`   // cumulative packets received
	NetworkErrorsIn      int64     `json:"networkErrorsIn"`      // cumulative errors in
	NetworkErrorsOut     int64     `json:"networkErrorsOut"`     // cumulative errors out
	NetworkDropsIn       int64     `json:"networkDropsIn"`       // cumulative drops in
	NetworkDropsOut      int64     `json:"networkDropsOut"`      // cumulative drops out
	
	// Process and system metrics
	TotalProcesses       int       `json:"totalProcesses"`
	TotalThreads         int       `json:"totalThreads"`
	TotalConnections     int       `json:"totalConnections"`     // active network connections
}

// ─── Aggregated Metrics (metrics-aggregated.db) ───────────────────────────

// MetricBucket represents a time-bucketed aggregation of a metric.
// Stored in the separate metrics-aggregated.db to avoid write contention with raw logs.db.
type MetricBucket struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	BucketTime   time.Time `gorm:"index:idx_buckets_query;index:idx_buckets_machine;index:idx_buckets_sub_query;index:idx_buckets_retention" json:"bucketTime"` // Start of the bucket window
	BucketSize   string    `gorm:"type:text;not null;index:idx_buckets_query;index:idx_buckets_machine;index:idx_buckets_sub_query;index:idx_buckets_retention" json:"bucketSize"` // '5m', '1h', '1d', '1w'
	Scope        string    `gorm:"type:text;not null;index:idx_buckets_query;index:idx_buckets_machine;index:idx_buckets_sub_query" json:"scope"` // 'machine', 'node', 'service', 'app', 'multi-app', 'directory', 'cluster'
	EntityID     string    `gorm:"type:text;index:idx_buckets_query;index:idx_buckets_sub_query" json:"entityId"` // serviceId / appId / watchedDirId / machineId
	MachineID    string    `gorm:"type:text;index:idx_buckets_machine" json:"machineId"` // Node/machine this data was collected from (for future multi-node)
	SubEntity    string    `gorm:"type:text;index:idx_buckets_sub_query" json:"subEntity"` // disk mountpoint, network interface name, core index, child dir path
	Metric       string    `gorm:"type:text;not null;index:idx_buckets_query;index:idx_buckets_sub_query" json:"metric"` // metric name from the catalog
	SampleCount  int       `json:"sampleCount"`
	MinValue     float64   `json:"minValue"`
	MaxValue     float64   `json:"maxValue"`
	AvgValue     float64   `json:"avgValue"`
	P95Value     *float64  `json:"p95Value"` // nullable for buckets with < 20 samples
	SumValue     *float64  `json:"sumValue"` // For cumulative metrics (bytes transferred, etc.)
	LastValue    *float64  `json:"lastValue"` // The most recent raw value in the bucket
	CreatedAt    time.Time `json:"createdAt"`
}

func (MetricBucket) TableName() string { return "buckets" }

// ─── Directory Monitoring (metrics-aggregated.db) ─────────────────────────

// WatchedDirectory represents a configured directory to monitor.
type WatchedDirectory struct {
	ID              string    `gorm:"type:text;primaryKey" json:"id"`
	Path            string    `gorm:"type:text;not null;uniqueIndex" json:"path"`
	Label           string    `gorm:"type:text" json:"label"` // Human-friendly name for UI
	Recursive       bool      `gorm:"default:true" json:"recursive"` // Track child dirs
	IntervalSeconds int       `gorm:"default:300" json:"intervalSeconds"` // How often to scan (min 60s)
	Enabled         bool      `gorm:"default:true" json:"enabled"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func (WatchedDirectory) TableName() string { return "watched_directories" }

// DirectorySnapshot represents a point-in-time scan of a watched directory.
type DirectorySnapshot struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	WatchedDirID    string    `gorm:"type:text;not null;index" json:"watchedDirId"`
	SubPath         string    `gorm:"type:text" json:"subPath"` // Relative path within watched dir (empty = root)
	TotalSize       int64     `json:"totalSize"` // bytes
	FileCount       int64     `json:"fileCount"`
	DirCount        int64     `json:"dirCount"`
	LastModified    time.Time `json:"lastModified"` // Most recent mtime in the tree
	ScannedAt       time.Time `gorm:"index" json:"scannedAt"`
}

func (DirectorySnapshot) TableName() string { return "directory_snapshots" }
