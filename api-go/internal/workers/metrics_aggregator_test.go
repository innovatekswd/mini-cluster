package workers

import (
	"math"
	"testing"
	"time"

	"github.com/innovatek/minicluster/internal/models"
)

// ─── computeBucket Tests ─────────────────────────────────────────────────────

func TestComputeBucket_BasicStats(t *testing.T) {
	values := []float64{10, 20, 30, 40, 50}
	bucket := computeBucket(
		time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		"machine", "local", "", "cpu_usage_percent",
		values, false,
	)

	if bucket.SampleCount != 5 {
		t.Errorf("expected 5 samples, got %d", bucket.SampleCount)
	}
	if bucket.MinValue != 10 {
		t.Errorf("expected min 10, got %f", bucket.MinValue)
	}
	if bucket.MaxValue != 50 {
		t.Errorf("expected max 50, got %f", bucket.MaxValue)
	}
	expectedAvg := 30.0
	if bucket.AvgValue != expectedAvg {
		t.Errorf("expected avg %f, got %f", expectedAvg, bucket.AvgValue)
	}
	if bucket.LastValue == nil || *bucket.LastValue != 50 {
		t.Errorf("expected last 50, got %v", bucket.LastValue)
	}
	if bucket.BucketSize != "5m" {
		t.Errorf("expected bucket size '5m', got %s", bucket.BucketSize)
	}
	if bucket.Scope != "machine" {
		t.Errorf("expected scope 'machine', got %s", bucket.Scope)
	}
}

func TestComputeBucket_EmptyValues(t *testing.T) {
	bucket := computeBucket(
		time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		"service", "svc-1", "", "process_cpu_percent",
		[]float64{}, false,
	)

	if bucket.SampleCount != 0 {
		t.Errorf("expected 0 samples, got %d", bucket.SampleCount)
	}
	if bucket.MinValue != 0 {
		t.Errorf("expected min 0, got %f", bucket.MinValue)
	}
	if bucket.MaxValue != 0 {
		t.Errorf("expected max 0, got %f", bucket.MaxValue)
	}
}

func TestComputeBucket_SingleValue(t *testing.T) {
	values := []float64{42.5}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "memory_usage_percent",
		values, false,
	)

	if bucket.SampleCount != 1 {
		t.Errorf("expected 1 sample, got %d", bucket.SampleCount)
	}
	if bucket.MinValue != 42.5 {
		t.Errorf("expected min 42.5, got %f", bucket.MinValue)
	}
	if bucket.MaxValue != 42.5 {
		t.Errorf("expected max 42.5, got %f", bucket.MaxValue)
	}
	if bucket.AvgValue != 42.5 {
		t.Errorf("expected avg 42.5, got %f", bucket.AvgValue)
	}
}

func TestComputeBucket_P95Calculation(t *testing.T) {
	// Create 20 values to trigger p95 calculation
	values := make([]float64, 20)
	for i := 0; i < 20; i++ {
		values[i] = float64(i + 1) // 1, 2, 3, ..., 20
	}

	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "test_metric",
		values, false,
	)

	if bucket.P95Value == nil {
		t.Fatal("expected p95 to be set for 20 samples")
	}

	// P95 of [1..20] should be 19 (95th percentile index = ceil(0.95*20)-1 = 18, value = 19)
	expected := 19.0
	if *bucket.P95Value != expected {
		t.Errorf("expected p95 %f, got %f", expected, *bucket.P95Value)
	}
}

func TestComputeBucket_P95NotSetForSmallSamples(t *testing.T) {
	values := []float64{1, 2, 3, 4, 5}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "test_metric",
		values, false,
	)

	if bucket.P95Value != nil {
		t.Error("expected p95 to be nil for < 20 samples")
	}
}

func TestComputeBucket_CumulativeMetric(t *testing.T) {
	values := []float64{100, 200, 300, 400}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "network_bytes_sent",
		values, true, // isCumulative = true
	)

	if bucket.SumValue == nil {
		t.Fatal("expected sum_value to be set for cumulative metric")
	}
	expectedSum := 1000.0
	if *bucket.SumValue != expectedSum {
		t.Errorf("expected sum %f, got %f", expectedSum, *bucket.SumValue)
	}
}

func TestComputeBucket_NonCumulativeMetric(t *testing.T) {
	values := []float64{100, 200, 300}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "cpu_usage_percent",
		values, false, // isCumulative = false
	)

	if bucket.SumValue != nil {
		t.Error("expected sum_value to be nil for non-cumulative metric")
	}
}

func TestComputeBucket_NegativeValues(t *testing.T) {
	values := []float64{-10, -5, 0, 5, 10}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "test_metric",
		values, false,
	)

	if bucket.MinValue != -10 {
		t.Errorf("expected min -10, got %f", bucket.MinValue)
	}
	if bucket.MaxValue != 10 {
		t.Errorf("expected max 10, got %f", bucket.MaxValue)
	}
}

func TestComputeBucket_LargeValues(t *testing.T) {
	values := []float64{
		1e12,  // 1 TB
		2e12,  // 2 TB
		1.5e12,
	}
	bucket := computeBucket(
		time.Now().UTC(),
		"machine", "local", "", "disk_used_bytes",
		values, false,
	)

	if bucket.MinValue != 1e12 {
		t.Errorf("expected min 1e12, got %f", bucket.MinValue)
	}
	if bucket.MaxValue != 2e12 {
		t.Errorf("expected max 2e12, got %f", bucket.MaxValue)
	}
}

// ─── rollupBuckets Tests ─────────────────────────────────────────────────────

func TestRollupBuckets_Basic(t *testing.T) {
	bucketTime := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)
	baseTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	// Simulate 12 x 5m buckets = 1h
	sources := make([]models.MetricBucket, 12)
	for i := 0; i < 12; i++ {
		sources[i] = models.MetricBucket{
			BucketTime:  baseTime.Add(time.Duration(i*5) * time.Minute),
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "cpu_usage_percent",
			SampleCount: 10,
			MinValue:    float64(i * 5),     // 0, 5, 10, ..., 55
			MaxValue:    float64(i*5 + 4),   // 4, 9, 14, ..., 59
			AvgValue:    float64(i*5 + 2),   // 2, 7, 12, ..., 57
			CreatedAt:   time.Now().UTC(),
		}
	}

	rolled := rollupBuckets(bucketTime, "1h", "machine", "local", "", "cpu_usage_percent", sources)

	if rolled.SampleCount != 120 { // 12 * 10
		t.Errorf("expected 120 samples, got %d", rolled.SampleCount)
	}
	if rolled.MinValue != 0 {
		t.Errorf("expected min 0, got %f", rolled.MinValue)
	}
	if rolled.MaxValue != 59 {
		t.Errorf("expected max 59, got %f", rolled.MaxValue)
	}
	if rolled.BucketSize != "1h" {
		t.Errorf("expected bucket size '1h', got %s", rolled.BucketSize)
	}
	if !rolled.BucketTime.Equal(bucketTime) {
		t.Errorf("expected bucket time %v, got %v", bucketTime, rolled.BucketTime)
	}
}

func TestRollupBuckets_WeightedAverage(t *testing.T) {
	bucketTime := time.Now().UTC()

	// Two buckets with different sample counts
	sources := []models.MetricBucket{
		{
			BucketTime:  bucketTime,
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "test",
			SampleCount: 10,
			AvgValue:    20.0, // Weight: 10 * 20 = 200
		},
		{
			BucketTime:  bucketTime.Add(5 * time.Minute),
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "test",
			SampleCount: 30,
			AvgValue:    40.0, // Weight: 30 * 40 = 1200
		},
	}

	rolled := rollupBuckets(bucketTime, "1h", "machine", "local", "", "test", sources)

	// Expected weighted avg: (200 + 1200) / 40 = 35
	expectedAvg := 35.0
	if math.Abs(rolled.AvgValue-expectedAvg) > 0.001 {
		t.Errorf("expected weighted avg %f, got %f", expectedAvg, rolled.AvgValue)
	}
}

func TestRollupBuckets_SumValue(t *testing.T) {
	bucketTime := time.Now().UTC()
	sum1 := 1000.0
	sum2 := 2000.0

	sources := []models.MetricBucket{
		{
			BucketTime:  bucketTime,
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "network_bytes_sent",
			SampleCount: 5,
			AvgValue:    100,
			SumValue:    &sum1,
		},
		{
			BucketTime:  bucketTime.Add(5 * time.Minute),
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "network_bytes_sent",
			SampleCount: 5,
			AvgValue:    200,
			SumValue:    &sum2,
		},
	}

	rolled := rollupBuckets(bucketTime, "1h", "machine", "local", "", "network_bytes_sent", sources)

	if rolled.SumValue == nil {
		t.Fatal("expected sum_value to be set")
	}
	expectedSum := 3000.0
	if *rolled.SumValue != expectedSum {
		t.Errorf("expected sum %f, got %f", expectedSum, *rolled.SumValue)
	}
}

func TestRollupBuckets_LastValue(t *testing.T) {
	bucketTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	last1 := 100.0
	last2 := 200.0

	sources := []models.MetricBucket{
		{
			BucketTime:  bucketTime,
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "test",
			SampleCount: 5,
			AvgValue:    50,
			LastValue:   &last1,
		},
		{
			BucketTime:  bucketTime.Add(5 * time.Minute), // Later time
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "test",
			SampleCount: 5,
			AvgValue:    150,
			LastValue:   &last2,
		},
	}

	rolled := rollupBuckets(bucketTime, "1h", "machine", "local", "", "test", sources)

	if rolled.LastValue == nil {
		t.Fatal("expected last_value to be set")
	}
	// Should pick the last value from the latest bucket
	if *rolled.LastValue != 200.0 {
		t.Errorf("expected last value 200, got %f", *rolled.LastValue)
	}
}

func TestRollupBuckets_EmptySources(t *testing.T) {
	rolled := rollupBuckets(time.Now(), "1h", "machine", "local", "", "test", []models.MetricBucket{})

	// Should return zero-value bucket
	if rolled.SampleCount != 0 {
		t.Errorf("expected 0 samples for empty sources, got %d", rolled.SampleCount)
	}
}

func TestRollupBuckets_P95FromMultipleBuckets(t *testing.T) {
	bucketTime := time.Now().UTC()

	// Create 25 buckets to have enough samples for p95
	sources := make([]models.MetricBucket, 25)
	for i := 0; i < 25; i++ {
		sources[i] = models.MetricBucket{
			BucketTime:  bucketTime.Add(time.Duration(i*5) * time.Minute),
			BucketSize:  "5m",
			Scope:       "machine",
			EntityID:    "local",
			Metric:      "test",
			SampleCount: 1,
			AvgValue:    float64(i + 1), // 1, 2, 3, ..., 25
			MinValue:    float64(i + 1),
			MaxValue:    float64(i + 1),
		}
	}

	rolled := rollupBuckets(bucketTime, "1h", "machine", "local", "", "test", sources)

	if rolled.P95Value == nil {
		t.Fatal("expected p95 to be set for 25 buckets")
	}
	// P95 of [1..25] = ceil(0.95*25)-1 = 23, value = 24
	expected := 24.0
	if *rolled.P95Value != expected {
		t.Errorf("expected p95 %f, got %f", expected, *rolled.P95Value)
	}
}

// ─── processMetricDef Tests ──────────────────────────────────────────────────

func TestProcessMetricDef_GetValue(t *testing.T) {
	pm := &models.ProcessMetrics{
		CpuUsagePercent:  45.5,
		WorkingSetMemory: 1024 * 1024 * 100, // 100 MB
		ThreadCount:      25,
		NetworkBytesSent: 5000,
	}

	defs := []processMetricDef{
		{"process_cpu_percent", func(r *models.ProcessMetrics) float64 { return r.CpuUsagePercent }, false},
		{"process_memory_working_set", func(r *models.ProcessMetrics) float64 { return float64(r.WorkingSetMemory) }, false},
		{"process_thread_count", func(r *models.ProcessMetrics) float64 { return float64(r.ThreadCount) }, false},
		{"process_network_bytes_sent", func(r *models.ProcessMetrics) float64 { return float64(r.NetworkBytesSent) }, true},
	}

	tests := []struct {
		name     string
		expected float64
	}{
		{"process_cpu_percent", 45.5},
		{"process_memory_working_set", 104857600},
		{"process_thread_count", 25},
		{"process_network_bytes_sent", 5000},
	}

	for i, tt := range tests {
		if defs[i].name != tt.name {
			t.Errorf("expected metric name %s, got %s", tt.name, defs[i].name)
		}
		got := defs[i].getValue(pm)
		if got != tt.expected {
			t.Errorf("metric %s: expected %f, got %f", tt.name, tt.expected, got)
		}
	}
}
