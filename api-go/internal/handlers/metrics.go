package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// MetricsProvider is implemented by the process metrics collection service.
type MetricsProvider interface {
	GetAllCurrentMetrics() map[string]ProcessMetricsSnapshot
	GetSystemMetrics() SystemMetricsSnapshot
	GetSystemProcesses() []SystemProcessInfo
}

type ProcessMetricsSnapshot struct {
	ServiceID       string    `json:"serviceId"`
	CpuPercent      float64   `json:"cpuPercent"`
	MemoryMB        float64   `json:"memoryMb"`
	NetworkSendRate float64   `json:"networkSendRate"`
	NetworkRecvRate float64   `json:"networkRecvRate"`
	DiskReadRate    float64   `json:"diskReadRate"`
	DiskWriteRate   float64   `json:"diskWriteRate"`
	Timestamp       time.Time `json:"timestamp"`
}

// DiskInfo mirrors the .NET DiskInfo DTO so the UI receives the same shape.
type DiskInfo struct {
	Name         string  `json:"name"`
	TotalSize    int64   `json:"totalSize"`    // bytes
	UsedSpace    int64   `json:"usedSpace"`    // bytes
	AvailSpace   int64   `json:"availableSpace"` // bytes
	UsagePercent float64 `json:"usagePercent"`
}

// NetworkInterfaceInfo mirrors the .NET NetworkInterfaceInfo DTO.
type NetworkInterfaceInfo struct {
	Name        string  `json:"name"`
	SendRate    float64 `json:"sendRate"`    // bytes/s
	ReceiveRate float64 `json:"receiveRate"` // bytes/s
	Status      string  `json:"status"`
}

// SystemMetricsSnapshot uses the same JSON field names as the .NET API so the
// React UI works against both backends without any adaptation layer.
type SystemMetricsSnapshot struct {
	// Primary fields (same names as .NET)
	CpuUsagePercent    float64                `json:"cpuUsagePercent"`
	MemoryUsagePercent float64                `json:"memoryUsagePercent"`
	TotalPhysicalMemory int64                 `json:"totalPhysicalMemory"` // bytes
	UsedPhysicalMemory  int64                 `json:"usedPhysicalMemory"`  // bytes
	TotalProcesses      int                   `json:"totalProcesses"`
	Disks               []DiskInfo            `json:"disks"`
	NetworkInterfaces   []NetworkInterfaceInfo `json:"networkInterfaces"`
	TotalNetworkSendRate    float64            `json:"totalNetworkSendRate"`    // bytes/s
	TotalNetworkReceiveRate float64            `json:"totalNetworkReceiveRate"` // bytes/s
	SystemUptime        string                `json:"systemUptime"`
	Timestamp           time.Time             `json:"timestamp"`
}

type SystemProcessInfo struct {
	PID    int     `json:"pid"`
	Name   string  `json:"name"`
	CPU    float64 `json:"cpu"`
	MemMB  float64 `json:"memMb"`
	Status string  `json:"status"`
}

type MetricsHandler struct {
	logsDB   *gorm.DB
	provider MetricsProvider
}

func NewMetricsHandler(logsDB *gorm.DB, provider MetricsProvider) *MetricsHandler {
	return &MetricsHandler{logsDB: logsDB, provider: provider}
}

func (h *MetricsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/live", h.live)
	r.Get("/system", h.system)
	r.Get("/system/history", h.systemHistory)
	r.Get("/system/sessions", h.systemSessions)
	r.Get("/processes", h.processes)
	return r
}

func (h *MetricsHandler) live(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.provider.GetAllCurrentMetrics())
}

func (h *MetricsHandler) system(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.provider.GetSystemMetrics())
}

func (h *MetricsHandler) systemHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 100
	query := h.logsDB.Model(&models.SystemMetrics{}).Order("timestamp desc").Limit(limit)
	if from := q.Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			query = query.Where("timestamp >= ?", t)
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			query = query.Where("timestamp <= ?", t)
		}
	}
	var metrics []models.SystemMetrics
	query.Find(&metrics)
	writeJSON(w, http.StatusOK, metrics)
}

func (h *MetricsHandler) systemSessions(w http.ResponseWriter, r *http.Request) {
	var sessions []models.ServiceSession
	h.logsDB.Where("status = ?", models.SessionRunning).Find(&sessions)
	writeJSON(w, http.StatusOK, map[string]any{
		"sessionSpans": sessions,
		"recentEvents": []any{},
	})
}

func (h *MetricsHandler) processes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.provider.GetSystemProcesses())
}
