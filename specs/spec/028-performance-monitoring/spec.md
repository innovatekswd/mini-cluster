# Feature 028: Time-Series Performance Monitoring & Aggregation

> **Status:** ✅ Implemented  
> **Phase:** Observability & Analytics  
> **Priority:** 🟡 HIGH  
> **Estimated Effort:** 5–6 weeks  
> **Author:** Zoo  
> **Date:** 2026-06-14

---

## 1. Executive Summary

MiniCluster currently collects system and process metrics every 5 seconds and stores them as flat rows. The UI displays a rolling window of ~60 live data points (~5 minutes) with no time-bucket aggregation, no historical drill-down, and no scope selection. Network metrics are incorrectly reported as cumulative byte counts rather than rates.

This specification defines a **time-series performance monitoring system** that provides aggregated views (min, max, average, p95, total) over configurable time periods (hours, days, weeks, months) for any scope: whole machine, individual process, service, application, group of applications, or monitored filesystem directory. Aggregated data lives in a **separate SQLite database** from raw metrics, keeping the collection pipeline fast and isolation clean.

---

## 2. Current State Audit

### 2.1 What Exists Today

| Layer | File | Behavior |
|-------|------|----------|
| **Collector** | [`api-go/internal/workers/metrics_collector.go`](api-go/internal/workers/metrics_collector.go) | Ticks every N seconds, writes flat rows to `system_metrics` and `process_metrics` tables |
| **API** | [`api-go/internal/handlers/metrics.go`](api-go/internal/handlers/metrics.go) | `/api/metrics/system/history` returns raw rows with `from`/`to`/`limit` filters. No aggregation |
| **Models** | [`api-go/internal/models/logs_models.go`](api-go/internal/models/logs_models.go) | `SystemMetrics` and `ProcessMetrics` tables — flat, no pre-aggregated buckets |
| **UI Hook** | [`ui/app/hooks/useSystemMetricsHistory.ts`](ui/app/hooks/useSystemMetricsHistory.ts) | Polls every 5s, keeps 60 points in-memory, no server-side aggregation |
| **UI Page** | [`ui/app/components/TaskManager.tsx`](ui/app/components/TaskManager.tsx) | Live-only view, 4 tabs (processes, performance, disks, network), no time-range selector |

### 2.2 Identified Defects

#### 🔴 Network Metrics Bug (Critical)
In [`metrics_collector.go:215-229`](api-go/internal/workers/metrics_collector.go:215):
```go
// BUG: IOCounters returns CUMULATIVE bytes since boot, not rates
if ifaces, err := psnet.IOCounters(true); err == nil {
    for _, iface := range ifaces {
        snap.NetworkInterfaces = append(..., handlers.NetworkInterfaceInfo{
            SendRate:    float64(iface.BytesSent),   // ← cumulative, not bytes/sec
            ReceiveRate: float64(iface.BytesRecv),   // ← cumulative, not bytes/sec
        })
    }
}
```
`gopsutil.IOCounters()` returns cumulative counters. To derive rates (bytes/sec), the collector must store the previous sample and compute `delta_bytes / delta_seconds`.

#### 🟡 No Time Dimension on Charts
Charts in `TaskManager.tsx` show raw sequential points on the Y-axis only. The X-axis is an implicit sample index, not actual timestamps. Users cannot see "what happened at 3 AM" or "compare today vs yesterday."

#### 🟡 No Aggregation
No min/max/avg over time buckets. If a user wants "average CPU over the last 24 hours," they must load thousands of raw rows and compute client-side.

#### 🟡 No Scope Selection
Metrics are either system-wide or per-service. There is no way to aggregate metrics for:
- A single application (sum/avg of all its services)
- Multiple selected applications
- A specific service group
- A monitored directory or its children

#### 🟡 No Retention Policy
Raw 5-second samples accumulate indefinitely. After 30 days, the `system_metrics` table contains ~518,400 rows per machine with no downsampling or cleanup.

---

## 3. Goals

| Goal | Description |
|------|-------------|
| **G1** | Fix network metrics to report both rates (bytes/sec) AND cumulative totals |
| **G2** | Expand metrics coverage to everything gopsutil exposes: CPU per-core, load, memory breakdown (used/cached/buffers/swap), network packets/errors/drops, disk IOPS/latency/queue, filesystem inodes |
| **G3** | Add directory-level filesystem monitoring: track size, file count, growth rate for any path, with recursive child tracking |
| **G4** | Provide server-side time-bucket aggregation (count, min, max, avg, p95, sum) |
| **G5** | Store aggregated data in a **separate SQLite database** (`aggregated_metrics.db`) to avoid write contention with raw metrics collection |
| **G6** | Support configurable time ranges: 1h, 6h, 24h, 7d, 30d, 90d, custom |
| **G7** | Support configurable bucket sizes: 1min, 5min, 15min, 1h, 1d, 1w |
| **G8** | Support scope selection: machine, process, service, app, multi-app, directory |
| **G9** | Render timeline charts with proper time axis, min/max bands, and avg line |
| **G10** | Implement tiered retention: raw (7d), 5-min buckets (30d), 1h buckets (1y), 1d buckets (forever) |

---

## 4. Non-Goals

- Replace SignalR live transport (live view remains real-time via WebSocket)
- Implement full APM (distributed tracing, flame graphs) — deferred to OTLP spec
- Build a general-purpose BI/charting platform
- Require TimescaleDB for v1 (SQLite-compatible approach first)

---

## 5. Technical Design

### 5.1 Architecture Overview

#### Single-Node (v1)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           COLLECTION LAYER                                      │
│  MetricsCollector (every 5s) - LOCAL node                                      │
│  ├── System metrics (all gopsutil families)                                    │
│  ├── Process metrics                                                           │
│  ├── Directory metrics (scanner)                                               │
│  ├── Tags all rows with `machine_id` for future multi-node                     │
│  ├── Store raw row → `logs.db` (system_metrics / process_metrics)              │
│  └── SignalR broadcast (live view unchanged)                                   │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      AGGREGATION LAYER (Background Worker)                      │
│  MetricsAggregator (runs every minute) - LOCAL node                            │
│  ├── Connects to separate `metrics-aggregated.db`                              │
│  ├── Reads raw rows from `logs.db` for the last bucket window                 │
│  ├── Tags all bucket rows with `machine_id`                                    │
│  ├── Computes: count, min, max, avg, p95, sum, last                           │
│  ├── Writes to: buckets table                                                  │
│  ├── Cascading rollup: 5min → 1h → 1d → 1w                                    │
│  └── Retention cleanup                                                         │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                        QUERY LAYER (API)                                        │
│  GET /api/metrics/aggregated  ← reads from `metrics-aggregated.db`            │
│  ├── scope=machine|service|app|multi-app|directory|cluster                     │
│  ├── machine/node filters (single-node returns local by default)               │
│  └── Future: fan-out to remote agents if ?node=|?cluster= specified            │
└───────────────────────────┬───────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER (UI)                                    │
│  Monitor page - "History" tab                                                    │
│  ├── Scope selector: Machine | Service | App | Multi-App | Directory            │
│  ├── [Multi-node only] Node selector: Local | Node2 | Node3 | All              │
│  ├── Time range: 1h | 6h | 24h | 7d | 30d | 90d | Custom                        │
│  ├── Bucket: Auto | 1m | 5m | 15m | 1h | 1d | 1w                               │
│  ├── Metric picker: toggle families                                              │
│  ├── Charts: avg line + min/max band + p95 dashed line                           │
│  ├── Stats panel: current, avg, min, max, p95 for visible range                  │
│  ├── Comparison mode: overlay two time ranges                                    │
│  └── Export: CSV, PNG, JSON                                                      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### Multi-Node / Cluster (future extension - same schema works)

When multi-node cluster (Spec 010) is realized, each node runs the same collector + aggregator stack with its own local databases. The controller queries remote nodes via agent API:

```
Controller Node
  GET /api/metrics/aggregated?scope=cluster
  ├── Fan-out to each agent's /api/metrics/aggregated endpoint
  ├── Merge+reduce bucket rows per time window
  └── Return unified cluster-level series

Agent Node
  GET /api/metrics/aggregated?node=<machine_id>
  └── Same endpoint, filtered to local metrics-aggregated.db
```

### 5.2 Separate Aggregated Database

A dedicated SQLite file `metrics-aggregated.db` lives alongside the existing `logs.db`.

**Rationale:**
- Prevents write contention between raw 5-second inserts and backfill aggregation queries
- Allows different WAL/journal settings (aggregated DB can be WAL-mode with larger cache)
- Clean separation of concerns — raw and aggregated can have different backup schedules
- Aggregated data is append-only on rollup boundaries, so it benefits from less frequent writes
- Future: aggregated DB can be moved to a faster disk tier without touching raw data

**Connection management:**
```go
// In main.go or worker init:
aggDB, err := gorm.Open(sqlite.Open("data/metrics-aggregated.db?_journal_mode=WAL&_busy_timeout=5000"), &gorm.Config{})
rawDB, err := gorm.Open(sqlite.Open("data/logs.db?_journal_mode=WAL"), &gorm.Config{})
```

### 5.3 Network Rate + Total Fix

The collector stores BOTH cumulative totals AND computes deltas for rates:

```go
type networkState struct {
    prevBytesSent   uint64
    prevBytesRecv   uint64
    prevPacketsSent uint64
    prevPacketsRecv uint64
    prevTime        time.Time
}

// In collectSystem(), for each interface:
currentSent := iface.BytesSent
currentRecv := iface.BytesRecv
elapsed := now.Sub(prev.prevTime).Seconds()

// Store cumulative totals (always valid)
snap.NetworkInterfaces = append(..., NetworkInterfaceInfo{
    Name:            iface.Name,
    BytesSentTotal:  int64(currentSent),    // ← cumulative total
    BytesRecvTotal:  int64(currentRecv),    // ← cumulative total
    PacketsSent:     int64(iface.PacketsSent),
    PacketsRecv:     int64(iface.PacketsRecv),
    ErrorsIn:        int64(iface.Errin),
    ErrorsOut:       int64(iface.Errout),
    DropsIn:         int64(iface.Dropin),
    DropsOut:        int64(iface.Dropout),
    SendRate:        computeDelta(currentSent, prev.prevBytesSent, elapsed),   // ← rate
    ReceiveRate:     computeDelta(currentRecv, prev.prevBytesRecv, elapsed),   // ← rate
    Status:          "up",
})
```

Where `computeDelta` guards against counter resets:
```go
func computeDelta(current, previous uint64, elapsed float64) float64 {
    if elapsed <= 0 || previous == 0 {
        return 0  // first sample or no elapsed time
    }
    if current < previous {
        return 0  // counter reset (reboot, interface flap)
    }
    return float64(current-previous) / elapsed
}
```

### 5.4 Expanded Metric Catalog

All metrics the system will collect, organized by source:

#### 5.4.1 CPU Metrics

| Metric Name | Source | Unit | Aggregation |
|-------------|--------|------|-------------|
| `cpu_percent` | `cpu.Percent(aggregate)` | percent | avg, min, max, p95 |
| `cpu_percent_per_core` | `cpu.Percent(percpu=true)` | percent | avg per core, max per core |
| `cpu_load_1m` | `load.Avg()` | load | avg, min, max |
| `cpu_load_5m` | `load.Avg()` | load | avg, min, max |
| `cpu_load_15m` | `load.Avg()` | load | avg, min, max |
| `cpu_context_switches` | `cpu.Times(false)` → delta | count/sec | rate, total |
| `cpu_interrupts` | `cpu.Times(false)` → delta | count/sec | rate, total |

#### 5.4.2 Memory Metrics

| Metric Name | Source | Unit | Aggregation |
|-------------|--------|------|-------------|
| `mem_used_percent` | `mem.VirtualMemory()` | percent | avg, min, max |
| `mem_total_bytes` | `mem.VirtualMemory()` | bytes | last (constant) |
| `mem_used_bytes` | `mem.VirtualMemory()` | bytes | avg, min, max |
| `mem_available_bytes` | `mem.VirtualMemory()` | bytes | avg, min, max |
| `mem_cached_bytes` | `mem.VirtualMemory()` | bytes | avg, min, max |
| `mem_buffers_bytes` | `mem.VirtualMemory()` | bytes | avg, min, max |
| `mem_swap_total` | `mem.SwapMemory()` | bytes | last (constant) |
| `mem_swap_used` | `mem.SwapMemory()` | bytes | avg, min, max |
| `mem_swap_percent` | `mem.SwapMemory()` | percent | avg, min, max |
| `mem_page_faults` | process metrics | count/sec | rate, total |
| `mem_page_in` | process metrics | count/sec | rate, total |
| `mem_page_out` | process metrics | count/sec | rate, total |

#### 5.4.3 Network Metrics (Rate + Total)

| Metric Name | Source | Unit | Aggregation |
|-------------|--------|------|-------------|
| `net_send_rate` | delta of `IOCounters()` | bytes/sec | avg, min, max, p95 |
| `net_recv_rate` | delta of `IOCounters()` | bytes/sec | avg, min, max, p95 |
| `net_send_total` | `IOCounters()` cumulative | bytes | max (latest total), delta over period |
| `net_recv_total` | `IOCounters()` cumulative | bytes | max (latest total), delta over period |
| `net_packets_sent_rate` | delta of packets sent | packets/sec | avg, min, max |
| `net_packets_recv_rate` | delta of packets recv | packets/sec | avg, min, max |
| `net_errors_in_rate` | delta of errors in | errors/sec | avg, min, max |
| `net_errors_out_rate` | delta of errors out | errors/sec | avg, min, max |
| `net_drops_in_rate` | delta of drops in | drops/sec | avg, min, max |
| `net_drops_out_rate` | delta of drops out | drops/sec | avg, min, max |
| `net_connections` | `net.Connections()` | count | avg, min, max (per state: LISTEN, ESTABLISHED, etc.) |

#### 5.4.4 Disk Metrics (Rate + Total)

| Metric Name | Source | Unit | Aggregation |
|-------------|--------|------|-------------|
| `disk_read_rate` | delta of `disk.IOCounters()` | bytes/sec | avg, min, max, p95 |
| `disk_write_rate` | delta of `disk.IOCounters()` | bytes/sec | avg, min, max, p95 |
| `disk_read_total` | cumulative | bytes | max, delta over period |
| `disk_write_total` | cumulative | bytes | max, delta over period |
| `disk_iops_read` | delta of read count | ops/sec | avg, min, max |
| `disk_iops_write` | delta of write count | ops/sec | avg, min, max |
| `disk_read_latency` | if available (iostat-style) | ms | avg, min, max |
| `disk_write_latency` | if available (iostat-style) | ms | avg, min, max |
| `disk_queue_depth` | `IOCounters()` weighted I/O | count | avg, min, max |
| `disk_usage_percent` | `disk.Usage()` | percent | avg, min, max (per mount) |
| `disk_used_bytes` | `disk.Usage()` | bytes | avg, min, max (per mount) |
| `disk_free_bytes` | `disk.Usage()` | bytes | avg, min, max (per mount) |
| `disk_inodes_used` | `disk.Usage()` InodesUsed | count | avg, min, max (per mount, Linux) |
| `disk_inodes_free` | `disk.Usage()` InodesFree | count | avg, min, max (per mount, Linux) |
| `disk_inodes_percent` | `disk.Usage()` InodesUsedPercent | percent | avg, min, max (per mount, Linux) |

#### 5.4.5 System Metrics

| Metric Name | Source | Unit | Aggregation |
|-------------|--------|------|-------------|
| `process_count` | `process.Pids()` | count | avg, min, max |
| `thread_count` | system or sum of processes | count | avg, min, max |
| `uptime_seconds` | `host.Uptime()` | seconds | max |
| `running_processes` | process.Pids filtered | count | avg, min, max |
| `system_connections` | net.Connections filtered | count | avg, min, max |

#### 5.4.6 Process-Level Metrics

| Metric Name | Unit | Description |
|-------------|------|-------------|
| `proc_cpu_percent` | percent | Process CPU usage |
| `proc_memory_working_set` | bytes | Working set memory |
| `proc_memory_private` | bytes | Private memory |
| `proc_memory_virtual` | bytes | Virtual memory |
| `proc_memory_peak_ws` | bytes | Peak working set |
| `proc_memory_shared` | bytes | Shared memory (Linux) |
| `proc_net_send_rate` | bytes/sec | Process network send delta |
| `proc_net_recv_rate` | bytes/sec | Process network recv delta |
| `proc_net_send_total` | bytes | Cumulative send |
| `proc_net_recv_total` | bytes | Cumulative recv |
| `proc_disk_read_rate` | bytes/sec | Disk read delta |
| `proc_disk_write_rate` | bytes/sec | Disk write delta |
| `proc_disk_read_total` | bytes | Cumulative disk read |
| `proc_disk_write_total` | bytes | Cumulative disk write |
| `proc_thread_count` | count | Threads |
| `proc_handle_count` | count | Handles (Windows) / FDs (Linux) |
| `proc_open_fds` | count | Open file descriptors (Linux) |
| `proc_io_read_ops` | count | I/O read operations |
| `proc_io_write_ops` | count | I/O write operations |
| `proc_io_read_bytes` | bytes | I/O bytes read |
| `proc_io_write_bytes` | bytes | I/O bytes written |
| `proc_priority` | priority | Process priority |
| `proc_status` | string | Running/Sleeping/Zombie etc. |

### 5.5 Directory Monitoring System

A new subsystem watches filesystem directories and tracks their growth over time. This is orthogonal to process metrics — users can monitor any path regardless of whether a managed service runs there.

#### 5.5.1 Directory Tracking Schema (in `metrics-aggregated.db`)

```sql
-- Configuration: which directories to watch
CREATE TABLE watched_directories (
    id          TEXT PRIMARY KEY,
    path        TEXT NOT NULL UNIQUE,
    label       TEXT,                      -- Human-friendly name for UI
    recursive   BOOLEAN DEFAULT TRUE,      -- Track child dirs
    interval_seconds INTEGER DEFAULT 300,  -- How often to scan (min 60s)
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-scan snapshot of directory state (raw, kept for 7 days)
CREATE TABLE directory_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    watched_dir_id  TEXT NOT NULL,
    path            TEXT NOT NULL,          -- Absolute path of this entry
    is_directory    BOOLEAN NOT NULL,
    parent_path     TEXT,                   -- For child files/dirs
    depth           INTEGER DEFAULT 0,      -- 0 = watched root, 1 = child, etc.
    size_bytes      INTEGER NOT NULL,
    file_count      INTEGER DEFAULT 0,      -- For dirs: number of direct children
    total_files     INTEGER DEFAULT 0,      -- For dirs: recursive file count
    total_dirs      INTEGER DEFAULT 0,      -- For dirs: recursive dir count
    inode_count     INTEGER,                -- If available
    scanned_at      DATETIME NOT NULL,      -- When this scan was performed
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dir_snapshots_watched
    ON directory_snapshots(watched_dir_id, scanned_at);
CREATE INDEX idx_dir_snapshots_path
    ON directory_snapshots(watched_dir_id, path, scanned_at);
```

#### 5.5.2 Directory Metric Buckets

The same aggregation engine creates time-bucketed metrics for each watched directory:

| Metric Name | Unit | Description |
|-------------|------|-------------|
| `dir_size_bytes` | bytes | Total size of directory (recursive) |
| `dir_file_count` | count | Total files (recursive) |
| `dir_dir_count` | count | Total subdirs (recursive) |
| `dir_growth_rate_bytes` | bytes/sec | Rate of size increase (delta from last scan) |
| `dir_growth_rate_files` | files/sec | Rate of file count increase |
| `dir_inode_usage` | percent | Inode usage of the filesystem containing the dir |
| `dir_largest_child_bytes` | bytes | Size of largest direct child |
| `dir_largest_child_name` | string | Name of largest direct child |

For recursive monitoring, the aggregator also stores per-child aggregates so users can drill down into a directory tree.

#### 5.5.3 API for Directory Management

```
GET    /api/metrics/directories                    → list watched dirs + latest stats
POST   /api/metrics/directories                    → add path to watch
PUT    /api/metrics/directories/:id                → update (label, interval, recursive)
DELETE /api/metrics/directories/:id                → stop watching
GET    /api/metrics/directories/:id/tree           → directory tree with latest snapshot
GET    /api/metrics/directories/:id/children       → immediate children summary
GET    /api/metrics/aggregated?scope=directory&entityId=:id  → time-series for dir
```

#### 5.5.4 Directory Collector

A new background worker, `DirectoryMetricsCollector`, runs on a configurable interval (default 5 minutes):

```go
type DirectoryMetricsCollector struct {
    aggDB *gorm.DB
    log   *zap.Logger
}

func (c *DirectoryMetricsCollector) Run(ctx context.Context) {
    ticker := time.NewTicker(60 * time.Second) // Check for due scans every minute
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            var dirs []models.WatchedDirectory
            c.aggDB.Where("enabled = ?", true).Find(&dirs)
            for _, dir := range dirs {
                if time.Since(dir.UpdatedAt).Seconds() >= float64(dir.IntervalSeconds) {
                    c.scanDirectory(dir)
                }
            }
        }
    }
}

func (c *DirectoryMetricsCollector) scanDirectory(wd models.WatchedDirectory) {
    // Walk the directory tree (respecting depth limit and recursive flag)
    // Store snapshot rows in directory_snapshots table
    // Push latest values into the bucket aggregation pipeline for the 5min/1h/1d rollups
}
```

**Performance considerations:**
- Deep directory trees use `filepath.Walk` with a configurable max depth (default: 5)
- Walk is I/O-bound; each scan runs in its own goroutine with a semaphore limit (default: 3 concurrent scans)
- Large trees (>100k files) degrade to best-effort: show size of top-N subdirs and total

### 5.6 Bucket Schema (in `metrics-aggregated.db`)

**Multi-node ready:** the `machine_id` column tags every bucket row to its source node. v1 (single-node) sets this to the local machine's ID. When multi-node arrives, the controller can filter by `machine_id` or aggregate across all nodes for a cluster-level view.

```sql
CREATE TABLE buckets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket_time   DATETIME NOT NULL,           -- Start of the bucket window (aligned to bucket boundary)
    bucket_size   TEXT NOT NULL,               -- '5m', '1h', '1d', '1w'
    scope         TEXT NOT NULL,               -- 'machine', 'node', 'service', 'app', 'multi-app', 'directory', 'cluster'
    entity_id     TEXT,                        -- serviceId / appId / watchedDirId / machineId; NULL for local machine
    machine_id    TEXT,                        -- Node/machine this data was collected from (future multi-node)
    sub_entity    TEXT,                        -- disk mountpoint, network interface name, core index, child dir path
    metric        TEXT NOT NULL,               -- metric name from the catalog above
    sample_count  INTEGER NOT NULL,
    min_value     REAL NOT NULL,
    max_value     REAL NOT NULL,
    avg_value     REAL NOT NULL,
    p95_value     REAL,
    sum_value     REAL,                        -- For cumulative metrics (bytes transferred, etc.)
    last_value    REAL,                        -- The most recent raw value in the bucket
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Primary query index: get a time series for a specific scope/entity/metric
CREATE INDEX idx_buckets_query
    ON buckets(scope, entity_id, metric, bucket_size, bucket_time);

-- Multi-node: filter or aggregate by machine
CREATE INDEX idx_buckets_machine
    ON buckets(machine_id, scope, bucket_size, bucket_time);

-- For sub-entity breakdown (e.g., per-core CPU, per-disk IO)
CREATE INDEX idx_buckets_sub_query
    ON buckets(scope, entity_id, sub_entity, metric, bucket_size, bucket_time);

-- Retention cleanup
CREATE INDEX idx_buckets_retention
    ON buckets(bucket_size, bucket_time);
```

The `sub_entity` column enables per-disk, per-core, per-interface breakdowns without duplicating rows per entity_id.

### 5.7 Retention Policy

| Tier | Bucket Size | Retention | DB | Row Count (est.) |
|------|-------------|-----------|----|-------------------|
| Raw | Per-sample (5s) | 7 days | `logs.db` | ~120,960 |
| Tier 1 | 5 minutes | 30 days | `aggregated.db` | ~8,640 |
| Tier 2 | 1 hour | 365 days | `aggregated.db` | ~8,760 |
| Tier 3 | 1 day | Unlimited | `aggregated.db` | ~365/year |
| Tier 4 | 1 week | Unlimited | `aggregated.db` | ~52/year |
| Dir Snapshots | Per-scan (5m avg) | 7 days | `aggregated.db` | ~2,016/dir |

A background worker runs hourly to:
1. Roll up expired Tier-1 buckets into Tier-2
2. Roll up expired Tier-2 buckets into Tier-3
3. Roll up expired Tier-3 buckets into Tier-4
4. Delete raw rows older than 7 days from `logs.db`
5. Delete directory snapshots older than 7 days from `aggregated.db`

### 5.8 Aggregation Worker

```go
type MetricsAggregator struct {
    rawDB *gorm.DB  // logs.db - reads raw data
    aggDB *gorm.DB  // metrics-aggregated.db - writes buckets
    log   *zap.Logger
}

func (a *MetricsAggregator) Run(ctx context.Context) {
    ticker := time.NewTicker(60 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
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

            // 3. Retention cleanup (once per hour)
            if now.Minute() < 5 {
                a.cleanup(now)
            }
        }
    }
}
```

**App and multi-app scope aggregation:**
```go
func (a *MetricsAggregator) aggregateAppScope(bucketStart, bucketEnd time.Time) {
    // Join process_metrics with services to resolve app membership
    rows := a.rawDB.Table("process_metrics").
        Select("services.app_id as entity_id, process_metrics.*").
        Joins("JOIN services ON services.id = process_metrics.service_id").
        Where("process_metrics.timestamp >= ? AND process_metrics.timestamp < ?", bucketStart, bucketEnd).
        Find(&rows)

    // Group by app_id, compute per-metric aggregates
    // Write to buckets table with scope='app'
}
```

### 5.9 API Endpoints

#### Aggregated Metrics Query

```
GET /api/metrics/aggregated
    ?scope=machine                          # machine | service | app | multi-app | directory
    &entityId=                              # serviceId / appId / watchedDirId
    &entityIds=id1,id2                      # comma-separated for multi-app scope
    &subEntity=/dev/sda1                    # optional: filter to specific disk/core/interface
    &from=2026-06-13T00:00:00Z
    &to=2026-06-14T00:00:00Z
    &bucket=auto                            # auto | 1m | 5m | 15m | 1h | 1d | 1w
    &metrics=cpu_usage_percent,memory_usage_percent   # comma-separated metric names (use actual catalog names)
```

> **DEFERRED to multi-node phase (Phase 4):**
> - `?node=` / `?nodes=` — multi-node filter parameters
> - `?aggregates=min,max,avg,p95,sum` — filter which stats to return (currently always returns all)
> - `scope=node` / `scope=cluster` — additional scope values
>
> In v1 (single-node), the API returns the local node's data. Multi-node parameters will be added when cluster support is implemented.

**Node filtering behavior (v1 — single-node):**

| Scenario | Behavior |
|----------|----------|
| Single-node (v1) | Returns local node's data. No node filter needed. |
| Multi-node (future) | `?node=id1` → filter to that node. `?nodes=id1,id2` → return separate series per node. `?scope=cluster` → aggregate across all nodes |

**Auto bucket selection logic:**

| Time Range | Bucket Size |
|------------|-------------|
| ≤ 1 hour | 1 minute |
| ≤ 6 hours | 5 minutes |
| ≤ 24 hours | 15 minutes |
| ≤ 7 days | 1 hour |
| ≤ 90 days | 1 day |
| > 90 days | 1 week |

**Response:**

```json
{
  "scope": "machine",
  "entityId": null,
  "from": "2026-06-13T00:00:00Z",
  "to": "2026-06-14T00:00:00Z",
  "bucket": "15m",
  "series": {
    "cpu_usage_percent": [
      {
        "timestamp": "2026-06-13T00:00:00Z",
        "count": 180,
        "min": 2.1,
        "max": 78.4,
        "avg": 15.3,
        "p95": 65.2,
        "sum": 2754.0,
        "last": 18.7
      }
    ],
    "memory_usage_percent": [ ... ],
    "network_send_rate": [ ... ],
    "network_receive_rate": [ ... ],
    "network_bytes_sent": [ ... ],
    "network_bytes_received": [ ... ],
    "dir_size_bytes": [ ... ]
  },
  "summary": {
    "cpu_usage_percent":      { "min": 0.5, "max": 92.1, "avg": 18.7, "p95": 71.3, "sum": 33660.0 },
    "memory_usage_percent": { "min": 42.0, "max": 85.3, "avg": 67.2, "p95": 82.1, "sum": 120960.0 },
    ...
  }
}
```

#### Available Metrics Catalog

```
GET /api/metrics/catalog
```

Returns the full list of supported metrics, their units, available scopes, and whether they have sub-entities:

```json
{
  "metrics": [
    {
      "name": "cpu_usage_percent",
      "unit": "percent",
      "scopes": ["machine"],
      "hasSubEntities": false,
      "description": "CPU usage percentage"
    },
    {
      "name": "cpu_load_1m",
      "unit": "load",
      "scopes": ["machine"],
      "hasSubEntities": false,
      "description": "System load average (1 minute)"
    },
    {
      "name": "network_send_rate",
      "unit": "bytes/sec",
      "scopes": ["machine", "service", "app"],
      "hasSubEntities": true,
      "subEntityLabel": "interface",
      "description": "Network send rate"
    },
    {
      "name": "network_bytes_sent",
      "unit": "bytes",
      "scopes": ["machine", "service", "app"],
      "hasSubEntities": true,
      "subEntityLabel": "interface",
      "description": "Cumulative network bytes sent"
    },
    {
      "name": "dir_size_bytes",
      "unit": "bytes",
      "scopes": ["directory"],
      "hasSubEntities": true,
      "subEntityLabel": "child path",
      "description": "Directory total size"
    },
    {
      "name": "disk_usage_percent",
      "unit": "percent",
      "scopes": ["machine"],
      "hasSubEntities": true,
      "subEntityLabel": "mount point",
      "description": "Disk usage percentage per mount"
    },
    ...
  ]
}
```

#### Scope Resolution

| Scope | entity_id | Sub-entities | Aggregation Logic | Multi-Node Plan |
|-------|-----------|--------------|-------------------|-----------------|
| `machine` | NULL or machineId | disk mount, net interface, cpu core | Direct from system_metrics aggregates | Each node has own `machine_id`; `?node=` filter selects which node's data |
| `node` | machineId | disk mount, net interface, cpu core | Same as machine but explicitly filtered by `machine_id` | Always scoped to one node |
| `cluster` | NULL | per-node breakdown | SUM/AVG across all matching `machine_id` values | Controller fans out to all agents, merges results |
| `service` | serviceId | process-level breakdown | Direct from process_metrics WHERE service_id = ? | Each node only knows its own services; controller resolves cross-node |
| `app` | appId | per-service breakdown inside the app | SUM/AVG of all services WHERE app_id = ? | Services may span nodes; controller queries each node and merges |
| `multi-app` | comma-separated appIds | per-app breakdown | SUM/AVG across all services of listed apps | Same as app but over multiple app IDs |
| `directory` | watchedDirId | child paths | From directory_snapshots, aggregated by path | Directories are node-local; no cross-node aggregation |

---

## 6. UI Design

### 6.1 Monitor Page Redesign

The current `/monitor` page (TaskManager) gains a new **"History"** tab alongside the existing live tabs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  System Monitor                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Processes] [Performance] [Disks] [Network] [History]                       │
│                                                                             │
│  ┌─ Scope ───────────────┐ ┌─ Time Range ─────┐ ┌─ Bucket ────┐          │
│  │ ○ Machine             │ │ [24h ▼]           │ │ [Auto ▼]   │          │
│  │ ○ Service: [select...]│ │ 1h 6h 24h 7d 30d  │ │ 1m 5m 1h   │          │
│  │ ○ App: [select...]    │ │ 90d Custom         │ │ 1d 1w      │          │
│  │ ○ Multi-App: [select] │ └────────────────────┘ └────────────┘          │
│  │ ○ Directory: [select] │                                                │
│  │   └── [Manage Dirs]   │                                                │
│  └───────────────────────┘                                                │
│                                                                             │
│  ┌─ Metric Families ────────────────────────────────────────────────────┐  │
│  │ ☑ CPU    ☑ Memory    ☐ Network    ☐ Disk    ☐ Directory    ☐ System  │  │
│  │  ┌─ Sub-metrics ─────────────────────┐                               │  │
│  │  │ ☑ cpu_percent  ☐ cpu_load_1m     │                               │  │
│  │  │ ☐ cpu_load_5m  ☐ cpu_load_15m    │                               │  │
│  │  │ ☐ context_switches                │                               │  │
│  │  │ [Show per-core breakdown: ☐]     │                               │  │
│  │  └────────────────────────────────────┘                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ CPU Usage (%) ─────────────────────────────────────────────────────┐  │
│  │  80 ┤          ╱╲                                                   │  │
│  │  60 ┤    ╱╲  ╱    ╲    ╱╲                                          │  │
│  │  40 ┤  ╱    ╱       ╲╱    ╲────── avg (solid line)                 │  │
│  │  20 ┤╱                  ▓▓▓▓▓▓▓ min/max band (shaded)              │  │
│  │   0 ┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──                       │  │
│  │      00 02 04 06 08 10 12 14 16 18 20 22 24                        │  │
│  │                          Time (UTC+3)                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Stats for visible range ────────────────────────────────────────────┐  │
│  │  Current: 18.3%  │  Avg: 15.2%  │  Min: 2.1%  │  Max: 78.4%        │  │
│  │  P95: 65.2%      │  Total: n/a  │  Samples: 96                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Memory Usage (%) ──────────────────────────────────────────────────┐  │
│  │  (same chart structure, with optional swap overlay)                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Network (rate) ────────────────────────────────────────────────────┐  │
│  │  send ────  recv - - -  (two lines, colors)                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Network (cumulative) ──────────────────────────────────────────────┐  │
│  │  Total sent: 1.2 GB    Total recv: 3.8 GB  (stepped area chart)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Scope Selector Behavior

| Scope | UI Behavior | Default Metrics |
|-------|-------------|-----------------|
| **Machine** | Default. No entity picker. Shows system-wide metrics. | CPU, memory, network, disk, processes |
| **Service** | Dropdown lists all services (searchable). Shows process-level metrics. | proc_cpu, proc_memory, proc_net, proc_disk |
| **App** | Dropdown lists all apps. Aggregates all services belonging to the app. | Same as service but summed across services |
| **Multi-App** | Multi-select checkbox list with "Select All" / "Clear". | Cross-app aggregates |
| **Directory** | Dropdown of watched directories. "Manage Dirs" link opens directory manager. | dir_size, dir_file_count, dir_growth_rate |

### 6.3 Time Range Selector

Preset buttons plus custom date-range picker:

| Preset | from → to | Auto Bucket | Data Points |
|--------|-----------|-------------|-------------|
| 1h | now - 1 hour | 1 min | ~60 |
| 6h | now - 6 hours | 5 min | ~72 |
| 24h | now - 24 hours | 15 min | ~96 |
| 7d | now - 7 days | 1 hour | ~168 |
| 30d | now - 30 days | 1 day | ~30 |
| 90d | now - 90 days | 1 day | ~90 |
| Custom | user-selected | auto based on span | varies |

### 6.4 Chart Visualization

Each chart renders:
- **Average line** (solid, primary color)
- **Min/Max band** (shaded area between min and max, 20% opacity)
- **P95 line** (dashed, secondary color, toggleable)
- **X-axis**: actual timestamps formatted based on bucket size (HH:MM for ≤24h, Mon DD for >24h)
- **Y-axis**: metric value with unit (auto-scaled)
- **Tooltip on hover**: shows timestamp, min, avg, max, p95, sample count, sum (if applicable)
- **Legend**: clickable to toggle individual lines on/off
- **Zoom**: drag-to-zoom on the chart re-queries the API for the selected sub-range

### 6.5 Comparison Mode

Users can overlay two time ranges on the same chart (e.g., "today vs last week"):
- Toggle switch "Compare"
- Select comparison time range (presets: previous day, previous week, previous month, or custom)
- Primary line rendered in solid color, comparison in muted/dashed
- Stats panel shows both periods side-by-side

### 6.6 Sub-Entity Breakdown

When a metric supports sub-entities (per-core CPU, per-disk IO, per-interface network, per-child directory):
- A toggle "Show breakdown" reveals a stacked area chart or small multiples
- Users can select specific sub-entities to highlight
- Example: CPU chart switches from aggregate to per-core lines

### 6.7 Directory Manager

A sub-page or modal for managing watched directories:

```
┌─ Monitored Directories ──────────────────────────────────────────┐
│                                                                   │
│  [+ Add Directory]                                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Path            │ Label      │ Recursive │ Size    │ ... │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ /var/log        │ App Logs   │ ✓         │ 2.3 GB  │ ... │    │
│  │ /data/uploads   │ Uploads    │ ✓         │ 45.1 GB │ ... │    │
│  │ /tmp/builds     │ Build Cache│ ✗         │ 128 MB  │ ... │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [View History for /var/log] → navigates to History tab with     │
│   scope=directory & entityId=<id> pre-selected                   │
└───────────────────────────────────────────────────────────────────┘
```

### 6.8 Export

- **CSV export**: download visible range as CSV with columns: timestamp, metric, min, avg, max, p95, count, sum
- **JSON export**: download raw aggregated API response
- **PNG export**: deferred to future release (not in v1)

---

## 7. Acceptance Criteria

### 7.1 Network Fix
- [ ] `NetworkInterfaceInfo` exposes both cumulative totals (BytesSentTotal, BytesRecvTotal) AND rates (SendRate, ReceiveRate)
- [ ] Rates are computed as delta / elapsed_seconds between consecutive samples
- [ ] Counter resets (reboot, interface flap) produce 0 rate, not negative values
- [ ] `TotalNetworkSendRate` and `TotalNetworkReceiveRate` in system snapshot are correct rates
- [ ] Network packets, errors, and drops are collected and aggregated

### 7.2 Metrics Expansion
- [ ] CPU per-core percent collected and available as sub-entity breakdown
- [ ] CPU load averages (1m, 5m, 15m) collected
- [ ] Memory breakdown (total, used, available, cached, buffers, swap) collected
- [ ] Network per-interface breakdown with packets/errors/drops collected
- [ ] Disk IOPS (reads/sec, writes/sec) collected
- [ ] Disk latency and queue depth collected where available
- [ ] Disk per-mount inode usage collected on Linux
- [ ] Process-level I/O operations (read ops, write ops) collected
- [ ] Process-level network totals (cumulative + rate) collected

### 7.3 Directory Monitoring
- [ ] `watched_directories` table created and CRUD API works
- [ ] Directory scanner walks path and stores snapshots
- [ ] Recursive tracking works (children tracked with parent_path and depth)
- [ ] Directory snapshot data feeds into the bucket aggregation pipeline
- [ ] Aggregate metrics for directories (size, file count, growth rate) queryable via `/api/metrics/aggregated`
- [ ] Large directory trees (>100k files) handled gracefully (depth limits, semaphore)
- [ ] Walk interval is configurable per directory (min 60s)

### 7.4 Separate Aggregation Database
- [ ] `metrics-aggregated.db` created and initialized with `buckets` and `watched_directories` tables
- [ ] Aggregation worker connects to both `logs.db` (read-only for raw) and `aggregated.db` (write for buckets)
- [ ] No aggregation queries hit `logs.db`
- [ ] Write contention between raw metrics collection and aggregation is eliminated
- [ ] Backup/restore of `aggregated.db` is independent from `logs.db`

### 7.5 Aggregation Backend
- [ ] `buckets` table created with proper schema and indexes
- [ ] Background worker aggregates 5-minute buckets every minute
- [ ] Hourly rollup from 5m → 1h runs at hour boundaries
- [ ] Daily rollup from 1h → 1d runs at midnight
- [ ] Weekly rollup from 1d → 1w runs on Monday 00:00
- [ ] Raw rows older than 7 days are deleted from `logs.db` by retention worker
- [ ] Directory snapshots older than 7 days are deleted
- [ ] P95 is computed using nearest-rank method on raw samples within each bucket
- [ ] Sum (for cumulative/counter metrics) is correctly propagated through rollup tiers

### 7.6 API
- [ ] `GET /api/metrics/aggregated` returns correct aggregated data for all scope types
- [ ] `?bucket=auto` selects appropriate bucket size based on time range
- [ ] `GET /api/metrics/catalog` returns the full expanded metrics list
- [ ] `?subEntity=` filter works (e.g., filter to single disk or core)
- [ ] App-scope queries correctly join services and aggregate
- [ ] Multi-app queries aggregate across all selected apps
- [ ] Directory-scope queries return aggregate time-series for watched paths
- [ ] Response includes both per-bucket series and overall summary
- [ ] Directory CRUD API (list, add, update, delete, tree, children) works

### 7.7 UI
- [ ] Monitor page has a "History" tab
- [ ] Time range selector works with presets and custom range
- [ ] Bucket size selector allows manual override of auto selection
- [ ] Scope selector switches between machine/service/app/multi-app/directory
- [ ] Metric picker expands/collapses to show sub-metrics per family
- [ ] Charts render avg line + min/max band + optional p95
- [ ] X-axis shows actual timestamps with timezone-aware formatting
- [ ] Stats panel shows current/avg/min/max/p95 for visible range
- [ ] Sub-entity breakdown toggle works (e.g., per-core CPU)
- [ ] Comparison mode overlays two time ranges
- [ ] Directory manager page/list accessible from scope selector
- [ ] CSV, PNG, and JSON export work correctly
- [ ] Charts are responsive and work on mobile viewports

### 7.8 Performance
- [ ] Aggregated query for 30 days at 1h buckets returns in < 200ms
- [ ] Aggregated query for 1 year at 1d buckets returns in < 500ms
- [ ] Raw data cleanup does not block other database operations
- [ ] Aggregation worker completes within its tick interval under normal load
- [ ] Directory scan for 10k files completes in < 2 seconds
- [ ] Metrics collection tick (5s) is never blocked by aggregation queries

---

## 8. Implementation Phases

### Phase 1: Network Fix + Schema + Separate DB (1 week)
1. Fix network rate computation in `metrics_collector.go` — both totals and rates
2. Add expanded metric fields to `SystemMetrics` and `ProcessMetrics` models
3. Create and initialize `metrics-aggregated.db` with `buckets` table
4. Add GORM model for `buckets`
5. Add `MetricsAggregator` worker skeleton connecting to both databases
6. Unit tests for network delta computation

### Phase 2: Metrics Expansion + Directory Monitoring (1.5 weeks)
1. Add per-core CPU, load averages, memory breakdown to collector
2. Add network packets/errors/drops per interface
3. Add disk IOPS, latency (where available), inode usage
4. Add process I/O operations and network totals
5. Implement `DirectoryMetricsCollector` background worker
6. Implement directory snapshot model and storage
7. Implement directory CRUD API
8. Unit tests for new metrics and directory scanner

### Phase 3: Aggregation Engine (1.5 weeks)
1. Implement 5-minute bucket aggregation from raw rows (all metrics)
2. Implement cascading rollups (5m → 1h → 1d → 1w)
3. Implement retention cleanup worker (both databases)
4. Handle per-sub-entity breakdown in aggregates (sub_entity column)
5. Handle cumulative metrics (sum_value propagation through rollups)
6. Add unit tests for aggregation math and rollups

### Phase 4: API Layer (1 week)
1. Implement `GET /api/metrics/aggregated` with scope/bucket/range/sub-entity params
2. Implement `GET /api/metrics/catalog`
3. Implement auto-bucket selection logic
4. Implement app and multi-app scope resolution (join with services)
5. Implement directory-scope querying
6. Add integration tests

### Phase 5: UI – History Tab + Directory Manager (2 weeks)
1. Add "History" tab to TaskManager with routing
2. Build scope selector component (machine/service/app/multi-app/directory)
3. Build time range selector component (presets + custom date picker)
4. Build metric family picker with sub-metric expansion
5. Build TimeSeriesChart component (avg line + min/max band + p95)
6. Add sub-entity breakdown toggle and visualization
7. Add stats panel
8. Add comparison mode
9. Build directory manager page/modal
10. Add CSV/PNG/JSON export
11. E2E tests for chart rendering and directory management

### Phase 6: Polish + Performance (0.5 week)
1. Performance benchmarking for aggregation queries
2. Chrome DevTools performance audit for chart rendering
3. Accessibility audit (keyboard nav, ARIA labels, screen reader support)
4. Documentation update

---

## 9. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Spec 027 (Operations Cockpit) | 📋 Spec Ready | This spec assumes `/monitor` route from 027 |
| Spec 013 (Analytics) | 📋 Spec Ready | This spec provides the foundation for 013's resource analytics |
| Spec 022 (OTLP Telemetry) | 📋 Spec Ready | Future: OTLP can feed into the same bucket schema |
| Existing `SystemMetrics` table | ✅ Implemented | Raw data source; will need migration for new fields |
| Existing `ProcessMetrics` table | ✅ Implemented | Raw data source; may need migration for I/O metrics |
| Recharts | ✅ Already installed (`recharts@3.7.0`) | Already used in `home.tsx` dashboard charts. `AreaChart` + `ReferenceArea` for min/max bands, `Line` for avg/p95 |
| `gopsutil` | Already used | Already imported; just adding more metric calls |

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite write contention during aggregation | Aggregation worker blocks live metric writes | **Separate DB solves this** — aggregation writes to `aggregated.db`, raw collection writes to `logs.db` with WAL mode |
| Directory scan on large trees blocks collection | UI delay or missed metric ticks | Goroutine per scan with semaphore (max 3 concurrent); timeout after 30s; skip scan if previous still running |
| Disk IOPS/latency not available on all platforms | Inconsistent data across OS | Fall back gracefully: store null for unavailable metrics; catalog endpoint indicates platform support |
| Per-core CPU multiplies bucket rows by core count | 16x more bucket rows on 16-core machine | Use `sub_entity` column — single row per bucket per metric per core |
| App membership changes invalidate historical app-scope buckets | Incorrect historical aggregates | Re-aggregate affected buckets on service.app_id change; store the time range of validity per bucket |
| Network counter reset on reboot | Negative rate spike | Guard: `if current < previous, rate = 0` |
| Chart library bundle size | Slower initial page load | Lazy-load chart library only when History tab is opened |
| Directory scan I/O on busy production paths | Filesystem contention | Warn in UI when scanning paths with heavy I/O; user can disable/change interval |

---

## 11. Open Questions

1. **P95 for rolled-up buckets**: Should we store p95 at each tier (computable from raw samples), or only compute it from raw data (limiting p95 to 7-day window)?
   - Current recommendation: store p95 at each tier by computing it from raw samples within each bucket at the time of creation. The rollup cascades p95 by taking the weighted average of p95 values from child buckets — this is an approximation but acceptable for monitoring.

2. **Per-disk and per-interface breakdown in UI**: Should each disk/interface be a separate configurable chart, or should they be stacked in one chart with a selector?
   - Recommended: stacked in one chart with a selector toggle for "Show breakdown."

3. **Timezone handling**: Should bucket boundaries align with UTC or local time?
   - Recommended: Store in UTC, display in user's browser timezone. Bucket boundaries are UTC-aligned for consistency.

4. **Multi-node**: When cluster agents report metrics, should each node be aggregated separately, or combined into a cluster-wide overview?
   - Recommended: Both. Each node retains its own scope; a `cluster` scope aggregates across all known nodes.

5. **Directory depth limit**: What should the default max depth be for recursive directory scanning?
   - Recommended: 5 levels deep by default, configurable per watched directory up to 20.

6. **Network cumulative totals in UI**: Should the cumulative total chart show total-over-time (stepped area) or just current total as a number?
   - Recommended: Delta-over-period (as a bar chart: "bytes transferred in this time window") with a total-over-time stepped area chart as an option.

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Bucket** | A fixed time window (e.g., 5 minutes) over which raw samples are aggregated |
| **Rollup** | The process of aggregating smaller buckets into larger ones (5m → 1h → 1d → 1w) |
| **Scope** | The entity being monitored: machine, service, app, multi-app, or directory |
| **Sub-entity** | A sub-division of a scope (e.g., a specific disk mount, CPU core, network interface, or child directory) |
| **Retention** | The policy that determines how long data at each tier is kept before cleanup |
| **P95** | 95th percentile — the value below which 95% of samples fall |
| **Rate** | A per-second value derived from cumulative counters via delta computation |
| **Total** | A cumulative counter value (e.g., total bytes sent since boot) |
| **Delta** | The difference between two cumulative readings (e.g., bytes transferred in a 5-min window) |
| **Watched Directory** | A filesystem path registered for directory-level monitoring |
