package workers

import (
	"context"
	"math"
	"sort"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// processMetricDef defines a process metric to aggregate.
type processMetricDef struct {
	name         string
	getValue     func(*models.ProcessMetrics) float64
	isCumulative bool
}

// MetricsAggregator reads raw metrics from logs.db and writes time-bucketed
// aggregations to metrics-aggregated.db. This separation avoids write contention
// between the high-frequency collector and the aggregation worker.
type MetricsAggregator struct {
	rawDB *gorm.DB // logs.db - reads raw data
	aggDB *gorm.DB // metrics-aggregated.db - writes buckets
	log   *zap.Logger
}

// NewMetricsAggregator creates a new aggregator worker.
func NewMetricsAggregator(rawDB, aggDB *gorm.DB, log *zap.Logger) *MetricsAggregator {
	return &MetricsAggregator{
		rawDB: rawDB,
		aggDB: aggDB,
		log:   log,
	}
}

// Run starts the aggregation worker. It runs every 60 seconds to:
// 1. Aggregate raw rows into 5-minute buckets
// 2. Cascade rollups at hour/day/week boundaries
// 3. Perform retention cleanup (once per hour)
func (a *MetricsAggregator) Run(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.tick()
		}
	}
}

func (a *MetricsAggregator) tick() {
	now := time.Now().UTC()

	// 1. Aggregate raw rows into 5-minute buckets
	a.aggregateRawTo5m(now)

	// 2. Cascade rollups at boundaries
	if now.Minute() == 0 {
		a.rollup("1h", "5m", now)
	}
	if now.Hour() == 0 && now.Minute() == 0 {
		a.rollup("1d", "1h", now)
	}
	if now.Weekday() == time.Monday && now.Hour() == 0 && now.Minute() == 0 {
		a.rollup("1w", "1d", now)
	}

	// 3. Retention cleanup (once per hour, in the first 5 minutes)
	if now.Minute() < 5 {
		a.cleanup(now)
	}
}

// aggregateRawTo5m aggregates raw system_metrics and process_metrics rows
// into 5-minute buckets. Each bucket covers a 5-minute window aligned to
// the clock (e.g., 00:00-00:05, 00:05-00:10, etc.).
func (a *MetricsAggregator) aggregateRawTo5m(now time.Time) {
	// Calculate the most recent completed 5-minute window
	bucketEnd := now.Truncate(5 * time.Minute)
	bucketStart := bucketEnd.Add(-5 * time.Minute)

	// Skip if we've already processed this bucket
	var existing int64
	a.aggDB.Model(&models.MetricBucket{}).
		Where("bucket_time = ? AND bucket_size = ?", bucketStart, "5m").
		Count(&existing)
	if existing > 0 {
		return
	}

	// Aggregate system metrics
	a.aggregateSystemMetrics(bucketStart, bucketEnd)

	// Aggregate process metrics
	a.aggregateProcessMetrics(bucketStart, bucketEnd)
}

// aggregateSystemMetrics aggregates system_metrics rows into buckets.
func (a *MetricsAggregator) aggregateSystemMetrics(start, end time.Time) {
	var rows []models.SystemMetrics
	if err := a.rawDB.Where("timestamp >= ? AND timestamp < ?", start, end).
		Order("timestamp asc").
		Find(&rows).Error; err != nil {
		a.log.Warn("failed to query system_metrics for aggregation", zap.Error(err))
		return
	}

	if len(rows) == 0 {
		return
	}

	machineID := "local" // Single-node for now; will be populated from config in multi-node

	// Define which fields to aggregate and their metric names
	type metricDef struct {
		name       string
		getValue   func(*models.SystemMetrics) float64
		isCumulative bool // For cumulative counters, sum_value tracks total
	}

	metrics := []metricDef{
		// CPU metrics
		{"cpu_usage_percent", func(r *models.SystemMetrics) float64 { return r.CpuUsagePercent }, false},
		{"cpu_load_1m", func(r *models.SystemMetrics) float64 { return r.CpuLoad1m }, false},
		{"cpu_load_5m", func(r *models.SystemMetrics) float64 { return r.CpuLoad5m }, false},
		{"cpu_load_15m", func(r *models.SystemMetrics) float64 { return r.CpuLoad15m }, false},
		{"cpu_context_switches", func(r *models.SystemMetrics) float64 { return float64(r.CpuContextSwitches) }, true},
		{"cpu_interrupts", func(r *models.SystemMetrics) float64 { return float64(r.CpuInterrupts) }, true},

		// Memory metrics
		{"memory_used_bytes", func(r *models.SystemMetrics) float64 { return float64(r.UsedPhysicalMemory) }, false},
		{"memory_available_bytes", func(r *models.SystemMetrics) float64 { return float64(r.AvailableMemory) }, false},
		{"memory_cached_bytes", func(r *models.SystemMetrics) float64 { return float64(r.CachedMemory) }, false},
		{"memory_buffers_bytes", func(r *models.SystemMetrics) float64 { return float64(r.BuffersMemory) }, false},
		{"memory_usage_percent", func(r *models.SystemMetrics) float64 { return r.MemoryUsagePercent }, false},
		{"swap_used_bytes", func(r *models.SystemMetrics) float64 { return float64(r.SwapUsed) }, false},
		{"swap_percent", func(r *models.SystemMetrics) float64 { return r.SwapPercent }, false},

		// Disk metrics
		{"disk_used_bytes", func(r *models.SystemMetrics) float64 { return float64(r.UsedDiskSpace) }, false},
		{"disk_usage_percent", func(r *models.SystemMetrics) float64 { return r.DiskUsagePercent }, false},

		// Network metrics (rates and totals)
		{"network_send_rate", func(r *models.SystemMetrics) float64 { return r.SendRate }, false},
		{"network_receive_rate", func(r *models.SystemMetrics) float64 { return r.ReceiveRate }, false},
		{"network_bytes_sent", func(r *models.SystemMetrics) float64 { return float64(r.NetworkBytesSent) }, true},
		{"network_bytes_received", func(r *models.SystemMetrics) float64 { return float64(r.NetworkBytesReceived) }, true},
		{"network_packets_sent", func(r *models.SystemMetrics) float64 { return float64(r.NetworkPacketsSent) }, true},
		{"network_packets_recv", func(r *models.SystemMetrics) float64 { return float64(r.NetworkPacketsRecv) }, true},
		{"network_errors_in", func(r *models.SystemMetrics) float64 { return float64(r.NetworkErrorsIn) }, true},
		{"network_errors_out", func(r *models.SystemMetrics) float64 { return float64(r.NetworkErrorsOut) }, true},
		{"network_drops_in", func(r *models.SystemMetrics) float64 { return float64(r.NetworkDropsIn) }, true},
		{"network_drops_out", func(r *models.SystemMetrics) float64 { return float64(r.NetworkDropsOut) }, true},

		// Process/system counts
		{"total_processes", func(r *models.SystemMetrics) float64 { return float64(r.TotalProcesses) }, false},
		{"total_threads", func(r *models.SystemMetrics) float64 { return float64(r.TotalThreads) }, false},
		{"total_connections", func(r *models.SystemMetrics) float64 { return float64(r.TotalConnections) }, false},
	}

	for _, m := range metrics {
		values := make([]float64, 0, len(rows))
		for _, r := range rows {
			values = append(values, m.getValue(&r))
		}

		bucket := computeBucket(start, "machine", machineID, "", m.name, values, m.isCumulative)
		if err := a.aggDB.Create(&bucket).Error; err != nil {
			a.log.Warn("failed to write system metric bucket",
				zap.String("metric", m.name),
				zap.Error(err))
		}
	}
}

// aggregateProcessMetrics aggregates process_metrics rows into buckets.
// Creates per-service buckets (scope='service') and app-level rollups (scope='app').
func (a *MetricsAggregator) aggregateProcessMetrics(start, end time.Time) {
	var rows []models.ProcessMetrics
	if err := a.rawDB.Where("timestamp >= ? AND timestamp < ?", start, end).
		Order("timestamp asc").
		Find(&rows).Error; err != nil {
		a.log.Warn("failed to query process_metrics for aggregation", zap.Error(err))
		return
	}

	if len(rows) == 0 {
		return
	}

	// Group rows by service_id
	groups := make(map[string][]models.ProcessMetrics)
	for _, r := range rows {
		groups[r.ServiceID] = append(groups[r.ServiceID], r)
	}

	metrics := []processMetricDef{
		// Memory metrics
		{"process_memory_working_set", func(r *models.ProcessMetrics) float64 { return float64(r.WorkingSetMemory) }, false},
		{"process_memory_private", func(r *models.ProcessMetrics) float64 { return float64(r.PrivateMemory) }, false},
		{"process_memory_virtual", func(r *models.ProcessMetrics) float64 { return float64(r.VirtualMemory) }, false},
		{"process_memory_peak_working_set", func(r *models.ProcessMetrics) float64 { return float64(r.PeakWorkingSetMemory) }, false},
		{"process_memory_shared", func(r *models.ProcessMetrics) float64 { return float64(r.SharedMemory) }, false},

		// CPU metrics
		{"process_cpu_percent", func(r *models.ProcessMetrics) float64 { return r.CpuUsagePercent }, false},
		{"process_total_processor_time", func(r *models.ProcessMetrics) float64 { return r.TotalProcessorTime }, true},
		{"process_user_processor_time", func(r *models.ProcessMetrics) float64 { return r.UserProcessorTime }, true},

		// Counts
		{"process_thread_count", func(r *models.ProcessMetrics) float64 { return float64(r.ThreadCount) }, false},
		{"process_handle_count", func(r *models.ProcessMetrics) float64 { return float64(r.HandleCount) }, false},
		{"process_open_fds", func(r *models.ProcessMetrics) float64 { return float64(r.OpenFDs) }, false},

		// Network metrics
		{"process_network_send_rate", func(r *models.ProcessMetrics) float64 { return r.NetworkSendRate }, false},
		{"process_network_receive_rate", func(r *models.ProcessMetrics) float64 { return r.NetworkReceiveRate }, false},
		{"process_network_bytes_sent", func(r *models.ProcessMetrics) float64 { return float64(r.NetworkBytesSent) }, true},
		{"process_network_bytes_received", func(r *models.ProcessMetrics) float64 { return float64(r.NetworkBytesReceived) }, true},

		// Disk metrics
		{"process_disk_read_rate", func(r *models.ProcessMetrics) float64 { return r.DiskReadRate }, false},
		{"process_disk_write_rate", func(r *models.ProcessMetrics) float64 { return r.DiskWriteRate }, false},
		{"process_disk_bytes_read", func(r *models.ProcessMetrics) float64 { return float64(r.DiskBytesRead) }, true},
		{"process_disk_bytes_written", func(r *models.ProcessMetrics) float64 { return float64(r.DiskBytesWritten) }, true},
		{"process_disk_read_ops", func(r *models.ProcessMetrics) float64 { return float64(r.DiskReadOps) }, true},
		{"process_disk_write_ops", func(r *models.ProcessMetrics) float64 { return float64(r.DiskWriteOps) }, true},

		// GPU
		{"process_gpu_percent", func(r *models.ProcessMetrics) float64 { return r.GpuUsagePercent }, false},
	}

	// Write per-service buckets
	for serviceID, serviceRows := range groups {
		for _, m := range metrics {
			values := make([]float64, 0, len(serviceRows))
			for i := range serviceRows {
				values = append(values, m.getValue(&serviceRows[i]))
			}

			bucket := computeBucket(start, "service", serviceID, "", m.name, values, m.isCumulative)
			if err := a.aggDB.Create(&bucket).Error; err != nil {
				a.log.Warn("failed to write service metric bucket",
					zap.String("service", serviceID),
					zap.String("metric", m.name),
					zap.Error(err))
			}
		}
	}

	// Aggregate to app scope by resolving service -> app mapping
	a.aggregateAppScope(start, end, groups, metrics)
}

// aggregateAppScope rolls up service-level metrics to app-level.
func (a *MetricsAggregator) aggregateAppScope(start, end time.Time, groups map[string][]models.ProcessMetrics, metrics []processMetricDef) {
	// Resolve service -> app mapping from the services table
	type serviceApp struct {
		ServiceID string
		AppID     string
	}
	var mappings []serviceApp
	if err := a.rawDB.Table("services").Select("id as service_id, app_id").Find(&mappings).Error; err != nil {
		a.log.Warn("failed to query services for app mapping", zap.Error(err))
		return
	}

	serviceToApp := make(map[string]string)
	for _, m := range mappings {
		serviceToApp[m.ServiceID] = m.AppID
	}

	// Group service data by app
	appGroups := make(map[string][]models.ProcessMetrics)
	for serviceID, rows := range groups {
		appID, ok := serviceToApp[serviceID]
		if !ok || appID == "" {
			continue
		}
		appGroups[appID] = append(appGroups[appID], rows...)
	}

	// Write per-app buckets
	for appID, appRows := range appGroups {
		for _, m := range metrics {
			values := make([]float64, 0, len(appRows))
			for i := range appRows {
				values = append(values, m.getValue(&appRows[i]))
			}

			bucket := computeBucket(start, "app", appID, "", m.name, values, m.isCumulative)
			if err := a.aggDB.Create(&bucket).Error; err != nil {
				a.log.Warn("failed to write app metric bucket",
					zap.String("app", appID),
					zap.String("metric", m.name),
					zap.Error(err))
			}
		}
	}
}

// rollup cascades aggregations from a smaller bucket size to a larger one.
// For example, rolling up twelve 5m buckets into one 1h bucket.
func (a *MetricsAggregator) rollup(targetSize, sourceSize string, now time.Time) {
	// Determine the target bucket window
	var targetStart, targetEnd time.Time
	switch targetSize {
	case "1h":
		targetEnd = now.Truncate(time.Hour)
		targetStart = targetEnd.Add(-time.Hour)
	case "1d":
		targetEnd = now.Truncate(24 * time.Hour)
		targetStart = targetEnd.Add(-24 * time.Hour)
	case "1w":
		// Week starts on Monday
		daysToMonday := int(now.Weekday() - time.Monday)
		if daysToMonday < 0 {
			daysToMonday += 7
		}
		targetEnd = now.Truncate(24 * time.Hour).Add(-time.Duration(daysToMonday) * 24 * time.Hour)
		targetStart = targetEnd.Add(-7 * 24 * time.Hour)
	default:
		return
	}

	// Check if target bucket already exists
	var existing int64
	a.aggDB.Model(&models.MetricBucket{}).
		Where("bucket_time = ? AND bucket_size = ?", targetStart, targetSize).
		Count(&existing)
	if existing > 0 {
		return
	}

	// Query source buckets in the target window
	var sourceBuckets []models.MetricBucket
	if err := a.aggDB.Where("bucket_size = ? AND bucket_time >= ? AND bucket_time < ?",
		sourceSize, targetStart, targetEnd).
		Find(&sourceBuckets).Error; err != nil {
		a.log.Warn("failed to query source buckets for rollup",
			zap.String("source", sourceSize),
			zap.Error(err))
		return
	}

	if len(sourceBuckets) == 0 {
		return
	}

	// Group source buckets by (scope, entity_id, sub_entity, metric)
	type bucketKey struct {
		Scope     string
		EntityID  string
		SubEntity string
		Metric    string
	}

	groups := make(map[bucketKey][]models.MetricBucket)
	for _, b := range sourceBuckets {
		key := bucketKey{b.Scope, b.EntityID, b.SubEntity, b.Metric}
		groups[key] = append(groups[key], b)
	}

	// Rollup each group
	for key, buckets := range groups {
		rolled := rollupBuckets(targetStart, targetSize, key.Scope, key.EntityID, key.SubEntity, key.Metric, buckets)
		if err := a.aggDB.Create(&rolled).Error; err != nil {
			a.log.Warn("failed to write rolled bucket",
				zap.String("target", targetSize),
				zap.String("metric", key.Metric),
				zap.Error(err))
		}
	}

	a.log.Debug("rollup completed",
		zap.String("target", targetSize),
		zap.String("source", sourceSize),
		zap.Int("buckets_created", len(groups)))
}

// rollupBuckets combines multiple source buckets into a single target bucket.
func rollupBuckets(bucketTime time.Time, bucketSize, scope, entityID, subEntity, metric string, sources []models.MetricBucket) models.MetricBucket {
	if len(sources) == 0 {
		return models.MetricBucket{}
	}

	totalSamples := 0
	minVal := math.MaxFloat64
	maxVal := -math.MaxFloat64
	weightedSum := 0.0
	totalWeight := 0.0
	sumVal := 0.0
	lastVal := 0.0
	var lastTime time.Time

	// Collect all avg values for p95 calculation
	allAvgs := make([]float64, 0, len(sources))

	for _, s := range sources {
		totalSamples += s.SampleCount
		if s.MinValue < minVal {
			minVal = s.MinValue
		}
		if s.MaxValue > maxVal {
			maxVal = s.MaxValue
		}
		// Weighted average by sample count
		weight := float64(s.SampleCount)
		weightedSum += s.AvgValue * weight
		totalWeight += weight
		allAvgs = append(allAvgs, s.AvgValue)

		if s.SumValue != nil {
			sumVal += *s.SumValue
		}
		if s.LastValue != nil {
			if s.BucketTime.After(lastTime) {
				lastTime = s.BucketTime
				lastVal = *s.LastValue
			}
		}
	}

	avgVal := 0.0
	if totalWeight > 0 {
		avgVal = weightedSum / totalWeight
	}

	// Compute p95 if enough samples
	var p95 *float64
	if len(allAvgs) >= 20 {
		sort.Float64s(allAvgs)
		idx := int(math.Ceil(0.95*float64(len(allAvgs)))) - 1
		if idx < 0 {
			idx = 0
		}
		if idx >= len(allAvgs) {
			idx = len(allAvgs) - 1
		}
		p95 = &allAvgs[idx]
	}

	result := models.MetricBucket{
		BucketTime:  bucketTime,
		BucketSize:  bucketSize,
		Scope:       scope,
		EntityID:    entityID,
		MachineID:   "local",
		SubEntity:   subEntity,
		Metric:      metric,
		SampleCount: totalSamples,
		MinValue:    minVal,
		MaxValue:    maxVal,
		AvgValue:    avgVal,
		P95Value:    p95,
		CreatedAt:   time.Now().UTC(),
	}

	if sumVal != 0 {
		result.SumValue = &sumVal
	}
	if lastVal != 0 || !lastTime.IsZero() {
		result.LastValue = &lastVal
	}

	return result
}

// computeBucket computes aggregate statistics from a slice of values and returns a MetricBucket.
func computeBucket(bucketTime time.Time, scope, entityID, subEntity, metric string, values []float64, isCumulative bool) models.MetricBucket {
	if len(values) == 0 {
		return models.MetricBucket{
			BucketTime: bucketTime,
			BucketSize: "5m",
			Scope:      scope,
			EntityID:   entityID,
			MachineID:  "local",
			SubEntity:  subEntity,
			Metric:     metric,
			CreatedAt:  time.Now().UTC(),
		}
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
	last := values[len(values)-1]

	bucket := models.MetricBucket{
		BucketTime:  bucketTime,
		BucketSize:  "5m",
		Scope:       scope,
		EntityID:    entityID,
		MachineID:   "local",
		SubEntity:   subEntity,
		Metric:      metric,
		SampleCount: len(values),
		MinValue:    minVal,
		MaxValue:    maxVal,
		AvgValue:    avg,
		LastValue:   &last,
		CreatedAt:   time.Now().UTC(),
	}

	// Compute p95 if enough samples
	if len(values) >= 20 {
		sorted := make([]float64, len(values))
		copy(sorted, values)
		sort.Float64s(sorted)
		idx := int(math.Ceil(0.95*float64(len(sorted)))) - 1
		if idx < 0 {
			idx = 0
		}
		if idx >= len(sorted) {
			idx = len(sorted) - 1
		}
		p95 := sorted[idx]
		bucket.P95Value = &p95
	}

	// For cumulative metrics, set sum_value
	if isCumulative {
		bucket.SumValue = &sum
	}

	return bucket
}

// cleanup removes old data according to the retention policy:
// - Raw rows older than 7 days from logs.db
// - 5m buckets older than 30 days from aggregated.db
// - 1h buckets older than 365 days from aggregated.db
// - 1d and 1w buckets are kept forever
func (a *MetricsAggregator) cleanup(now time.Time) {
	// Delete raw system_metrics older than 7 days
	rawCutoff := now.AddDate(0, 0, -7)
	if result := a.rawDB.Where("timestamp < ?", rawCutoff).Delete(&models.SystemMetrics{}); result.Error != nil {
		a.log.Warn("cleanup system_metrics error", zap.Error(result.Error))
	} else if result.RowsAffected > 0 {
		a.log.Info("cleanup system_metrics", zap.Int64("deleted", result.RowsAffected))
	}

	// Delete raw process_metrics older than 7 days
	if result := a.rawDB.Where("timestamp < ?", rawCutoff).Delete(&models.ProcessMetrics{}); result.Error != nil {
		a.log.Warn("cleanup process_metrics error", zap.Error(result.Error))
	} else if result.RowsAffected > 0 {
		a.log.Info("cleanup process_metrics", zap.Int64("deleted", result.RowsAffected))
	}

	// Delete 5m buckets older than 30 days
	tier1Cutoff := now.AddDate(0, 0, -30)
	if result := a.aggDB.Where("bucket_size = ? AND bucket_time < ?", "5m", tier1Cutoff).Delete(&models.MetricBucket{}); result.Error != nil {
		a.log.Warn("cleanup 5m buckets error", zap.Error(result.Error))
	} else if result.RowsAffected > 0 {
		a.log.Info("cleanup 5m buckets", zap.Int64("deleted", result.RowsAffected))
	}

	// Delete 1h buckets older than 365 days
	tier2Cutoff := now.AddDate(0, 0, -365)
	if result := a.aggDB.Where("bucket_size = ? AND bucket_time < ?", "1h", tier2Cutoff).Delete(&models.MetricBucket{}); result.Error != nil {
		a.log.Warn("cleanup 1h buckets error", zap.Error(result.Error))
	} else if result.RowsAffected > 0 {
		a.log.Info("cleanup 1h buckets", zap.Int64("deleted", result.RowsAffected))
	}

	// Delete directory snapshots older than 7 days
	if result := a.aggDB.Where("scanned_at < ?", rawCutoff).Delete(&models.DirectorySnapshot{}); result.Error != nil {
		a.log.Warn("cleanup directory_snapshots error", zap.Error(result.Error))
	} else if result.RowsAffected > 0 {
		a.log.Info("cleanup directory_snapshots", zap.Int64("deleted", result.RowsAffected))
	}
}
