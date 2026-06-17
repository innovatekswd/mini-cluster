# 029 — MQL (MiniCluster Query Language)

> Companion to [spec.md](./spec.md) §7. A PromQL/LogQL-inspired **subset**, compiled server-side to queries over the existing `metric_buckets` store. **No embedded Prometheus or Loki.**

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
| Compare two apps on one chart | `cpu_usage_percent{scope="app", entity_id=~"my-api|my-worker"} \| avg by (entity_id)` |
| Machine + app overlay | `memory_usage_percent{entity_id=~"local|my-api"} \| avg by (entity_id)` |
| Per-disk breakdown | `disk_usage_percent{scope="machine"} \| max by (sub_entity)` |
| Container memory, top consumers | `process_memory_bytes{scope="container"} \| avg by (entity_id)` |
| Network counter → rate | `network_bytes_sent{scope="app", entity_id="my-api"} \| rate` |

---

## 4. Compilation Rules

| MQL element | Compiles to |
|-------------|-------------|
| `METRIC` | `WHERE metric = ?` |
| `{label="v"}` | `WHERE <label> = ?` |
| `{label=~"a|b"}` | `WHERE <label> IN (?,?)` (alternation) or `REGEXP`/`LIKE` fallback |
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

## 7. Decision Summary

> **Adopt MQL** (PromQL/LogQL-inspired subset) compiled to the existing `metric_buckets` store. **Do not** embed Prometheus or Loki. Logs query language is deferred to the log redesign.
