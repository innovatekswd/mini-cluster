# 029 — API Design & Data Model

> Companion to [spec.md](./spec.md). Builds on the existing metrics store; **no new storage engine**.

---

## 1. Data Model

### 1.1 `monitor_targets` (new)
Generalizes `watched_directories`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (uuid) | PK |
| `type` | text | `machine`/`app`/`service`/`process`/`file`/`directory`/`systemd-service`/`windows-service`/`container`/`port` |
| `entity_id` | text | type-specific identifier (path, pid-hash, unit name, container id, app id…) |
| `label` | text | user-facing name |
| `enabled` | bool | gates collection, not history |
| `interval_seconds` | int | sample cadence |
| `config` | json | type-specific (e.g. `{recursive:true}` for dir, `{exePath, matchBy}` for process, `{engine:"docker"}` for container) |
| `tags` | text[]/json | for filtering/grouping |
| `created_at` / `updated_at` | timestamp | |

> Migration: `watched_directories` rows are projected as `type="directory"` targets (view or backfill); the directory collector keeps writing the same `dir_*` metrics.

### 1.2 `metric_buckets` (existing — unchanged)
`(scope, entity_id, sub_entity, metric, bucket_size, bucket_time, count, min, max, avg, p95, sum, last)`.
- For a target, `scope` = target `type` (or a normalizing map), `entity_id` = target `entity_id`.
- **No schema change required** — universal monitoring is collector + registry work, the store already supports it.

### 1.3 `saved_queries` (new)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | |
| `targets` | json | array of target ids |
| `metrics` | json | metric names / families |
| `mql` | text | optional raw MQL |
| `range` / `bucket` | text | explorer state |
| `pinned_widget` | bool | surfaced in cockpit |

---

## 2. Endpoints

### 2.1 Monitor Targets
```
GET    /api/monitors                 # list (filter: ?type=&tag=&enabled=)
POST   /api/monitors                 # create  { type, entityId, label, intervalSeconds, config, tags }
GET    /api/monitors/{id}
PATCH  /api/monitors/{id}            # update label/enabled/interval/config/tags
DELETE /api/monitors/{id}            # ?keepHistory=true|false
POST   /api/monitors/{id}/enable
POST   /api/monitors/{id}/disable
```

**Discovery helper** (prefill the Monitor dialog from a UI entity):
```
POST   /api/monitors/resolve         # { type, hint } -> { entityId, suggestedLabel, suggestedMetrics, defaultInterval }
```

### 2.2 Metrics (existing, extended)
The aggregated endpoint already filters by `scope` + `entityId`/`entityIds`. Extensions:
```
GET /api/metrics/aggregated
    ?scope=&entityId=|entityIds=&from=&to=&bucket=&metrics=&subEntity=
    # NEW: &targets=<id,id,...>   (server resolves targets -> (scope,entityId) tuples)
```
- `targets` is the new multi-entity overlay input; it expands to the existing `(scope, entity_id)` filters and returns one series per `target × metric`.
- Response `series` keys become `"<targetId>::<metric>"` when `targets` is used (so the chart can label per target).

### 2.3 Grid data source (server-side)
Feeds `@hivemind/grid` `GridRestSource`:
```
GET /api/metrics/grid
    ?shape=time|catalog
    &targets=&metrics=&from=&to=&bucket=
    &page=&pageSize=&sort=&filter=    # grid query params (GridQueryParams)
->  { rows, total, page, pageSize }   # GridSourceResult shape
```
- `shape=time` → rows = buckets, columns = `target×metric`.
- `shape=catalog` → rows = targets, columns = current/avg/peak per metric (top-consumers).

### 2.4 MQL
```
POST /api/metrics/query              # { mql, from, to, bucket } -> AggregatedResponse-like
GET  /api/metrics/query/labels       # available labels (scope, entity_id, sub_entity, metric)
GET  /api/metrics/query/values?label=entity_id   # autocomplete values
```

### 2.5 Saved Queries
```
GET/POST/PATCH/DELETE /api/saved-queries
POST /api/saved-queries/{id}/pin      # toggle cockpit widget
```

---

## 3. Collector Architecture

A **collector registry**: each target `type` registers a sampler implementing:
```
type Collector interface {
    Type() string
    Sample(ctx, target MonitorTarget) ([]MetricSample, error)  // -> writes MetricBucket rows
    Resolve(hint string) (ResolveResult, error)                // for /resolve prefill
}
```
- Existing system/process/directory samplers are wrapped as collectors.
- New collectors: `file`, `process` (by exe path), `systemd`, `windows-service`, `container` (docker/podman).
- A scheduler ticks each enabled target at its `interval_seconds`, writes raw → roll-up follows the existing aggregation pipeline (5m/1h/1d/1w buckets).

---

## 4. Backwards Compatibility
- `/api/metrics/aggregated` without `targets` behaves exactly as today.
- `watched_directories` endpoints remain (alias over `monitor_targets` where `type="directory"`), so [`DirectoryManager.tsx`](../../../ui/app/components/DirectoryManager.tsx) keeps working during migration.
- Existing History tab works unchanged; multi-target & grid are additive.

---

## 5. Frontend Touch Points
| File | Change |
|------|--------|
| [`HistoryTab.tsx`](../../../ui/app/components/HistoryTab.tsx) | accept `targets[]`; Chart/Grid mode toggle; multi-series overlay |
| [`inspect.analytics.tsx`](../../../ui/app/routes/inspect.analytics.tsx) | replace placeholder with saved-queries + MQL explorer |
| [`DirectoryManager.tsx`](../../../ui/app/components/DirectoryManager.tsx) | generalize → `MonitorManager` (all target types) |
| [`metricsService.ts`](../../../ui/app/services/metricsService.ts) | add `monitorsService`, `targets` param, grid + MQL calls |
| Row/card `⋮` menus (Apps, Services, Processes, Containers, Explorer) | add **Monitor** action |
| new `MonitorTargetPicker`, `MonitorDialog` | reusable |
| `@hivemind/grid` | add as dependency in `ui/package.json` |
