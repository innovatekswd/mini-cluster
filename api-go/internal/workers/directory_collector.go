package workers

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DirectoryMetricsCollector scans watched directories and records snapshots
// of their size, file count, and directory count.
type DirectoryMetricsCollector struct {
	aggDB *gorm.DB // metrics-aggregated.db
	log   *zap.Logger
}

// NewDirectoryMetricsCollector creates a new directory collector.
func NewDirectoryMetricsCollector(aggDB *gorm.DB, log *zap.Logger) *DirectoryMetricsCollector {
	return &DirectoryMetricsCollector{
		aggDB: aggDB,
		log:   log,
	}
}

// Run starts the directory collector. It runs every 60 seconds and checks
// which directories need scanning based on their interval.
func (d *DirectoryMetricsCollector) Run(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.scanAll(ctx)
		}
	}
}

// scanAll checks all enabled watched directories and scans those whose
// interval has elapsed since the last scan.
func (d *DirectoryMetricsCollector) scanAll(ctx context.Context) {
	var dirs []models.WatchedDirectory
	if err := d.aggDB.Where("enabled = ?", true).Find(&dirs).Error; err != nil {
		d.log.Warn("failed to load watched directories", zap.Error(err))
		return
	}

	now := time.Now().UTC()
	for _, dir := range dirs {
		// Check if enough time has elapsed since last scan
		var lastSnapshot models.DirectorySnapshot
		err := d.aggDB.Where("watched_dir_id = ?", dir.ID).
			Order("scanned_at desc").
			First(&lastSnapshot).Error

		if err == nil {
			elapsed := now.Sub(lastSnapshot.ScannedAt)
			if elapsed < time.Duration(dir.IntervalSeconds)*time.Second {
				continue // Not time to scan yet
			}
		}

		// Scan the directory
		d.scanDirectory(ctx, dir)
	}
}

// scanDirectory performs a recursive scan of a watched directory and records
// snapshots for the root and optionally for child directories.
func (d *DirectoryMetricsCollector) scanDirectory(ctx context.Context, dir models.WatchedDirectory) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		d.log.Debug("directory scan completed",
			zap.String("path", dir.Path),
			zap.Duration("elapsed", elapsed))
	}()

	info, err := os.Stat(dir.Path)
	if err != nil {
		d.log.Warn("directory not accessible",
			zap.String("path", dir.Path),
			zap.Error(err))
		return
	}
	if !info.IsDir() {
		d.log.Warn("path is not a directory", zap.String("path", dir.Path))
		return
	}

	if dir.Recursive {
		d.scanRecursive(ctx, dir)
	} else {
		d.scanSingle(ctx, dir, dir.Path, "")
	}
}

// scanRecursive walks the directory tree and creates a snapshot for each
// subdirectory found.
func (d *DirectoryMetricsCollector) scanRecursive(ctx context.Context, dir models.WatchedDirectory) {
	scannedAt := time.Now().UTC()

	err := filepath.Walk(dir.Path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip inaccessible paths
		}
		if !info.IsDir() {
			return nil
		}

		// Compute relative path
		relPath, _ := filepath.Rel(dir.Path, path)
		if relPath == "." {
			relPath = ""
		}

		d.scanSingle(ctx, dir, path, relPath)
		return nil
	})

	if err != nil {
		d.log.Warn("directory walk failed",
			zap.String("path", dir.Path),
			zap.Error(err))
	}

	// Also write bucket entries for directory metrics
	d.writeDirectoryBuckets(dir.ID, scannedAt)
}

// scanSingle scans a single directory (non-recursive) and writes a snapshot.
func (d *DirectoryMetricsCollector) scanSingle(ctx context.Context, dir models.WatchedDirectory, path, subPath string) {
	var totalSize int64
	var fileCount, dirCount int64
	var lastModified time.Time

	entries, err := os.ReadDir(path)
	if err != nil {
		d.log.Warn("failed to read directory",
			zap.String("path", path),
			zap.Error(err))
		return
	}

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		if entry.IsDir() {
			dirCount++
		} else {
			fileCount++
			totalSize += info.Size()
			if info.ModTime().After(lastModified) {
				lastModified = info.ModTime()
			}
		}
	}

	snapshot := models.DirectorySnapshot{
		WatchedDirID: dir.ID,
		SubPath:      subPath,
		TotalSize:    totalSize,
		FileCount:    fileCount,
		DirCount:     dirCount,
		LastModified: lastModified,
		ScannedAt:    time.Now().UTC(),
	}

	if err := d.aggDB.Create(&snapshot).Error; err != nil {
		d.log.Warn("failed to write directory snapshot",
			zap.String("dir", dir.Path),
			zap.Error(err))
	}
}

// writeDirectoryBuckets writes aggregated metrics for the directory into
// the buckets table for time-series visualization.
func (d *DirectoryMetricsCollector) writeDirectoryBuckets(watchedDirID string, scannedAt time.Time) {
	// Get all snapshots for this directory from the current 5-minute window
	bucketEnd := scannedAt.Truncate(5 * time.Minute)
	bucketStart := bucketEnd.Add(-5 * time.Minute)

	var snapshots []models.DirectorySnapshot
	d.aggDB.Where("watched_dir_id = ? AND scanned_at >= ? AND scanned_at < ?",
		watchedDirID, bucketStart, bucketEnd).
		Find(&snapshots)

	if len(snapshots) == 0 {
		return
	}

	// Group by sub_path and compute aggregates
	type subPathKey string
	groups := make(map[subPathKey][]models.DirectorySnapshot)
	for _, s := range snapshots {
		groups[subPathKey(s.SubPath)] = append(groups[subPathKey(s.SubPath)], s)
	}

	for subPath, group := range groups {
		if len(group) == 0 {
			continue
		}

		// Compute aggregates
		var minSize, maxSize, sumSize int64
		var minFiles, maxFiles, sumFiles int64
		minSize = group[0].TotalSize
		maxSize = group[0].TotalSize
		minFiles = group[0].FileCount
		maxFiles = group[0].FileCount

		for _, s := range group {
			if s.TotalSize < minSize {
				minSize = s.TotalSize
			}
			if s.TotalSize > maxSize {
				maxSize = s.TotalSize
			}
			sumSize += s.TotalSize
			if s.FileCount < minFiles {
				minFiles = s.FileCount
			}
			if s.FileCount > maxFiles {
				maxFiles = s.FileCount
			}
			sumFiles += s.FileCount
		}

		count := float64(len(group))
		avgSize := float64(sumSize) / count
		avgFiles := float64(sumFiles) / count
		lastSnapshot := group[len(group)-1]

		// Write size bucket
		d.aggDB.Create(&models.MetricBucket{
			BucketTime:  bucketStart,
			BucketSize:  "5m",
			Scope:       "directory",
			EntityID:    watchedDirID,
			SubEntity:   string(subPath),
			Metric:      "dir_size_bytes",
			SampleCount: len(group),
			MinValue:    float64(minSize),
			MaxValue:    float64(maxSize),
			AvgValue:    avgSize,
			SumValue:    ptrFloat64(float64(sumSize)),
			LastValue:   ptrFloat64(float64(lastSnapshot.TotalSize)),
			CreatedAt:   time.Now().UTC(),
		})

		// Write file count bucket
		d.aggDB.Create(&models.MetricBucket{
			BucketTime:  bucketStart,
			BucketSize:  "5m",
			Scope:       "directory",
			EntityID:    watchedDirID,
			SubEntity:   string(subPath),
			Metric:      "dir_file_count",
			SampleCount: len(group),
			MinValue:    float64(minFiles),
			MaxValue:    float64(maxFiles),
			AvgValue:    avgFiles,
			SumValue:    ptrFloat64(float64(sumFiles)),
			LastValue:   ptrFloat64(float64(lastSnapshot.FileCount)),
			CreatedAt:   time.Now().UTC(),
		})
	}
}

// ptrFloat64 returns a pointer to a float64 value.
func ptrFloat64(v float64) *float64 {
	return &v
}

// ─── Directory CRUD API helpers ─────────────────────────────────────────────

// CreateWatchedDirectory creates a new watched directory configuration.
func CreateWatchedDirectory(db *gorm.DB, path, label string, recursive bool, intervalSeconds int) (*models.WatchedDirectory, error) {
	if intervalSeconds < 60 {
		intervalSeconds = 60
	}

	dir := &models.WatchedDirectory{
		ID:              uuid.New().String(),
		Path:            path,
		Label:           label,
		Recursive:       recursive,
		IntervalSeconds: intervalSeconds,
		Enabled:         true,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}

	if err := db.Create(dir).Error; err != nil {
		return nil, err
	}
	return dir, nil
}

// ListWatchedDirectories returns all configured watched directories.
func ListWatchedDirectories(db *gorm.DB) ([]models.WatchedDirectory, error) {
	var dirs []models.WatchedDirectory
	if err := db.Order("created_at desc").Find(&dirs).Error; err != nil {
		return nil, err
	}
	return dirs, nil
}

// UpdateWatchedDirectory updates an existing watched directory configuration.
func UpdateWatchedDirectory(db *gorm.DB, id string, updates map[string]interface{}) (*models.WatchedDirectory, error) {
	var dir models.WatchedDirectory
	if err := db.First(&dir, "id = ?", id).Error; err != nil {
		return nil, err
	}

	if path, ok := updates["path"].(string); ok {
		dir.Path = path
	}
	if label, ok := updates["label"].(string); ok {
		dir.Label = label
	}
	if recursive, ok := updates["recursive"].(bool); ok {
		dir.Recursive = recursive
	}
	if interval, ok := updates["interval_seconds"].(int); ok {
		if interval < 60 {
			interval = 60
		}
		dir.IntervalSeconds = interval
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		dir.Enabled = enabled
	}
	dir.UpdatedAt = time.Now().UTC()

	if err := db.Save(&dir).Error; err != nil {
		return nil, err
	}
	return &dir, nil
}

// DeleteWatchedDirectory removes a watched directory and its snapshots.
func DeleteWatchedDirectory(db *gorm.DB, id string) error {
	// Delete snapshots first
	if err := db.Where("watched_dir_id = ?", id).Delete(&models.DirectorySnapshot{}).Error; err != nil {
		return err
	}
	// Delete buckets for this directory
	if err := db.Where("scope = ? AND entity_id = ?", "directory", id).Delete(&models.MetricBucket{}).Error; err != nil {
		return err
	}
	// Delete the directory config
	return db.Delete(&models.WatchedDirectory{}, "id = ?", id).Error
}

// GetDirectorySnapshots returns snapshots for a watched directory.
func GetDirectorySnapshots(db *gorm.DB, watchedDirID string, from, to time.Time) ([]models.DirectorySnapshot, error) {
	var snapshots []models.DirectorySnapshot
	query := db.Where("watched_dir_id = ?", watchedDirID)
	if !from.IsZero() {
		query = query.Where("scanned_at >= ?", from)
	}
	if !to.IsZero() {
		query = query.Where("scanned_at <= ?", to)
	}
	if err := query.Order("scanned_at desc").Limit(1000).Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}
