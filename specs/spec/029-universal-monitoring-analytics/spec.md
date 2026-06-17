# Feature 029: Universal Monitoring & Analytics

> **Status:** 📋 Spec Draft
> **Phase:** 8 - Intelligence
> **Priority:** 🟡 HIGH
> **Estimated Effort:** ~6 weeks
> **Author:** y.wadea
> **Date:** 2026-06-17
> **Related:** [013-analytics-decision-support](../013-analytics-decision-support/spec.md), [028-performance-monitoring](../028-performance-monitoring/spec.md), [022-otlp-telemetry](../022-otlp-telemetry/spec.md), [027-operations-cockpit-ux-realtime](../027-operations-cockpit-ux-realtime/spec.md)

---

## Overview

Today, analytics live inside the **History tab** ([`HistoryTab.tsx`](../../../ui/app/components/HistoryTab.tsx)), which already supports scopes (`machine`, `service`, `app`, `multi-app`, `directory`), a metric catalog, time ranges, buckets, and comparison. Monitoring of *user-chosen* targets is limited to `WatchedDirectory` ([`DirectoryManager.tsx`](../../../ui/app/components/DirectoryManager.tsx)).

This feature **generalizes "monitor a directory" into "monitor anything"**: from any surface in the product (Apps, Inspect, File Explorer, Processes, Services, Containers) the user picks an entity — a file, a directory, a process, an app, a managed service, a `systemd`/Windows service, a Docker/Podman container, or the whole machine — via a **"Monitor this" action** (typically the triple-dot `⋮` menu). The target is **persisted** as a first-class **Monitor Target** and becomes retrievable everywhere (Apps, Inspect, a dedicated Monitors list).

Once monitored, the user can **explore it two ways from the same screen**:
1. **Diagrams** — overlay *multiple entities* on the same chart (compare app A vs app B vs machine).
2. **Grids** — the existing HiveMind data grid (`@hivemind/grid`, `GridRoot`) with its built-in filtering, sorting, and search, fed by the metric/event time series.

It also answers the open question: **yes, we adopt a query language** for the grid/diagram explorer — a **PromQL-/LogQL-inspired subset** (see [§7](#7-query-language-mql)), translated server-side to the existing `MetricBucket` store rather than running an embedded Prometheus/Loki.

---

## Business Value

| Problem | Solution |
|---------|----------|
| Monitoring is hard-wired to a few scopes; you can't just "watch this `.exe`" or "watch this folder" ad-hoc | Universal **Monitor Target** model + a "Monitor this" action on every entity |
| Analytics is buried in one History tab and not reachable from where the entity lives | Targets are persisted and surfaced in Apps, Inspect, and a Monitors list; deep-linkable |
| Can't compare multiple entities on one chart | Multi-entity overlay in both diagrams and grids |
| No structured, reusable way to ask questions about metrics | **MQL** query language with saved queries |
| Grids and charts are separate, hand-built per metric | One explorer drives both the HiveMind grid and the chart view from the same query |

### Target Users
- **Operators** — "watch this process/container and tell me when it leaks."
- **Developers** — "compare CPU of my app across two versions on one chart."
- **Power users** — "write a query once, save it, pin it as a widget."

### Success Metrics
- Any entity in the UI can be put under monitoring in ≤ 2 clicks.
- A monitored target's history is reachable from ≥ 3 surfaces (Apps, Inspect, Monitors list).
- A single chart/grid can overlay ≥ 5 entities.
- Saved MQL queries can back a cockpit widget without code changes.

---

## Scope of "Anything" (Monitorable Entity Types)

| Type | Identifier (`entity_id`) | Collector source | Platforms |
|------|--------------------------|------------------|-----------|
| `machine` | `local` / node id | existing system metrics | all |
| `app` | app id | existing process metrics | all |
| `service` | managed service id | existing process metrics | all |
| `process` | pid + start-time hash (or exe path) | process sampler | all |
| `file` | absolute path | stat sampler (size, mtime, exists, hash opt.) | all |
| `directory` | path (existing `WatchedDirectory`) | directory sampler | all |
| `systemd-service` | unit name | `systemctl show`/`systemd` D-Bus | Linux |
| `windows-service` | service name | SCM / WMI | Windows |
| `container` | container id/name | Docker/Podman stats API | all (where engine present) |
| `port`/`endpoint` *(stretch)* | host:port or URL | TCP connect / HTTP probe | all |

> **Design rule:** every type maps onto the **same** `(scope, entity_id, sub_entity, metric)` shape already used by `MetricBucket`. New types add a *collector* and a *catalog contribution*, not a new storage model.

---

## Key Features

### 1. Universal "Monitor This" Action
- A reusable `⋮` action / context-menu item **"Monitor"** available on rows and cards across: Apps, Services, Processes, Containers, File Explorer (files + directories), and the machine/overview.
- Opens a lightweight **Monitor dialog** prefilled from the entity (type, identifier, suggested label, default sample interval, suggested metric families).
- On confirm → creates a **Monitor Target** (persisted) and starts collection.
- Generalizes the existing directory flow; `WatchedDirectory` becomes one target type, not a separate subsystem.

### 2. Monitor Target Registry (persisted)
- A target is `{ id, type, entity_id, label, enabled, interval_seconds, config(json), tags[], created_at }`.
- CRUD API + a **Monitors** management view (generalized `DirectoryManager`).
- Targets are **discoverable** by type/tag and **deep-linkable** (`/inspect/history?targets=<id>,<id>`).
- Enabling/disabling controls collection without deleting history.

### 3. Multi-Entity Diagrams
- The History/Analytics explorer accepts **a set of targets** (not a single `entityId`).
- Each metric chart overlays one series **per target** (color-coded, legend, toggle).
- Keeps existing features: time range, bucket, comparison (vs previous period), CSV/JSON export.
- Mixed-scope overlay allowed where the metric exists for each target (e.g. `cpu_usage_percent` for an app and the machine).

### 4. HiveMind Grid View
- A **Grid mode** toggle next to **Chart mode** in the explorer.
- Backed by `@hivemind/grid` `GridRoot` with a **server-side `GridDataSource`** (REST) so filtering/sorting/search/pagination run against the API.
- Two grid shapes:
  - **Wide/time grid:** rows = time buckets, columns = `target × metric` (good for export/inspection).
  - **Catalog grid:** rows = targets, columns = current/avg/peak per metric (good for "top consumers").
- Reuses the grid's built-in column filters, sort, and quick-search — no bespoke filtering UI.

### 5. Saved Queries & Widgets
- Save an explorer state (targets + metrics + range + bucket + MQL) as a **named query**.
- Saved queries appear in `inspect.analytics` (currently a placeholder, [`inspect.analytics.tsx`](../../../ui/app/routes/inspect.analytics.tsx)) and can be **pinned as a cockpit widget**.

### 6. Surfacing & Retrieval
- From **Apps/Services**: an entity that is monitored shows a small "monitored" affordance + a "View analytics" link that deep-links the explorer scoped to its target.
- From **Inspect**: the Monitors list + "Add monitor" entry point.
- From **File Explorer**: "Monitor this file/folder" on the `⋮` menu.

### 7. Query Language (MQL) — **deferred to Phase 2**
See [§7 below](#7-query-language-mql). MQL is a **convenience layer over the v1 backend**, not a prerequisite. **v1 ships without it**: the chip selectors + `targets[]` cover ~95% of use, and saved queries are stored as **structured JSON** (not strings) so MQL can be added later as an *alternate input* that compiles to the same JSON — no rework. See [§9 Phasing](#9-phasing).

### 8. Explorer & Processes Enrichment
Make the two surfaces where users most often "find a thing to monitor" first-class data views. See the dedicated [explorer-processes.md](./explorer-processes.md):
- **Explorer:** recursive **folder sizes** (computed, cached), a **Disk Usage Analyzer** (treemap + largest/oldest files + by-type breakdown + growth-over-time trend — the WinDirStat/TreeSize genre, with history as the differentiator; duplicate detection deferred), **advanced search** (by name/glob/regex, content, size range, date range, type), and a **"Monitor" action** in the context menu.
- **Processes:** move the hand-built table onto the HiveMind grid (filter/sort/search/group), add a **"Monitor" action**, and link a process row straight into the analytics explorer.

### 9. Phasing
| Phase | Contents | MQL? |
|-------|----------|------|
| **P1 (core)** | Monitor Target registry + "Monitor this" action; multi-entity overlay; grid view; saved queries as **JSON**; Explorer folder-size + advanced search; Processes grid | ❌ no |
| **P2 (power)** | MQL parser/compiler + `/api/metrics/query`; "Show query" reveal/edit; MQL-backed widgets | ✅ yes |

---

## 7. Query Language (MQL)

**Decision:** Yes — introduce a small, typed query language, but **do not embed Prometheus or Loki**. The existing `MetricBucket` store (`scope, entity_id, sub_entity, metric, bucket_size, bucket_time, min/avg/max/p95/sum`) is already a pre-aggregated TSDB; MQL is parsed and compiled to GORM queries against it.

### Why not literally Prometheus/Loki?
| Option | Verdict |
|--------|---------|
| Embed Prometheus + remote-write | ❌ Heavy runtime, second storage engine, ops burden on edge nodes |
| Embed Loki for logs | ⚠️ Defer — relevant to log search (see [log-architecture-redesign](../../../plans/log-architecture-redesign.md)), not metrics |
| **MQL → translate to existing store** | ✅ Familiar syntax, zero new infra, reuses pre-aggregation |

### MQL shape (subset)
```
metric_selector{label="value", ...}[range] | aggregation by (labels)
```
- **Selector:** `cpu_usage_percent{scope="app", entity_id="my-api"}`
- **Range/step:** inherited from the explorer's time range + bucket (no `[5m]` needed for v1, but accepted).
- **Aggregations:** `avg`, `max`, `min`, `sum`, `p95`, `rate()` (for counters) — mapped to bucket columns.
- **Grouping:** `by (entity_id)` / `by (sub_entity)`.
- **Multi-target overlay** is `... by (entity_id)` over a selector that matches several targets.

Labels available = the `MetricBucket` dimensions (`scope`, `entity_id`, `sub_entity`, `metric`). The UI builds MQL from the chip selectors; advanced users can type it. **LogQL-style** log queries are explicitly **out of scope for v1** and tracked separately under the log redesign.

---

## User Flows

### Flow A — Monitor an executable from File Explorer
1. User right-clicks `app.exe` → **Monitor**.
2. Dialog: type = `file`/`process`, label = "app.exe", interval = 15s, families = process (cpu, memory).
3. Confirm → target created, collection starts.
4. "View analytics" → explorer opens scoped to the new target.

### Flow B — Compare two apps on one chart
1. Open History/Analytics → **Add targets** → pick App A + App B (+ Machine).
2. Pick metric family CPU.
3. Each chart overlays 3 series; switch to **Grid** to filter/sort the same data.
4. Save as "App A vs B — CPU".

### Flow C — Retrieve later
1. Inspect → **Monitors** → see all targets by type/tag.
2. Click a container target → explorer opens; or open a **saved query**.

---

## Non-Goals (v1)
- Embedded Prometheus/Loki runtimes.
- LogQL / full-text log querying (separate log redesign).
- Cross-node remote monitoring beyond what [010-multi-node-cluster](../010-multi-node-cluster/spec.md) already federates.
- AI decision support — stays in [013](../013-analytics-decision-support/spec.md); this feature provides the data substrate it consumes.

---

## Dependencies & Reuse

| Reuse | From |
|-------|------|
| Time-series store `MetricBucket` + `/api/metrics/aggregated` + `/api/metrics/catalog` | [`metrics.go`](../../../api-go/internal/handlers/metrics.go) |
| Scope/metric-family explorer UI | [`HistoryTab.tsx`](../../../ui/app/components/HistoryTab.tsx) |
| Target CRUD pattern (directories) | [`DirectoryManager.tsx`](../../../ui/app/components/DirectoryManager.tsx), [`directories.go`](../../../api-go/internal/handlers/directories.go) |
| Data grid | `@hivemind/grid` (`GridRoot`, `GridRestSource`) |
| Charts | `recharts` (already used) |

---

## Open Questions
1. **Process identity stability** — pid reuse: key processes by `exe path` (re-resolvable) vs pid+starttime (exact but ephemeral)? Proposed: store both; collector re-resolves by exe path.
2. **Retention per target type** — high-frequency file/port probes may need shorter retention than apps.
3. **Container engine abstraction** — single collector with Docker+Podman drivers, or per-engine targets?
4. **Grid wide-shape pagination** — server-side bucket pivot can be large; cap columns (targets × metrics) with a guard.

---

*See [api-design.md](./api-design.md) for endpoints and data model, and [mql.md](./mql.md) for the query-language grammar.*
