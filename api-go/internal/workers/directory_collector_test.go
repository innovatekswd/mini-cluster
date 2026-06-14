package workers

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database with the required tables.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.WatchedDirectory{},
		&models.DirectorySnapshot{},
		&models.MetricBucket{},
	); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}
	return db
}

func testLogger() *zap.Logger {
	log, _ := zap.NewDevelopment()
	return log
}

// ─── CRUD Tests ──────────────────────────────────────────────────────────────

func TestCreateWatchedDirectory(t *testing.T) {
	db := setupTestDB(t)

	dir, err := CreateWatchedDirectory(db, "/tmp/test", "Test Dir", true, 300)
	if err != nil {
		t.Fatalf("CreateWatchedDirectory failed: %v", err)
	}

	if dir.Path != "/tmp/test" {
		t.Errorf("expected path /tmp/test, got %s", dir.Path)
	}
	if dir.Label != "Test Dir" {
		t.Errorf("expected label 'Test Dir', got %s", dir.Label)
	}
	if !dir.Recursive {
		t.Error("expected recursive=true")
	}
	if dir.IntervalSeconds != 300 {
		t.Errorf("expected interval 300, got %d", dir.IntervalSeconds)
	}
	if !dir.Enabled {
		t.Error("expected enabled=true")
	}
	if dir.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestCreateWatchedDirectory_MinInterval(t *testing.T) {
	db := setupTestDB(t)

	// Interval below 60 should be clamped to 60
	dir, err := CreateWatchedDirectory(db, "/tmp/test2", "Test", false, 10)
	if err != nil {
		t.Fatalf("CreateWatchedDirectory failed: %v", err)
	}

	if dir.IntervalSeconds != 60 {
		t.Errorf("expected interval clamped to 60, got %d", dir.IntervalSeconds)
	}
}

func TestListWatchedDirectories(t *testing.T) {
	db := setupTestDB(t)

	// Create two directories
	CreateWatchedDirectory(db, "/tmp/a", "A", true, 60)
	CreateWatchedDirectory(db, "/tmp/b", "B", false, 120)

	dirs, err := ListWatchedDirectories(db)
	if err != nil {
		t.Fatalf("ListWatchedDirectories failed: %v", err)
	}
	if len(dirs) != 2 {
		t.Errorf("expected 2 directories, got %d", len(dirs))
	}
}

func TestUpdateWatchedDirectory(t *testing.T) {
	db := setupTestDB(t)

	dir, _ := CreateWatchedDirectory(db, "/tmp/upd", "Original", true, 300)

	updates := map[string]interface{}{
		"label":            "Updated",
		"recursive":        false,
		"interval_seconds": 600,
		"enabled":          false,
	}

	updated, err := UpdateWatchedDirectory(db, dir.ID, updates)
	if err != nil {
		t.Fatalf("UpdateWatchedDirectory failed: %v", err)
	}

	if updated.Label != "Updated" {
		t.Errorf("expected label 'Updated', got %s", updated.Label)
	}
	if updated.Recursive {
		t.Error("expected recursive=false after update")
	}
	if updated.IntervalSeconds != 600 {
		t.Errorf("expected interval 600, got %d", updated.IntervalSeconds)
	}
	if updated.Enabled {
		t.Error("expected enabled=false after update")
	}
}

func TestUpdateWatchedDirectory_MinIntervalClamp(t *testing.T) {
	db := setupTestDB(t)

	dir, _ := CreateWatchedDirectory(db, "/tmp/clamp", "Clamp", true, 300)

	updates := map[string]interface{}{
		"interval_seconds": 5, // Below minimum
	}

	updated, err := UpdateWatchedDirectory(db, dir.ID, updates)
	if err != nil {
		t.Fatalf("UpdateWatchedDirectory failed: %v", err)
	}

	if updated.IntervalSeconds != 60 {
		t.Errorf("expected interval clamped to 60, got %d", updated.IntervalSeconds)
	}
}

func TestUpdateWatchedDirectory_NotFound(t *testing.T) {
	db := setupTestDB(t)

	updates := map[string]interface{}{"label": "X"}
	_, err := UpdateWatchedDirectory(db, "nonexistent-id", updates)
	if err == nil {
		t.Error("expected error for nonexistent ID")
	}
}

func TestDeleteWatchedDirectory(t *testing.T) {
	db := setupTestDB(t)

	dir, _ := CreateWatchedDirectory(db, "/tmp/del", "Delete Me", true, 60)

	// Add a snapshot
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dir.ID,
		SubPath:      "",
		TotalSize:    1024,
		FileCount:    10,
		DirCount:     2,
		ScannedAt:    time.Now().UTC(),
	})

	// Add a bucket
	db.Create(&models.MetricBucket{
		BucketTime:  time.Now().UTC(),
		BucketSize:  "5m",
		Scope:       "directory",
		EntityID:    dir.ID,
		SubEntity:   "",
		Metric:      "dir_size_bytes",
		SampleCount: 1,
		MinValue:    1024,
		MaxValue:    1024,
		AvgValue:    1024,
		CreatedAt:   time.Now().UTC(),
	})

	err := DeleteWatchedDirectory(db, dir.ID)
	if err != nil {
		t.Fatalf("DeleteWatchedDirectory failed: %v", err)
	}

	// Verify directory is gone
	var count int64
	db.Model(&models.WatchedDirectory{}).Where("id = ?", dir.ID).Count(&count)
	if count != 0 {
		t.Error("watched directory should be deleted")
	}

	// Verify snapshots are gone
	db.Model(&models.DirectorySnapshot{}).Where("watched_dir_id = ?", dir.ID).Count(&count)
	if count != 0 {
		t.Error("directory snapshots should be deleted")
	}

	// Verify buckets are gone
	db.Model(&models.MetricBucket{}).Where("scope = ? AND entity_id = ?", "directory", dir.ID).Count(&count)
	if count != 0 {
		t.Error("directory buckets should be deleted")
	}
}

func TestGetDirectorySnapshots(t *testing.T) {
	db := setupTestDB(t)

	dir, _ := CreateWatchedDirectory(db, "/tmp/snap", "Snap", true, 60)

	now := time.Now().UTC()

	// Create snapshots at different times
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dir.ID,
		SubPath:      "",
		TotalSize:    100,
		FileCount:    1,
		ScannedAt:    now.Add(-10 * time.Minute),
	})
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dir.ID,
		SubPath:      "sub",
		TotalSize:    200,
		FileCount:    2,
		ScannedAt:    now.Add(-5 * time.Minute),
	})
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dir.ID,
		SubPath:      "",
		TotalSize:    300,
		FileCount:    3,
		ScannedAt:    now,
	})

	// Get all snapshots
	snaps, err := GetDirectorySnapshots(db, dir.ID, time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("GetDirectorySnapshots failed: %v", err)
	}
	if len(snaps) != 3 {
		t.Errorf("expected 3 snapshots, got %d", len(snaps))
	}

	// Get snapshots within time range
	from := now.Add(-7 * time.Minute)
	to := now.Add(-3 * time.Minute)
	snaps, err = GetDirectorySnapshots(db, dir.ID, from, to)
	if err != nil {
		t.Fatalf("GetDirectorySnapshots with range failed: %v", err)
	}
	if len(snaps) != 1 {
		t.Errorf("expected 1 snapshot in range, got %d", len(snaps))
	}
}

// ─── scanSingle Tests ────────────────────────────────────────────────────────

func TestScanSingle_BasicDirectory(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	// Create a temp directory with known contents
	tmpDir := t.TempDir()

	// Create some files
	os.WriteFile(filepath.Join(tmpDir, "file1.txt"), []byte("hello"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "file2.txt"), []byte("world!"), 0644)
	os.Mkdir(filepath.Join(tmpDir, "subdir"), 0755)

	dir := models.WatchedDirectory{
		ID:              "test-dir-id",
		Path:            tmpDir,
		Label:           "Test",
		Recursive:       false,
		IntervalSeconds: 60,
		Enabled:         true,
	}

	// We need to create the watched directory in DB first for FK
	db.Create(&dir)

	collector.scanSingle(nil, dir, tmpDir, "")

	// Verify snapshot was created
	var snap models.DirectorySnapshot
	err := db.Where("watched_dir_id = ?", dir.ID).First(&snap).Error
	if err != nil {
		t.Fatalf("expected snapshot to be created: %v", err)
	}

	if snap.FileCount != 2 {
		t.Errorf("expected 2 files, got %d", snap.FileCount)
	}
	if snap.DirCount != 1 {
		t.Errorf("expected 1 subdir, got %d", snap.DirCount)
	}
	if snap.TotalSize != 11 { // "hello" (5) + "world!" (6)
		t.Errorf("expected total size 11, got %d", snap.TotalSize)
	}
	if snap.SubPath != "" {
		t.Errorf("expected empty subpath for root scan, got %s", snap.SubPath)
	}
}

func TestScanSingle_EmptyDirectory(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	tmpDir := t.TempDir()

	dir := models.WatchedDirectory{
		ID:   "empty-dir-id",
		Path: tmpDir,
	}
	db.Create(&dir)

	collector.scanSingle(nil, dir, tmpDir, "")

	var snap models.DirectorySnapshot
	err := db.Where("watched_dir_id = ?", dir.ID).First(&snap).Error
	if err != nil {
		t.Fatalf("expected snapshot for empty dir: %v", err)
	}

	if snap.FileCount != 0 {
		t.Errorf("expected 0 files, got %d", snap.FileCount)
	}
	if snap.DirCount != 0 {
		t.Errorf("expected 0 dirs, got %d", snap.DirCount)
	}
	if snap.TotalSize != 0 {
		t.Errorf("expected 0 size, got %d", snap.TotalSize)
	}
}

func TestScanSingle_NonexistentDirectory(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	dir := models.WatchedDirectory{
		ID:   "nonexistent-id",
		Path: "/nonexistent/path/that/does/not/exist",
	}

	// Should not panic, just log a warning
	collector.scanSingle(nil, dir, dir.Path, "")

	// Verify no snapshot was created
	var count int64
	db.Model(&models.DirectorySnapshot{}).Where("watched_dir_id = ?", dir.ID).Count(&count)
	if count != 0 {
		t.Error("should not create snapshot for nonexistent directory")
	}
}

func TestScanSingle_WithSubPath(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	tmpDir := t.TempDir()
	subDir := filepath.Join(tmpDir, "child")
	os.Mkdir(subDir, 0755)
	os.WriteFile(filepath.Join(subDir, "a.txt"), []byte("aaa"), 0644)

	dir := models.WatchedDirectory{
		ID:   "subpath-id",
		Path: tmpDir,
	}
	db.Create(&dir)

	collector.scanSingle(nil, dir, subDir, "child")

	var snap models.DirectorySnapshot
	err := db.Where("watched_dir_id = ?", dir.ID).First(&snap).Error
	if err != nil {
		t.Fatalf("expected snapshot: %v", err)
	}

	if snap.SubPath != "child" {
		t.Errorf("expected subpath 'child', got %s", snap.SubPath)
	}
	if snap.FileCount != 1 {
		t.Errorf("expected 1 file, got %d", snap.FileCount)
	}
}

// ─── writeDirectoryBuckets Tests ─────────────────────────────────────────────

func TestWriteDirectoryBuckets_Aggregation(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	dirID := "bucket-test-id"
	now := time.Now().UTC().Truncate(5 * time.Minute)

	// Create snapshots within the current 5-minute window
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "",
		TotalSize:    100,
		FileCount:    10,
		ScannedAt:    now.Add(1 * time.Minute),
	})
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "",
		TotalSize:    200,
		FileCount:    20,
		ScannedAt:    now.Add(2 * time.Minute),
	})
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "",
		TotalSize:    300,
		FileCount:    30,
		ScannedAt:    now.Add(3 * time.Minute),
	})

	// Write buckets using the end of the window as scannedAt
	scannedAt := now.Add(4 * time.Minute)
	collector.writeDirectoryBuckets(dirID, scannedAt)

	// Verify buckets were created
	var buckets []models.MetricBucket
	db.Where("scope = ? AND entity_id = ?", "directory", dirID).Find(&buckets)

	if len(buckets) != 2 {
		t.Fatalf("expected 2 buckets (size + file_count), got %d", len(buckets))
	}

	// Find the size bucket
	var sizeBucket, fileBucket models.MetricBucket
	for _, b := range buckets {
		if b.Metric == "dir_size_bytes" {
			sizeBucket = b
		}
		if b.Metric == "dir_file_count" {
			fileBucket = b
		}
	}

	// Verify size bucket aggregates
	if sizeBucket.SampleCount != 3 {
		t.Errorf("expected 3 samples, got %d", sizeBucket.SampleCount)
	}
	if sizeBucket.MinValue != 100 {
		t.Errorf("expected min 100, got %f", sizeBucket.MinValue)
	}
	if sizeBucket.MaxValue != 300 {
		t.Errorf("expected max 300, got %f", sizeBucket.MaxValue)
	}
	expectedAvg := float64(100+200+300) / 3.0
	if sizeBucket.AvgValue != expectedAvg {
		t.Errorf("expected avg %f, got %f", expectedAvg, sizeBucket.AvgValue)
	}
	if sizeBucket.SumValue == nil || *sizeBucket.SumValue != 600 {
		t.Errorf("expected sum 600, got %v", sizeBucket.SumValue)
	}
	if sizeBucket.LastValue == nil || *sizeBucket.LastValue != 300 {
		t.Errorf("expected last 300, got %v", sizeBucket.LastValue)
	}

	// Verify file count bucket aggregates
	if fileBucket.SampleCount != 3 {
		t.Errorf("expected 3 samples, got %d", fileBucket.SampleCount)
	}
	if fileBucket.MinValue != 10 {
		t.Errorf("expected min 10, got %f", fileBucket.MinValue)
	}
	if fileBucket.MaxValue != 30 {
		t.Errorf("expected max 30, got %f", fileBucket.MaxValue)
	}
}

func TestWriteDirectoryBuckets_MultipleSubPaths(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	dirID := "multi-sub-id"
	now := time.Now().UTC().Truncate(5 * time.Minute)

	// Root snapshots
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "",
		TotalSize:    1000,
		FileCount:    50,
		ScannedAt:    now.Add(1 * time.Minute),
	})

	// Sub-directory snapshots
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "logs",
		TotalSize:    500,
		FileCount:    10,
		ScannedAt:    now.Add(1 * time.Minute),
	})
	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "data",
		TotalSize:    2000,
		FileCount:    100,
		ScannedAt:    now.Add(1 * time.Minute),
	})

	collector.writeDirectoryBuckets(dirID, now.Add(4 * time.Minute))

	var buckets []models.MetricBucket
	db.Where("scope = ? AND entity_id = ?", "directory", dirID).Find(&buckets)

	// 3 sub-paths × 2 metrics = 6 buckets
	if len(buckets) != 6 {
		t.Errorf("expected 6 buckets, got %d", len(buckets))
	}
}

func TestWriteDirectoryBuckets_NoSnapshots(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	// No snapshots exist for this dir
	collector.writeDirectoryBuckets("empty-dir", time.Now().UTC())

	var count int64
	db.Model(&models.MetricBucket{}).Where("entity_id = ?", "empty-dir").Count(&count)
	if count != 0 {
		t.Errorf("expected 0 buckets when no snapshots, got %d", count)
	}
}

func TestWriteDirectoryBuckets_BucketTimeAlignment(t *testing.T) {
	db := setupTestDB(t)
	log := testLogger()
	collector := NewDirectoryMetricsCollector(db, log)

	dirID := "align-test-id"
	// Use a specific time that's not aligned
	scannedAt := time.Date(2024, 1, 15, 10, 37, 0, 0, time.UTC) // 10:37
	expectedBucketTime := time.Date(2024, 1, 15, 10, 35, 0, 0, time.UTC) // Should truncate to 10:35

	db.Create(&models.DirectorySnapshot{
		WatchedDirID: dirID,
		SubPath:      "",
		TotalSize:    100,
		FileCount:    5,
		ScannedAt:    scannedAt.Add(-1 * time.Minute),
	})

	collector.writeDirectoryBuckets(dirID, scannedAt)

	var bucket models.MetricBucket
	err := db.Where("entity_id = ? AND metric = ?", dirID, "dir_size_bytes").First(&bucket).Error
	if err != nil {
		t.Fatalf("expected bucket: %v", err)
	}

	if !bucket.BucketTime.Equal(expectedBucketTime) {
		t.Errorf("expected bucket time %v, got %v", expectedBucketTime, bucket.BucketTime)
	}
	if bucket.BucketSize != "5m" {
		t.Errorf("expected bucket size '5m', got %s", bucket.BucketSize)
	}
}

// ─── ptrFloat64 Tests ────────────────────────────────────────────────────────

func TestPtrFloat64(t *testing.T) {
	v := 42.5
	ptr := ptrFloat64(v)

	if ptr == nil {
		t.Fatal("expected non-nil pointer")
	}
	if *ptr != v {
		t.Errorf("expected %f, got %f", v, *ptr)
	}

	// Verify it's a new pointer (not aliasing)
	*ptr = 99.0
	if v != 42.5 {
		t.Error("ptrFloat64 should return a new pointer, not alias the original")
	}
}
