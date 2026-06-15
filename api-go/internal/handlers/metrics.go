package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// Type aliases for backward compatibility — types are defined in models package.
type (
	MetricsProvider        = models.MetricsProvider
	ProcessMetricsSnapshot = models.ProcessMetricsSnapshot
	DiskInfo               = models.DiskInfo
	NetworkInterfaceInfo   = models.NetworkInterfaceInfo
	SystemMetricsSnapshot  = models.SystemMetricsSnapshot
	SystemProcessInfo      = models.SystemProcessInfo
)

type MetricsHandler struct {
	logsDB   *gorm.DB
	aggDB    *gorm.DB // metrics-aggregated.db
	provider MetricsProvider
}

func NewMetricsHandler(logsDB, aggDB *gorm.DB, provider MetricsProvider) *MetricsHandler {
	return &MetricsHandler{logsDB: logsDB, aggDB: aggDB, provider: provider}
}

func (h *MetricsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/live", h.live)
	r.Get("/system", h.system)
	r.Get("/system/history", h.systemHistory)
	r.Get("/system/sessions", h.systemSessions)
	r.Get("/processes", h.processes)
	r.Delete("/processes/{pid}", h.killProcess)
	r.Get("/aggregated", h.aggregated)
	r.Get("/catalog", h.catalog)
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
	processes := h.provider.GetSystemProcesses()

	q := r.URL.Query()
	sortBy := q.Get("sortBy")
	limitStr := q.Get("limit")

	// Apply limit
	if limitStr != "" {
		var limit int
		if _, err := fmt.Sscanf(limitStr, "%d", &limit); err == nil && limit > 0 && limit < len(processes) {
			processes = processes[:limit]
		}
	}

	// Apply sorting
	if sortBy != "" {
		sort.Slice(processes, func(i, j int) bool {
			switch sortBy {
			case "name":
				return processes[i].Name < processes[j].Name
			case "pid":
				return processes[i].PID < processes[j].PID
			case "memory":
				return processes[i].WorkingSetMemory > processes[j].WorkingSetMemory
			case "threads":
				return processes[i].ThreadCount > processes[j].ThreadCount
			case "cpu":
				return processes[i].CPU > processes[j].CPU
			case "memMb":
				return processes[i].MemMB > processes[j].MemMB
			default:
				return false
			}
		})
	}

	writeJSON(w, http.StatusOK, processes)
}

func (h *MetricsHandler) killProcess(w http.ResponseWriter, r *http.Request) {
	pidStr := chi.URLParam(r, "pid")
	var pid int
	if _, err := fmt.Sscanf(pidStr, "%d", &pid); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid pid"})
		return
	}
	if err := h.provider.KillProcess(pid); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "killed", "pid": pidStr})
}

// ─── Aggregated Metrics API ───────────────────────────────────────────────────

// AggregatedDataPoint represents a single time-bucketed data point.
type AggregatedDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Count     int       `json:"count"`
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Avg       float64   `json:"avg"`
	P95       *float64  `json:"p95"`
	Sum       *float64  `json:"sum"`
	Last      *float64  `json:"last"`
}

// MetricSummary contains aggregate statistics for a metric over the time range.
type MetricSummary struct {
	Min float64  `json:"min"`
	Max float64  `json:"max"`
	Avg float64  `json:"avg"`
	P95 *float64 `json:"p95"`
	Sum *float64 `json:"sum"`
}

// AggregatedResponse is the response shape for /api/metrics/aggregated.
type AggregatedResponse struct {
	Scope    string                           `json:"scope"`
	EntityID string                           `json:"entityId"`
	From     time.Time                        `json:"from"`
	To       time.Time                        `json:"to"`
	Bucket   string                           `json:"bucket"`
	Series   map[string][]AggregatedDataPoint `json:"series"`
	Summary  map[string]MetricSummary         `json:"summary"`
}

// autoBucketSize selects the appropriate bucket size based on the time range.
func autoBucketSize(from, to time.Time) string {
	duration := to.Sub(from)
	switch {
	case duration <= time.Hour:
		return "1m"
	case duration <= 6*time.Hour:
		return "5m"
	case duration <= 24*time.Hour:
		return "15m"
	case duration <= 7*24*time.Hour:
		return "1h"
	case duration <= 90*24*time.Hour:
		return "1d"
	default:
		return "1w"
	}
}

// aggregated handles GET /api/metrics/aggregated
func (h *MetricsHandler) aggregated(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Parse required parameters
	scope := q.Get("scope")
	if scope == "" {
		scope = "machine"
	}

	// Parse time range
	fromStr := q.Get("from")
	toStr := q.Get("to")
	var from, to time.Time
	var err error

	if fromStr != "" {
		from, err = time.Parse(time.RFC3339, fromStr)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'from' timestamp"})
			return
		}
	} else {
		from = time.Now().UTC().Add(-24 * time.Hour)
	}

	if toStr != "" {
		to, err = time.Parse(time.RFC3339, toStr)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid 'to' timestamp"})
			return
		}
	} else {
		to = time.Now().UTC()
	}

	// Determine bucket size
	bucket := q.Get("bucket")
	if bucket == "" || bucket == "auto" {
		bucket = autoBucketSize(from, to)
	}

	// Parse entity IDs
	entityID := q.Get("entityId")
	entityIDs := q.Get("entityIds")

	// Parse metrics filter
	metricsStr := q.Get("metrics")
	var metricFilter []string
	if metricsStr != "" {
		metricFilter = strings.Split(metricsStr, ",")
	}

	// Parse sub-entity filter
	subEntity := q.Get("subEntity")

	// Build query
	query := h.aggDB.Where("bucket_size = ? AND bucket_time >= ? AND bucket_time < ?", bucket, from, to)
	query = query.Where("scope = ?", scope)

	// Handle entity filtering
	if entityID != "" {
		query = query.Where("entity_id = ?", entityID)
	} else if entityIDs != "" {
		ids := strings.Split(entityIDs, ",")
		query = query.Where("entity_id IN ?", ids)
	}

	// Handle sub-entity filter
	if subEntity != "" {
		query = query.Where("sub_entity = ?", subEntity)
	}

	// Handle metrics filter
	if len(metricFilter) > 0 {
		query = query.Where("metric IN ?", metricFilter)
	}

	// Execute query with a reasonable limit to prevent unbounded result sets
	// Max ~50k buckets per metric per query (e.g., 7 days at 1m = 10080 buckets)
	const maxBuckets = 100000
	var buckets []models.MetricBucket
	if err := query.Order("bucket_time asc").Limit(maxBuckets).Find(&buckets).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to query buckets"})
		return
	}

	// Group buckets by metric
	seriesMap := make(map[string][]AggregatedDataPoint)
	summaryMap := make(map[string]MetricSummary)

	// Track values per metric for summary calculation
	metricValues := make(map[string][]float64)

	for _, b := range buckets {
		point := AggregatedDataPoint{
			Timestamp: b.BucketTime,
			Count:     b.SampleCount,
			Min:       b.MinValue,
			Max:       b.MaxValue,
			Avg:       b.AvgValue,
			P95:       b.P95Value,
			Sum:       b.SumValue,
			Last:      b.LastValue,
		}
		seriesMap[b.Metric] = append(seriesMap[b.Metric], point)
		metricValues[b.Metric] = append(metricValues[b.Metric], b.AvgValue)
	}

	// Compute summaries
	for metric, values := range metricValues {
		if len(values) == 0 {
			continue
		}
		minVal := values[0]
		maxVal := values[0]
		sum := 0.0
		for _, v := range values {
			if v < minVal {
				minVal = v
			}
			if v > maxVal {
				maxVal = v
			}
			sum += v
		}
		avg := sum / float64(len(values))

		summary := MetricSummary{
			Min: minVal,
			Max: maxVal,
			Avg: avg,
		}

		// Compute p95 if enough samples
		if len(values) >= 20 {
			sorted := make([]float64, len(values))
			copy(sorted, values)
			sort.Float64s(sorted)
			idx := int(float64(len(sorted))*0.95) - 1
			if idx < 0 {
				idx = 0
			}
			if idx >= len(sorted) {
				idx = len(sorted) - 1
			}
			p95 := sorted[idx]
			summary.P95 = &p95
		}

		summaryMap[metric] = summary
	}

	response := AggregatedResponse{
		Scope:    scope,
		EntityID: entityID,
		From:     from,
		To:       to,
		Bucket:   bucket,
		Series:   seriesMap,
		Summary:  summaryMap,
	}

	writeJSON(w, http.StatusOK, response)
}

// ─── Metrics Catalog API ──────────────────────────────────────────────────────

// MetricCatalogEntry describes a single metric in the catalog.
type MetricCatalogEntry struct {
	Name           string   `json:"name"`
	Unit           string   `json:"unit"`
	Scopes         []string `json:"scopes"`
	HasSubEntities bool     `json:"hasSubEntities"`
	SubEntityLabel string   `json:"subEntityLabel,omitempty"`
	Description    string   `json:"description"`
}

// CatalogResponse is the response shape for /api/metrics/catalog.
type CatalogResponse struct {
	Metrics []MetricCatalogEntry `json:"metrics"`
}

// catalog handles GET /api/metrics/catalog
func (h *MetricsHandler) catalog(w http.ResponseWriter, r *http.Request) {
	metrics := []MetricCatalogEntry{
		// CPU metrics
		{
			Name:           "cpu_usage_percent",
			Unit:           "percent",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Overall CPU usage percentage",
		},
		{
			Name:           "cpu_load_1m",
			Unit:           "load",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "System load average (1 minute)",
		},
		{
			Name:           "cpu_load_5m",
			Unit:           "load",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "System load average (5 minutes)",
		},
		{
			Name:           "cpu_load_15m",
			Unit:           "load",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "System load average (15 minutes)",
		},
		{
			Name:           "cpu_context_switches",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "CPU context switches per interval",
		},
		{
			Name:           "cpu_interrupts",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "CPU interrupts per interval",
		},

		// Memory metrics
		{
			Name:           "memory_used_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Physical memory used",
		},
		{
			Name:           "memory_available_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Physical memory available",
		},
		{
			Name:           "memory_cached_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Cached memory",
		},
		{
			Name:           "memory_buffers_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Buffers memory",
		},
		{
			Name:           "memory_usage_percent",
			Unit:           "percent",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Memory usage percentage",
		},
		{
			Name:           "swap_used_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Swap space used",
		},
		{
			Name:           "swap_percent",
			Unit:           "percent",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Swap usage percentage",
		},

		// Disk metrics
		{
			Name:           "disk_used_bytes",
			Unit:           "bytes",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "mount point",
			Description:    "Disk space used per mount point",
		},
		{
			Name:           "disk_usage_percent",
			Unit:           "percent",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "mount point",
			Description:    "Disk usage percentage per mount point",
		},

		// Network metrics
		{
			Name:           "network_send_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"machine", "service", "app"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Network send rate",
		},
		{
			Name:           "network_receive_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"machine", "service", "app"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Network receive rate",
		},
		{
			Name:           "network_bytes_sent",
			Unit:           "bytes",
			Scopes:         []string{"machine", "service", "app"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network bytes sent",
		},
		{
			Name:           "network_bytes_received",
			Unit:           "bytes",
			Scopes:         []string{"machine", "service", "app"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network bytes received",
		},
		{
			Name:           "network_packets_sent",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network packets sent",
		},
		{
			Name:           "network_packets_recv",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network packets received",
		},
		{
			Name:           "network_errors_in",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network errors in",
		},
		{
			Name:           "network_errors_out",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network errors out",
		},
		{
			Name:           "network_drops_in",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network drops in",
		},
		{
			Name:           "network_drops_out",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: true,
			SubEntityLabel: "interface",
			Description:    "Cumulative network drops out",
		},

		// Process/System counts
		{
			Name:           "total_processes",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Total number of processes",
		},
		{
			Name:           "total_threads",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Total number of threads",
		},
		{
			Name:           "total_connections",
			Unit:           "count",
			Scopes:         []string{"machine"},
			HasSubEntities: false,
			Description:    "Total active network connections",
		},

		// Process-level metrics
		{
			Name:           "process_memory_working_set",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process working set memory",
		},
		{
			Name:           "process_memory_private",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process private memory",
		},
		{
			Name:           "process_memory_virtual",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process virtual memory",
		},
		{
			Name:           "process_cpu_percent",
			Unit:           "percent",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process CPU usage percentage",
		},
		{
			Name:           "process_thread_count",
			Unit:           "count",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process thread count",
		},
		{
			Name:           "process_handle_count",
			Unit:           "count",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process handle count",
		},
		{
			Name:           "process_open_fds",
			Unit:           "count",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process open file descriptors",
		},
		{
			Name:           "process_network_send_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process network send rate",
		},
		{
			Name:           "process_network_receive_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process network receive rate",
		},
		{
			Name:           "process_network_bytes_sent",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process cumulative network bytes sent",
		},
		{
			Name:           "process_network_bytes_received",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process cumulative network bytes received",
		},
		{
			Name:           "process_disk_read_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process disk read rate",
		},
		{
			Name:           "process_disk_write_rate",
			Unit:           "bytes/sec",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process disk write rate",
		},
		{
			Name:           "process_disk_bytes_read",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process cumulative disk bytes read",
		},
		{
			Name:           "process_disk_bytes_written",
			Unit:           "bytes",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process cumulative disk bytes written",
		},
		{
			Name:           "process_disk_read_ops",
			Unit:           "count",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process disk read operations",
		},
		{
			Name:           "process_disk_write_ops",
			Unit:           "count",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process disk write operations",
		},
		{
			Name:           "process_gpu_percent",
			Unit:           "percent",
			Scopes:         []string{"service", "app"},
			HasSubEntities: false,
			Description:    "Process GPU usage percentage",
		},

		// Directory metrics
		{
			Name:           "dir_size_bytes",
			Unit:           "bytes",
			Scopes:         []string{"directory"},
			HasSubEntities: true,
			SubEntityLabel: "child path",
			Description:    "Directory total size",
		},
		{
			Name:           "dir_file_count",
			Unit:           "count",
			Scopes:         []string{"directory"},
			HasSubEntities: true,
			SubEntityLabel: "child path",
			Description:    "Directory file count",
		},
	}

	writeJSON(w, http.StatusOK, CatalogResponse{Metrics: metrics})
}
