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
	CpuUsagePercent      float64   `json:"cpuUsagePercent"`
	TotalProcessorTime   float64   `json:"totalProcessorTime"`
	UserProcessorTime    float64   `json:"userProcessorTime"`
	ThreadCount          int       `json:"threadCount"`
	HandleCount          int       `json:"handleCount"`
	NetworkBytesSent     int64     `json:"networkBytesSent"`
	NetworkBytesReceived int64     `json:"networkBytesReceived"`
	NetworkSendRate      float64   `json:"networkSendRate"`
	NetworkReceiveRate   float64   `json:"networkReceiveRate"`
	DiskBytesRead        int64     `json:"diskBytesRead"`
	DiskBytesWritten     int64     `json:"diskBytesWritten"`
	DiskReadRate         float64   `json:"diskReadRate"`
	DiskWriteRate        float64   `json:"diskWriteRate"`
	DiskReadOps          int64     `json:"diskReadOps"`
	DiskWriteOps         int64     `json:"diskWriteOps"`
	GpuUsagePercent      float64   `json:"gpuUsagePercent"`
	IsResponding         bool      `json:"isResponding"`
	ProcessID            int       `json:"processId"`
	Priority             int       `json:"priority"`
}

type SystemMetrics struct {
	ID                   int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp            time.Time `gorm:"index" json:"timestamp"`
	CpuUsagePercent      float64   `json:"cpuUsagePercent"`
	SystemUptime         float64   `json:"systemUptime"`
	TotalPhysicalMemory  int64     `json:"totalPhysicalMemory"`
	UsedPhysicalMemory   int64     `json:"usedPhysicalMemory"`
	MemoryUsagePercent   float64   `json:"memoryUsagePercent"`
	TotalDiskSpace       int64     `json:"totalDiskSpace"`
	UsedDiskSpace        int64     `json:"usedDiskSpace"`
	DiskUsagePercent     float64   `json:"diskUsagePercent"`
	NetworkBytesSent     int64     `json:"networkBytesSent"`
	NetworkBytesReceived int64     `json:"networkBytesReceived"`
	SendRate             float64   `json:"networkSendRate"`
	ReceiveRate          float64   `json:"networkReceiveRate"`
	TotalProcesses       int       `json:"totalProcesses"`
	TotalThreads         int       `json:"totalThreads"`
}
