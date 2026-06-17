# 029 — MQL (MiniCluster Query Language)

> Companion to [spec.md](./spec.md) §7. A PromQL/LogQL-inspired **subset**, compiled server-side to queries over the existing `metric_buckets` store. **No embedded Prometheus or Loki.**
>
> **Phase: P2 (deferred).** v1 does **not** need MQL — the chip selectors + `targets[]` overlay cover the value, and saved queries are stored as structured JSON. MQL is added later as an *alternate input* that compiles to that same JSON `spec`. This doc is the design to build against when P2 starts. See [§8 Embedding](#8-embedding-how-it-plugs-in).

---

## 1. Rationale

The `metric_buckets` table is already a pre-aggregated time-series store with the dimensions `scope`, `entity_id`, `sub_entity`, `metric` and the aggregates `min/avg/max/p95/sum/last`. MQL gives users (and saved queries / widgets) a compact, familiar way to express selections and aggregations that the backend translates directly into GORM `WHERE`/`GROUP BY` clauses.

- **Familiar:** anyone who has touched PromQL reads it instantly.
- **Cheap:** parser + compiler, no second storage engine, no scrape pipeline.
- **Reuses pre-aggregation:** aggregations map onto existing bucket columns.

---

## 2. Grammar (v1)

```
query        := selector range? pipeline?
selector     := METRIC ( "{" matcher ( "," matcher )* "}" )?
matcher      := LABEL ("=" | "!=" | "=~" | "!~") STRING
range        := "[" DURATION "]"            # optional; defaults to explorer range/bucket
pipeline     := "|" agg ( "by" "(" LABEL ( "," LABEL )* ")" )?
agg          := "avg" | "max" | "min" | "sum" | "p95" | "rate"
```

**Labels:** `scope`, `entity_id`, `sub_entity`, `metric` (the bucket dimensions). Matchers `=~`/`!~` are regex over the value.

---

## 3. Examples

| Intent | MQL |
|--------|-----|
| App CPU | `cpu_usage_percent{scope="app", entity_id="my-api"}` |
| Compare two apps on one chart | `cpu_usage_percent{scope="app", entity_id=~"my-api\|my-worker"} \| avg by (entity_id)` |
| Machine + app overlay | `memory_usage_percent{entity_id=~"local\|my-api"} \| avg by (entity_id)` |
| Per-disk breakdown | `disk_usage_percent{scope="machine"} \| max by (sub_entity)` |
| Container memory, top consumers | `process_memory_bytes{scope="container"} \| avg by (entity_id)` |
| Network counter → rate | `network_bytes_sent{scope="app", entity_id="my-api"} \| rate` |

---

## 4. Compilation Rules

| MQL element | Compiles to |
|-------------|-------------|
| `METRIC` | `WHERE metric = ?` |
| `{label="v"}` | `WHERE <label> = ?` |
| `{label=~"a\|b"}` | `WHERE <label> IN (?,?)` (alternation) or `REGEXP`/`LIKE` fallback |
| `[5m]` / explorer bucket | selects `bucket_size` (`5m`/`1h`/`1d`/`1w`) |
| `avg/max/min/sum/p95` | reads the matching bucket column |
| `rate` | delta of `last`/`sum` over bucket width (counters only) |
| `by (entity_id)` | `GROUP BY entity_id` → one series per group |

Result shape mirrors the existing `AggregatedResponse` (`series` keyed by group, plus `summary`), so the chart and grid renderers are unchanged.

---

## 5. UI Integration

- **Chip selectors build MQL** under the hood — the existing scope/family/metric chips in [`HistoryTab.tsx`](../../../ui/app/components/HistoryTab.tsx) generate an MQL string the user can reveal/edit ("Show query").
- **Autocomplete** via `/api/metrics/query/labels` and `/api/metrics/query/values`.
- **Saved queries** store the MQL string; widgets re-run it on a schedule.

---

## 6. Out of Scope (v1)
- **LogQL / log full-text search** — handled by the separate [log-architecture-redesign](../../../plans/log-architecture-redesign.md); MQL is metrics-only for now.
- Binary operators between selectors (`/`, `+`), `histogram_quantile`, recording rules — future if demand appears.
- Cross-node global query fan-out — gated on [010-multi-node-cluster](../010-multi-node-cluster/spec.md).

---

## 8. Embedding — how it plugs in

MQL is **not a service**. It's a small Go package (`internal/mql`) called from **one handler**, reusing the query execution that already exists in [`metrics.go`](../../../api-go/internal/handlers/metrics.go). The pipeline is three stages:

```text
MQL string ──▶ [1] Parse ──▶ [2] Compile ──▶ [3] Execute (existing GORM path) ──▶ AggregatedResponse
```

**Stage 3 already exists.** `aggregated()` ([metrics.go:189](../../../api-go/internal/handlers/metrics.go#L189)) already builds `.Where("scope = ?", …)`, `.Where("entity_id = ?", …)`, `.Where("metric IN ?", …)` and runs the series/summary grouping at [metrics.go:276](../../../api-go/internal/handlers/metrics.go#L276). MQL only changes how those `.Where()` clauses are *produced* — from a string instead of URL params.

### 8.1 Parse — string → AST
Hand-written lexer + recursive-descent parser (~150 LOC, no generator needed for this subset):
```go
type Query struct {
    Metric   string        // "cpu_usage_percent"
    Matchers []Matcher     // {scope="app"}, {entity_id=~"a|b"}
    Agg      string        // "avg" | "max" | "min" | "sum" | "p95" | "rate"
    GroupBy  []string      // ["entity_id"]
    Range    time.Duration // optional [5m]; else explorer range/bucket
}
type Matcher struct{ Label, Op, Value string } // Op: = != =~ !~
```

### 8.2 Compile — AST → GORM
```go
func (q *Query) Compile(db *gorm.DB, from, to time.Time, bucket string) (*gorm.DB, error) {
    db = db.Where("bucket_size = ? AND bucket_time >= ? AND bucket_time < ?", bucket, from, to)
    db = db.Where("metric = ?", q.Metric)
    for _, m := range q.Matchers {
        if !allowedLabel(m.Label) {            // ← SECURITY: allowlist, see 8.4
            return nil, fmt.Errorf("unknown label %q", m.Label)
        }
        switch m.Op {
        case "=":  db = db.Where(m.Label+" = ?", m.Value)
        case "!=": db = db.Where(m.Label+" != ?", m.Value)
        case "=~": db = db.Where(m.Label+" IN ?", strings.Split(m.Value, "|"))
        case "!~": db = db.Where(m.Label+" NOT IN ?", strings.Split(m.Value, "|"))
        }
    }
    return db, nil
}
```
`Agg` selects which bucket column to read (`avg`/`max`/`p95` map to existing columns; `rate` = delta of `last`/`sum` over the bucket width). `GroupBy` → `GROUP BY <label>` → one series per group, exactly like the current `entityIds` overlay path.

### 8.3 Wire-up — one endpoint
Add to `Routes()` next to the existing `r.Get("/aggregated", …)`:
```go
r.Post("/query", h.mqlQuery)   // body: { mql, from, to, bucket }
```
```go
func (h *MetricsHandler) mqlQuery(w http.ResponseWriter, r *http.Request) {
    var req struct{ MQL, From, To, Bucket string }
    _ = json.NewDecoder(r.Body).Decode(&req)
    ast, err := mql.Parse(req.MQL)                       // stage 1
    if err != nil { writeJSON(w, 400, errMsg(err)); return }
    from, to := parseTimes(req.From, req.To)
    db, err := ast.Compile(h.aggDB, from, to, req.Bucket) // stage 2
    if err != nil { writeJSON(w, 400, errMsg(err)); return }
    // stage 3: identical to aggregated() from the .Find(&buckets) call onward
}
```

### 8.4 Security — mandatory
- **Label names are interpolated into SQL** (`m.Label+" = ?"`), so they MUST be validated against a fixed allowlist (`scope`, `entity_id`, `sub_entity`, `metric`). Never let a raw label reach the query string → otherwise SQL injection.
- **Values are always `?`-bound** (parameterized) — safe by construction.
- Cap result size with the existing `maxBuckets` guard ([metrics.go:268](../../../api-go/internal/handlers/metrics.go#L268)).

### 8.5 UI embedding
- The chip selectors in [`HistoryTab.tsx`](../../../ui/app/components/HistoryTab.tsx) **generate** the MQL/`spec`; a **"Show query"** toggle reveals an editable text box for power users.
- Autocomplete via `/api/metrics/query/labels` and `/api/metrics/query/values`.
- Saved queries store the JSON `spec` (P1); the MQL string is an optional `mql` column that always compiles back to `spec`.

---

## 7. Decision Summary

> **Adopt MQL** (PromQL/LogQL-inspired subset) compiled to the existing `metric_buckets` store. **Do not** embed Prometheus or Loki. Logs query language is deferred to the log redesign.
