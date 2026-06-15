package models

import "time"

// MetricsProvider is implemented by the process metrics collection service.
type MetricsProvider interface {
	GetAllCurrentMetrics() map[string]ProcessMetricsSnapshot
	GetSystemMetrics() SystemMetricsSnapshot
	GetSystemProcesses() []SystemProcessInfo
	KillProcess(pid int) error
}

type ProcessMetricsSnapshot struct {
	ServiceID        string    `json:"serviceId"`
	CpuPercent       float64   `json:"cpuPercent"`
	MemoryMB         float64   `json:"memoryMb"`
	MemoryWorkingSet int64     `json:"memoryWorkingSet"`
	MemoryPrivate    int64     `json:"memoryPrivate"`
	MemoryVirtual    int64     `json:"memoryVirtual"`
	NetworkSendRate  float64   `json:"networkSendRate"`
	NetworkRecvRate  float64   `json:"networkRecvRate"`
	NetworkBytesSent int64     `json:"networkBytesSent"`
	NetworkBytesRecv int64     `json:"networkBytesRecv"`
	DiskReadRate     float64   `json:"diskReadRate"`
	DiskWriteRate    float64   `json:"diskWriteRate"`
	DiskBytesRead    int64     `json:"diskBytesRead"`
	DiskBytesWritten int64     `json:"diskBytesWritten"`
	DiskReadOps      int64     `json:"diskReadOps"`
	DiskWriteOps     int64     `json:"diskWriteOps"`
	ThreadCount      int       `json:"threadCount"`
	HandleCount      int       `json:"handleCount"`
	OpenFDs          int       `json:"openFds"`
	Status           string    `json:"status"`
	Timestamp        time.Time `json:"timestamp"`
}

// DiskInfo mirrors the .NET DiskInfo DTO so the UI receives the same shape.
type DiskInfo struct {
	Name          string  `json:"name"`
	TotalSize     int64   `json:"totalSize"`      // bytes
	UsedSpace     int64   `json:"usedSpace"`      // bytes
	AvailSpace    int64   `json:"availableSpace"` // bytes
	UsagePercent  float64 `json:"usagePercent"`
	ReadBytes     int64   `json:"readBytes"`     // cumulative total
	WriteBytes    int64   `json:"writeBytes"`    // cumulative total
	ReadRate      float64 `json:"readRate"`      // bytes/sec (delta)
	WriteRate     float64 `json:"writeRate"`     // bytes/sec (delta)
	ReadOps       int64   `json:"readOps"`       // cumulative read operations
	WriteOps      int64   `json:"writeOps"`      // cumulative write operations
	ReadOpsRate   float64 `json:"readOpsRate"`   // ops/sec (delta)
	WriteOpsRate  float64 `json:"writeOpsRate"`  // ops/sec (delta)
	ReadTimeMs    int64   `json:"readTimeMs"`    // cumulative read time (ms)
	WriteTimeMs   int64   `json:"writeTimeMs"`   // cumulative write time (ms)
	InodesUsed    int64   `json:"inodesUsed"`    // Linux only
	InodesFree    int64   `json:"inodesFree"`    // Linux only
	InodesPercent float64 `json:"inodesPercent"` // Linux only
}

// NetworkInterfaceInfo mirrors the .NET NetworkInterfaceInfo DTO.
type NetworkInterfaceInfo struct {
	Name           string  `json:"name"`
	BytesSentTotal int64   `json:"bytesSentTotal"` // cumulative total
	BytesRecvTotal int64   `json:"bytesRecvTotal"` // cumulative total
	PacketsSent    int64   `json:"packetsSent"`
	PacketsRecv    int64   `json:"packetsRecv"`
	ErrorsIn       int64   `json:"errorsIn"`
	ErrorsOut      int64   `json:"errorsOut"`
	DropsIn        int64   `json:"dropsIn"`
	DropsOut       int64   `json:"dropsOut"`
	SendRate       float64 `json:"sendRate"`    // bytes/s (delta-based)
	ReceiveRate    float64 `json:"receiveRate"` // bytes/s (delta-based)
	Status         string  `json:"status"`
}

// SystemMetricsSnapshot uses the same JSON field names as the .NET API so the
// React UI works against both backends without any adaptation layer.
type SystemMetricsSnapshot struct {
	// Primary fields (same names as .NET)
	CpuUsagePercent         float64                `json:"cpuUsagePercent"`
	MemoryUsagePercent      float64                `json:"memoryUsagePercent"`
	TotalPhysicalMemory     int64                  `json:"totalPhysicalMemory"` // bytes
	UsedPhysicalMemory      int64                  `json:"usedPhysicalMemory"`  // bytes
	AvailableMemory         int64                  `json:"availableMemory"`     // bytes
	CachedMemory            int64                  `json:"cachedMemory"`        // bytes
	BuffersMemory           int64                  `json:"buffersMemory"`       // bytes
	SwapTotal               int64                  `json:"swapTotal"`           // bytes
	SwapUsed                int64                  `json:"swapUsed"`            // bytes
	SwapPercent             float64                `json:"swapPercent"`
	CpuLoad1m               float64                `json:"cpuLoad1m"`
	CpuLoad5m               float64                `json:"cpuLoad5m"`
	CpuLoad15m              float64                `json:"cpuLoad15m"`
	TotalProcesses          int                    `json:"totalProcesses"`
	Disks                   []DiskInfo             `json:"disks"`
	NetworkInterfaces       []NetworkInterfaceInfo `json:"networkInterfaces"`
	TotalNetworkSendRate    float64                `json:"totalNetworkSendRate"`    // bytes/s
	TotalNetworkReceiveRate float64                `json:"totalNetworkReceiveRate"` // bytes/s
	TotalBytesSent          int64                  `json:"totalBytesSent"`          // cumulative
	TotalBytesRecv          int64                  `json:"totalBytesRecv"`          // cumulative
	TotalPacketsSent        int64                  `json:"totalPacketsSent"`        // cumulative
	TotalPacketsRecv        int64                  `json:"totalPacketsRecv"`        // cumulative
	TotalErrorsIn           int64                  `json:"totalErrorsIn"`           // cumulative
	TotalErrorsOut          int64                  `json:"totalErrorsOut"`          // cumulative
	TotalDropsIn            int64                  `json:"totalDropsIn"`            // cumulative
	TotalDropsOut           int64                  `json:"totalDropsOut"`           // cumulative
	SystemUptime            string                 `json:"systemUptime"`
	Timestamp               time.Time              `json:"timestamp"`
}

type SystemProcessInfo struct {
	PID              int     `json:"processId"`
	Name             string  `json:"processName"`
	WorkingSetMemory int64   `json:"workingSetMemory"`
	ThreadCount      int     `json:"threadCount"`
	StartTime        string  `json:"startTime"`
	IsResponding     bool    `json:"isResponding"`
	CPU              float64 `json:"cpu"`
	MemMB            float64 `json:"memMb"`
	Status           string  `json:"status"`
}
