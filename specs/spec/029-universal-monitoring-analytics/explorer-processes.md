# 029 — Explorer & Processes Enrichment

> Companion to [spec.md](./spec.md) §8. Enriches the two surfaces where users most naturally **find a thing to monitor**: the File Explorer and the Processes view. Everything here is **P1** except where marked.

---

## Part A — Explorer

### A.0 What exists today (so we build on it, not over it)

| Capability | Where | State |
|------------|-------|-------|
| Directory listing with per-entry `size` | [`explorer.go` `list()`](../../../api-go/internal/handlers/explorer.go) (lines 61–95), [`explorerService.ts`](../../../ui/app/services/explorerService.ts) | ✅ but `size` for a **directory** is just the dirent size (~4 KB), **not** the recursive folder size |
| File grid / rows / icons | [`FileGrid.tsx`](../../../ui/app/components/Explorer/FileGrid.tsx), [`FileRow.tsx`](../../../ui/app/components/Explorer/FileRow.tsx) | ✅ |
| Context menu (`⋮` / right-click) | [`ContextMenu.tsx`](../../../ui/app/components/Explorer/ContextMenu.tsx) | ✅ open/edit/preview/copy/compress/properties/delete |
| `search()` client call | [`explorerService.ts:378`](../../../ui/app/services/explorerService.ts) — `GET /search?path&query&recursive&type&maxResults` | ⚠️ **client exists, but `Routes()` in `explorer.go` does NOT register `/search`** — backend missing/incomplete |
| Properties dialog | [`PropertiesDialog.tsx`](../../../ui/app/components/Explorer/PropertiesDialog.tsx) | ✅ |

> **Two real gaps confirmed in code:** (1) folder sizes are not computed; (2) the search endpoint the UI calls isn't wired in the backend. This part closes both.

### A.1 Folder Sizes

**Goal:** show the true recursive size of a folder in the grid (and let the user sort by it).

**Backend**
- New endpoint: `GET /api/explorer/dir-size?path=&depth=` → `{ path, sizeBytes, fileCount, dirCount, computedAt, partial }`.
- Implementation: `filepath.WalkDir` accumulating `info.Size()`; respect `guardPath()` ([explorer.go:249](../../../api-go/internal/handlers/explorer.go#L249)) so it can't escape allowed roots.
- **Caching (required — walking is expensive):**
  - In-memory LRU keyed by absolute path → `{size, fileCount, mtimeOfDir, computedAt}`.
  - Invalidate when the directory's own mtime changes; TTL fallback (e.g. 5 min).
  - **Reuse the directory monitor:** a folder that is a `directory` Monitor Target ([spec.md](./spec.md) §2) already has periodic `dir_total_bytes` / `dir_file_count` samples in `metric_buckets` — serve those instead of walking. So "size" gets *cheaper and historical* once a folder is monitored.
- **Async for big trees:** if a walk exceeds a budget (time or entries), return `partial:true` with the partial sum and continue in the background; the UI shows "≥ X (computing…)".

**Frontend**
- Add a **Size** column to the directory grid that, for folders, lazily calls `dir-size` (on demand / on viewport / on a "compute sizes" toggle — don't auto-walk every folder on every listing).
- Show a tiny spinner → resolved size; sortable. A **bar/heatmap** affordance (relative size within the current folder) is a nice cheap visual.
- Right-click → **"Calculate folder size"** for on-demand; **"Disk usage map"** (P2) opens a treemap of the subtree (one `dir-size?depth=N` call).

### A.1b Disk Usage Analyzer

**Goal:** match the "tree-size" genre (WinDirStat, WizTree, TreeSize, ncdu, DaisyDisk) — *where did my space go* — but with the one thing those tools can't do: **size over time**.

> **Differentiator:** WizTree/TreeSize show a folder's size *now*. Because a monitored folder records `dir_total_bytes` / `dir_file_count` in `metric_buckets` ([spec.md](./spec.md) §2), this view shows **growth trend** and can warn *before* a disk fills — borrow the UX of the classics, win on history. Speed-wise we don't try to beat WizTree's MFT scan; we win on the **cache + monitor-as-source** path so repeat views are instant.

**One scan, several views.** A single guarded `WalkDir` (or served from `metric_buckets` if the folder is monitored) feeds:

| View | Borrowed from | Backend |
|------|---------------|---------|
| **Treemap** — rectangles sized by bytes, colored by type | WinDirStat / SpaceSniffer / DaisyDisk | `GET /api/explorer/usage?path=&depth=` → nested `{path,size,children[]}` |
| **Largest files** — top-N by size in subtree | TreeSize | same walk, top-N heap; or `search?minSize=…&sort=size` |
| **Oldest / stale files** — top-N by age | TreeSize | same walk, sort by mtime; or `search?modifiedBefore=…` |
| **File-type breakdown** — % of subtree per extension/category | WinDirStat colors | `GET /api/explorer/usage/by-type?path=` → `[{ext, sizeBytes, count, pct}]` |
| **Growth trend** — size over time (📈 unique) | *(none of them)* | the analytics overlay on the folder's `dir_total_bytes` target |

**Endpoint shapes**
```text
GET /api/explorer/usage?path=&depth=N&top=50
->  { path, sizeBytes, fileCount, computedAt, partial,
      children:[{ name, path, type, sizeBytes, pct }],   # for treemap drill-down
      largest:[{ path, sizeBytes }], oldest:[{ path, modified }] }

GET /api/explorer/usage/by-type?path=
->  { total, types:[{ ext, category, sizeBytes, count, pct }] }
```

**Frontend**
- A **Disk Usage** panel/tab in the Explorer (or right-click folder → **"Analyze disk usage"**).
- **Treemap** component (rectangles by size, colored by `category` from [`FileItem.category`](../../../ui/app/services/explorerService.ts)); click a rectangle to drill into that subdirectory (one `usage?path=` call per level).
- Side panels: **Largest files**, **Oldest files**, **By type** (bar/donut) — all rendered in `@hivemind/grid` where tabular so the user gets sort/filter for free.
- A **"Monitor this folder"** affordance turns the snapshot into a tracked trend in one click; if already monitored, show the **growth sparkline** inline.

**Reuse & safety**
- Same `WalkDir` + `guardPath` + time/entry/byte caps + async `partial:true` as [A.1](#a1-folder-sizes) — the analyzer *is* the folder-size walk with extra aggregation, not a second crawler.
- Cache the per-path result alongside the folder-size LRU; invalidate on dir mtime change.
- A monitored folder serves `sizeBytes` and trend from `metric_buckets` instead of walking → "instant" repeat views (our answer to WizTree's speed).

**Deferred (not v1):**
- 🚫 **Duplicate-file detection** (size + content hash; dupeGuru/TreeSize style) — heavy (full-content hashing across the tree, large memory/IO). Tracked as a **P2/P3 follow-up**: would add `GET /api/explorer/duplicates?path=` doing a two-pass size-bucket → partial-hash → full-hash pipeline with strict caps. **Out of scope for this spec's v1.**
- 🚫 **Drive-wide MFT-speed scan** (WizTree-style) — platform-specific (NTFS); revisit only if walk performance proves insufficient.

### A.2 Advanced Search

**Goal:** "search by different methods" — name, glob, regex, content, size range, date range, type — not just a substring.

**Backend** — implement/extend `GET /api/explorer/search` (the route the client already expects):
```
GET /api/explorer/search
  ?path=            # root to search under (guarded)
  &name=            # substring OR glob (*.log) OR /regex/
  &content=         # full-text grep inside files (opt-in; size-capped)
  &type=all|file|directory
  &minSize=&maxSize=
  &modifiedAfter=&modifiedBefore=
  &recursive=true
  &maxResults=200&cursor=     # pagination
->  { results:[{path,name,type,size,modified,match,snippet?}], total, truncated, nextCursor }
```
- **Matching engine:** `WalkDir` + predicate chain (name/glob/regex → cheap; content grep → only when `content` set, skip binaries, cap file size and total bytes scanned).
- **Safety:** `guardPath`; hard caps on results, walk time, and bytes scanned; stream results so the first matches arrive fast.
- **Content search note:** for *log* content specifically, defer to the log subsystem ([log-architecture-redesign](../../../plans/log-architecture-redesign.md)) rather than grepping live — this search is for ad-hoc filesystem queries.

**Frontend**
- A **search panel** in the Explorer toolbar with: a single smart input (auto-detects glob/regex) + an "Advanced" expander for size/date/type/content filters.
- Results render in the **HiveMind grid** (`@hivemind/grid`) so the user gets column sort/filter/quick-search *on the results* for free — same grid used elsewhere in this feature.
- Each result row has the `⋮` actions: open, reveal in tree, **Monitor**.

**"Search methods" summary**

| Method | Input example | Engine |
|--------|---------------|--------|
| Substring | `report` | name contains |
| Glob | `*.log`, `app-?.json` | `filepath.Match` |
| Regex | `/error-\d+/` | `regexp` on name |
| Content | content=`panic:` | grep (capped, non-binary) |
| Size | `minSize=100MB` | stat predicate |
| Date | `modifiedAfter=2026-06-01` | stat predicate |
| Type | files only / dirs only | dirent predicate |

### A.3 "Monitor" from Explorer

- Add to [`ContextMenu.tsx`](../../../ui/app/components/Explorer/ContextMenu.tsx) `menuItems`:
  - directory → **"Monitor folder"** (`type=directory`, prefilled recursive + interval).
  - file → **"Monitor file"** (`type=file`: size/mtime/exists) and, if executable, **"Monitor as process"** (`type=process`, `config.exePath` = the file).
- Action opens the shared `MonitorDialog` ([api-design.md](./api-design.md) §5) prefilled via `POST /api/monitors/resolve`.
- After creation, an inline toast offers **"View analytics"** → deep-links the explorer (`/inspect/history?targets=<id>`).

---

## Part B — Processes

### B.0 What exists today

- [`inspect.processes.tsx`](../../../ui/app/routes/inspect.processes.tsx) is a **hand-built 654-line table**: its own `SortColumn`/`SortDirection`/`StatusFilter`, manual sort, manual search, 3 s refresh, kill action.
- Data from [`metricsService.getSystemProcesses()`](../../../ui/app/services/metricsService.ts) (`/api/metrics/processes`) → `SystemProcessInfo` (pid, name, memory, threads, cpu, status, startTime).
- `killProcess(pid)` exists.

### B.1 Move to the HiveMind grid

**Goal:** replace the bespoke table with `@hivemind/grid` `GridRoot` so filtering, multi-column sort, quick-search, grouping, and column config come for free and match the rest of the product.

- Columns: name, pid, user (P2), cpu%, memory, threads, status, start time, command/exe path.
- **Server-side option:** for ≤ 500 processes client-side grid is fine; if the cap grows, add `GET /api/metrics/processes` pagination/sort params and use `GridRestSource` ([api-design.md](./api-design.md) §2.3).
- Keep the 3 s refresh; the grid re-renders rows in place.
- Row `⋮` actions: **Kill** (existing), **Monitor** (new), **Open file location** (reveal exe in Explorer), **View analytics**.

### B.2 "Monitor" from Processes

- `⋮` → **Monitor** creates a `process` Monitor Target. Identity question (pid reuse) is handled per [spec.md Open Questions](./spec.md#open-questions): store `config.exePath` + `config.matchBy` so the collector re-resolves the process by exe path across restarts, with pid+start-time as the exact-instance fallback.
- Once monitored, the process gets historical cpu/memory/threads in `metric_buckets` and shows up in the multi-entity overlay (compare two processes, or a process vs the machine, on one chart).

### B.3 Enrichments (P2, optional)

- **Group by** exe/app/user; **tree view** (parent→child pids).
- **Per-process mini-sparkline** (cpu/mem) in the row, sourced from recent buckets if monitored.
- **Top-consumers** quick filter (sort by cpu/mem, highlight outliers) — feeds [013 analytics](../013-analytics-decision-support/spec.md).

---

## Shared Implementation Notes

- **One grid everywhere:** Explorer search results, Processes, and the analytics Grid mode all use `@hivemind/grid` → consistent UX, one dependency to add to [`ui/package.json`](../../../ui/package.json).
- **One "Monitor" path:** Explorer, Processes, Apps, Services, Containers all call the same `MonitorDialog` + `POST /api/monitors`. No per-surface monitor logic.
- **Folder size ↔ monitoring synergy:** computing a folder size and monitoring a folder are the *same data* (`dir_total_bytes`); a monitored folder serves instant historical sizes, an unmonitored one computes on demand and can be "promoted" to monitored in one click.
- **Safety budget (Explorer):** every recursive operation (size, search) is bounded by `guardPath` + time/entry/byte caps and is cancellable. Never block the UI thread; stream or paginate.

---

## Acceptance (P1)

- [ ] Grid shows true recursive folder size on demand, sortable, cached.
- [ ] Disk Usage Analyzer: treemap drill-down + largest/oldest files + by-type breakdown; growth trend when monitored. (Duplicate detection explicitly deferred.)
- [ ] `/api/explorer/search` implemented; UI search supports name/glob/regex + size/date/type filters; results in HiveMind grid.
- [ ] Explorer `⋮` has Monitor folder / Monitor file / Monitor as process.
- [ ] Processes view runs on `@hivemind/grid` with Kill + Monitor + Open location + View analytics.
- [ ] Monitoring a folder/file/process creates a Monitor Target and appears in the multi-entity analytics overlay.
