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

type SystemMetricsSnapshot struct {
	CpuPercent    float64   `json:"cpuPercent"`
	MemoryPercent float64   `json:"memoryPercent"`
	DiskPercent   float64   `json:"diskPercent"`
	TotalMemoryMB int64     `json:"totalMemoryMb"`
	UsedMemoryMB  int64     `json:"usedMemoryMb"`
	TotalDiskGB   int64     `json:"totalDiskGb"`
	UsedDiskGB    int64     `json:"usedDiskGb"`
	Uptime        float64   `json:"uptime"`
	Timestamp     time.Time `json:"timestamp"`
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
