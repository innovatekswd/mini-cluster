package db

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/glebarez/sqlite"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB holds all database connections.
type DB struct {
	App        *gorm.DB
	Logs       *gorm.DB
	Aggregated *gorm.DB // metrics-aggregated.db for time-bucketed aggregations
}

// DataDir returns the platform-appropriate data directory.
func DataDir() string {
	if dir := os.Getenv("MINICLUSTER_DATA_DIR"); dir != "" {
		return dir
	}
	if runtime.GOOS == "windows" {
		base := os.Getenv("ProgramData")
		if base == "" {
			base = `C:\ProgramData`
		}
		return filepath.Join(base, "MiniCluster")
	}
	return "/var/lib/minicluster"
}

// Open opens all SQLite databases and runs auto-migrations.
func Open(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	appDB, err := gorm.Open(sqlite.Open(
		filepath.Join(dataDir, "minicluster.db")+"?_journal_mode=WAL&_busy_timeout=5000&cache=shared",
	), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("open app db: %w", err)
	}

	logsDB, err := gorm.Open(sqlite.Open(
		filepath.Join(dataDir, "logs.db")+"?_journal_mode=WAL&_busy_timeout=5000&cache=shared",
	), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("open logs db: %w", err)
	}

	aggDB, err := gorm.Open(sqlite.Open(
		filepath.Join(dataDir, "metrics-aggregated.db")+"?_journal_mode=WAL&_busy_timeout=5000",
	), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("open aggregated db: %w", err)
	}

	if err := migrateApp(appDB); err != nil {
		return nil, fmt.Errorf("migrate app db: %w", err)
	}
	if err := migrateLogs(logsDB); err != nil {
		return nil, fmt.Errorf("migrate logs db: %w", err)
	}
	if err := migrateAggregated(aggDB); err != nil {
		return nil, fmt.Errorf("migrate aggregated db: %w", err)
	}

	return &DB{App: appDB, Logs: logsDB, Aggregated: aggDB}, nil
}

func migrateApp(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.RefreshToken{},
		&models.App{},
		&models.Service{},
		&models.Environment{},
		&models.Machine{},
		&models.CronJob{},
		&models.CronJobRun{},
		&models.ProxyRoute{},
		&models.ProxySetting{},
		&models.ServiceGroup{},
		&models.ServiceGroupAssignment{},
		&models.GroupVariable{},
		&models.AppSettings{},
		&models.ServiceVersion{},
		&models.AppFile{},
		&models.ContainerConfig{},
		&models.Package{},
		&models.PackageInstall{},
	)
}

func migrateLogs(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.ServiceSession{},
		&models.SessionLogEntry{},
		&models.LifecycleEvent{},
		&models.ProcessMetrics{},
		&models.SystemMetrics{},
	)
}

// migrateAggregated creates tables in the metrics-aggregated database.
// This database stores time-bucketed aggregations to avoid write contention with logs.db.
func migrateAggregated(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.MetricBucket{},
		&models.WatchedDirectory{},
		&models.DirectorySnapshot{},
	)
}
