import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  FaDownload,
  FaFolderOpen,
  FaChevronDown,
  FaExchangeAlt,
  FaSyncAlt,
} from "react-icons/fa";
import { metricsService } from "../services/metricsService";
import type { AggregatedMetricsResponseNew, MetricCatalogEntry } from "../services/metricsService";
import { DirectoryManager } from "./DirectoryManager";

type Scope = "machine" | "service" | "app" | "multi-app" | "directory";
type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "custom";
type BucketSize = "auto" | "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "custom", label: "Custom" },
];

const BUCKET_OPTIONS: { value: BucketSize; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "1d", label: "1d" },
  { value: "1w", label: "1w" },
];

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "machine", label: "Machine" },
  { value: "service", label: "Service" },
  { value: "app", label: "App" },
  { value: "multi-app", label: "Multi-App" },
  { value: "directory", label: "Directory" },
];

const FAMILY_COLORS: Record<string, string> = {
  cpu: "text-blue-400",
  memory: "text-purple-400",
  disk: "text-emerald-400",
  network: "text-cyan-400",
  process: "text-amber-400",
  directory: "text-orange-400",
  system: "text-slate-400",
};

const CHART_COLORS = [
  "#60a5fa", // blue
  "#c084fc", // purple
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#fbbf24", // amber
  "#f87171", // red
  "#a3e635", // lime
  "#fb923c", // orange
];

interface HistoryTabProps {
  onSelectService?: (serviceId: string) => void;
}

export function HistoryTab({ onSelectService }: HistoryTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [scope, setScope] = useState<Scope>((searchParams.get("scope") as Scope) || "machine");
  const [entityId, setEntityId] = useState("");
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>((searchParams.get("range") as TimeRange) || "24h");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [bucketSize, setBucketSize] = useState<BucketSize>((searchParams.get("bucket") as BucketSize) || "auto");
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["cpu_usage_percent"]);
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set(["cpu"]));
  const [subEntity, setSubEntity] = useState("");
  const [showSubEntityBreakdown, setShowSubEntityBreakdown] = useState(false);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonPreset, setComparisonPreset] = useState<"previous-day" | "previous-week" | "previous-month" | "custom">("previous-day");
  const [comparisonData, setComparisonData] = useState<AggregatedMetricsResponseNew | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [showDirectoryManager, setShowDirectoryManager] = useState(false);
  const [data, setData] = useState<AggregatedMetricsResponseNew | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);

  useEffect(() => { loadCatalog(); }, []);

  useEffect(() => { loadData(); }, [scope, entityId, entityIds, timeRange, customFrom, customTo, bucketSize, selectedMetrics, subEntity]);

  useEffect(() => {
    if (comparisonEnabled && data) loadComparisonData();
    else setComparisonData(null);
  }, [comparisonEnabled, comparisonPreset, data]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (scope !== "machine") params.scope = scope;
    if (timeRange !== "24h") params.range = timeRange;
    if (bucketSize !== "auto") params.bucket = bucketSize;
    setSearchParams(params, { replace: true });
  }, [scope, timeRange, bucketSize, setSearchParams]);

  const loadCatalog = async () => {
    try {
      const res = await metricsService.getMetricsCatalog();
      setCatalog(res.metrics);
    } catch {}
  };

  const loadData = async () => {
    if (selectedMetrics.length === 0) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      let from: Date;
      let to = now;
      if (timeRange === "custom") {
        from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 86400000);
        to = customTo ? new Date(customTo) : now;
      } else {
        const hours = { "1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720, "90d": 2160 }[timeRange];
        from = new Date(now.getTime() - hours * 3600000);
      }
      const response = await metricsService.getAggregatedMetricsNew({
        scope,
        entityId: scope === "multi-app" ? undefined : entityId,
        entityIds: scope === "multi-app" ? entityIds : undefined,
        from: from.toISOString(),
        to: to.toISOString(),
        bucket: bucketSize,
        metrics: selectedMetrics,
        subEntity: subEntity || undefined,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonData = async () => {
    if (!data || selectedMetrics.length === 0) return;
    setComparisonLoading(true);
    try {
      const primaryFrom = new Date(data.from);
      const primaryTo = new Date(data.to);
      const duration = primaryTo.getTime() - primaryFrom.getTime();
      let compTo: Date, compFrom: Date;
      if (comparisonPreset === "previous-day") {
        compTo = new Date(primaryFrom.getTime() - 86400000);
      } else if (comparisonPreset === "previous-week") {
        compTo = new Date(primaryFrom.getTime() - 7 * 86400000);
      } else if (comparisonPreset === "previous-month") {
        compTo = new Date(primaryFrom.getTime() - 30 * 86400000);
      } else {
        compTo = new Date(primaryFrom.getTime() - duration);
      }
      compFrom = new Date(compTo.getTime() - duration);
      const response = await metricsService.getAggregatedMetricsNew({
        scope,
        entityId: scope === "multi-app" ? undefined : entityId,
        entityIds: scope === "multi-app" ? entityIds : undefined,
        from: compFrom.toISOString(),
        to: compTo.toISOString(),
        bucket: bucketSize,
        metrics: selectedMetrics,
        subEntity: subEntity || undefined,
      });
      setComparisonData(response);
    } catch {
      setComparisonData(null);
    } finally {
      setComparisonLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = ["timestamp,metric,min,avg,max,p95,count"];
    for (const metricName of selectedMetrics) {
      const series = data.series[metricName];
      if (!series) continue;
      for (const p of series) {
        rows.push([p.timestamp, metricName, p.min, p.avg, p.max, p.p95 ?? "", p.count].join(","));
      }
    }
    downloadBlob(rows.join("\n"), "text/csv", `metrics-${scope}-${isoDate()}.csv`);
  };

  const exportJSON = () => {
    if (!data) return;
    downloadBlob(JSON.stringify(data, null, 2), "application/json", `metrics-${scope}-${isoDate()}.json`);
  };

  const metricFamilies = useMemo(() => ({
    cpu: { label: "CPU", metrics: catalog.filter(m => m.name.startsWith("cpu_")) },
    memory: { label: "Memory", metrics: catalog.filter(m => m.name.startsWith("memory_") || m.name.startsWith("swap_")) },
    disk: { label: "Disk", metrics: catalog.filter(m => m.name.startsWith("disk_")) },
    network: { label: "Network", metrics: catalog.filter(m => m.name.startsWith("network_")) },
    process: { label: "Process", metrics: catalog.filter(m => m.name.startsWith("process_")) },
    directory: { label: "Directory", metrics: catalog.filter(m => m.name.startsWith("dir_")) },
    system: { label: "System", metrics: catalog.filter(m => m.name.startsWith("total_")) },
  }), [catalog]);

  const toggleFamily = (family: string) => {
    const next = new Set(selectedFamilies);
    if (next.has(family)) next.delete(family); else next.add(family);
    setSelectedFamilies(next);
    const familyMetrics = metricFamilies[family as keyof typeof metricFamilies]?.metrics ?? [];
    const others = selectedMetrics.filter(m => !familyMetrics.some(fm => fm.name === m));
    setSelectedMetrics(next.has(family) ? [...others, ...familyMetrics.map(m => m.name)] : others);
  };

  const toggleMetric = (name: string) => {
    setSelectedMetrics(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex-none border-b border-slate-800/50 bg-slate-900/40">
        {/* Row 1: Scope + Entity + Time + Bucket */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          {/* Scope */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Scope</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    scope === opt.value
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Entity ID input */}
          {(scope === "service" || scope === "app" || scope === "directory") && (
            <input
              type="text"
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              placeholder={`${scope} ID`}
              className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 w-48 focus:outline-none focus:border-cyan-500/50"
            />
          )}

          {scope === "multi-app" && (
            <input
              type="text"
              value={entityIds.join(",")}
              onChange={e => setEntityIds(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="app1, app2, app3"
              className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 w-56 focus:outline-none focus:border-cyan-500/50"
            />
          )}

          <div className="w-px h-5 bg-slate-700/50" />

          {/* Time range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Range</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
              {TIME_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === opt.value
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-slate-700/50" />

          {/* Bucket */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Bucket</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
              {BUCKET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBucketSize(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    bucketSize === opt.value
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions: push right */}
          <div className="ml-auto flex items-center gap-2">
            {scope === "directory" && (
              <button
                onClick={() => setShowDirectoryManager(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
              >
                <FaFolderOpen className="text-[10px]" />
                Directories
              </button>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
            >
              <FaSyncAlt className={`text-[10px] ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {data && (
              <>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                >
                  <FaDownload className="text-[10px]" />
                  CSV
                </button>
                <button
                  onClick={exportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                >
                  <FaDownload className="text-[10px]" />
                  JSON
                </button>
              </>
            )}
          </div>
        </div>

        {/* Custom date pickers */}
        {timeRange === "custom" && (
          <div className="flex items-center gap-3 px-5 pb-3">
            <span className="text-xs text-slate-500">From</span>
            <input
              type="datetime-local"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
            <span className="text-xs text-slate-500">To</span>
            <input
              type="datetime-local"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        )}

        {/* Row 2: Metrics selector + comparison */}
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          {/* Metric family chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(metricFamilies).map(([key, family]) => {
              const active = selectedFamilies.has(key);
              const colorClass = FAMILY_COLORS[key] ?? "text-slate-400";
              return (
                <button
                  key={key}
                  onClick={() => toggleFamily(key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? `${colorClass} border-current bg-current/10`
                      : "text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {family.label}
                  {active && family.metrics.length > 0 && (
                    <span className="opacity-60">({family.metrics.filter(m => selectedMetrics.includes(m.name)).length}/{family.metrics.length})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Individual metric picker (collapsible) */}
          {selectedFamilies.size > 0 && (
            <button
              onClick={() => setMetricsOpen(o => !o)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 border border-slate-700/50 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              Metrics ({selectedMetrics.length})
              <FaChevronDown className={`text-[9px] transition-transform ${metricsOpen ? "rotate-180" : ""}`} />
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            {/* Sub-entity */}
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showSubEntityBreakdown}
                onChange={e => setShowSubEntityBreakdown(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              Sub-entity
            </label>

            {showSubEntityBreakdown && (
              <input
                type="text"
                value={subEntity}
                onChange={e => setSubEntity(e.target.value)}
                placeholder="e.g. /dev/sda1, eth0"
                className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 w-40 focus:outline-none focus:border-cyan-500/50"
              />
            )}

            {/* Comparison toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={comparisonEnabled}
                onChange={e => setComparisonEnabled(e.target.checked)}
                className="rounded accent-amber-500"
              />
              <FaExchangeAlt className="text-[10px]" />
              Compare
            </label>

            {comparisonEnabled && (
              <select
                value={comparisonPreset}
                onChange={e => setComparisonPreset(e.target.value as typeof comparisonPreset)}
                className="px-2.5 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="previous-day">vs. Previous Day</option>
                <option value="previous-week">vs. Previous Week</option>
                <option value="previous-month">vs. Previous Month</option>
                <option value="custom">vs. Same Duration Before</option>
              </select>
            )}
          </div>
        </div>

        {/* Individual metric checkboxes */}
        {metricsOpen && selectedFamilies.size > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {catalog
              .filter(m => selectedFamilies.has(getFamilyForMetric(m.name)))
              .map(metric => {
                const active = selectedMetrics.includes(metric.name);
                return (
                  <label
                    key={metric.name}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-all ${
                      active
                        ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/10"
                        : "text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleMetric(metric.name)}
                      className="hidden"
                    />
                    {metric.name}
                    <span className="opacity-50 text-[10px]">{metric.unit}</span>
                  </label>
                );
              })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <FaSyncAlt className="animate-spin text-2xl text-cyan-500" />
              <span className="text-sm">Loading metrics…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-6 py-4">{error}</div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Select a metric family above to view historical data
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            {selectedMetrics.map((metricName, metricIdx) => {
              const series = data.series[metricName];
              const summary = data.summary[metricName];
              const catalogEntry = catalog.find(m => m.name === metricName);
              const color = CHART_COLORS[metricIdx % CHART_COLORS.length];
              const compSeries = comparisonEnabled && comparisonData ? comparisonData.series[metricName] : null;
              const compSummary = comparisonEnabled && comparisonData ? comparisonData.summary[metricName] : null;

              if (!series || series.length === 0) return (
                <div key={metricName} className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-5">
                  <h3 className="text-sm font-semibold text-slate-400 mb-2">{metricName}</h3>
                  <p className="text-xs text-slate-600">No data for this time range</p>
                </div>
              );

              // Build chart rows
              const rows = series.map((p, i) => {
                const row: Record<string, number | string> = {
                  t: formatTimestamp(p.timestamp, timeRange),
                  avg: +p.avg.toFixed(2),
                  min: +p.min.toFixed(2),
                  max: +p.max.toFixed(2),
                };
                if (compSeries?.[i]) {
                  row.comp_avg = +compSeries[i].avg.toFixed(2);
                }
                return row;
              });

              return (
                <div key={metricName} className="rounded-xl border border-slate-800/50 bg-slate-900/30 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-semibold text-slate-200">{metricName}</h3>
                      {catalogEntry?.unit && (
                        <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">{catalogEntry.unit}</span>
                      )}
                    </div>
                    {catalogEntry?.description && (
                      <span className="text-xs text-slate-500 hidden md:block">{catalogEntry.description}</span>
                    )}
                  </div>

                  {/* Stats row */}
                  {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-slate-800/30">
                      {[
                        { label: "Current", value: formatValue(series[series.length - 1].avg, catalogEntry?.unit) },
                        { label: "Avg", value: formatValue(summary.avg, catalogEntry?.unit) },
                        { label: "Min", value: formatValue(summary.min, catalogEntry?.unit) },
                        { label: "Max", value: formatValue(summary.max, catalogEntry?.unit) },
                        ...(summary.p95 != null ? [{ label: "P95", value: formatValue(summary.p95, catalogEntry?.unit) }] : []),
                        { label: "Samples", value: series.reduce((s, p) => s + p.count, 0).toString() },
                      ].map(stat => (
                        <div key={stat.label} className="bg-slate-900/40 px-4 py-3">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</div>
                          <div className="text-sm font-semibold text-slate-200 mt-0.5">{stat.value}</div>
                          {compSummary && stat.label === "Avg" && (
                            <div className="text-[10px] text-amber-400 mt-0.5">
                              vs {formatValue(compSummary.avg, catalogEntry?.unit)}
                              {" "}
                              <DeltaBadge current={summary.avg} previous={compSummary.avg} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chart */}
                  <div className="p-5 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${metricIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.12)" />
                        <XAxis
                          dataKey="t"
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={v => formatValue(v, catalogEntry?.unit)}
                          width={55}
                        />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: "#94a3b8" }}
                          formatter={(val, name) => [
                            val != null ? formatValue(val as number, catalogEntry?.unit) : "—",
                            name === "comp_avg" ? "Comparison" : String(name),
                          ]}
                        />
                        {compSeries && (
                          <Area
                            type="monotone"
                            dataKey="comp_avg"
                            name="comp_avg"
                            stroke="#fbbf24"
                            strokeWidth={1.5}
                            strokeDasharray="5 3"
                            fill="none"
                            dot={false}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="avg"
                          name="avg"
                          stroke={color}
                          strokeWidth={2}
                          fill={`url(#grad-${metricIdx})`}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        {compSeries && (
                          <Legend
                            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                            formatter={(value) => value === "comp_avg" ? "Comparison" : "Current"}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DirectoryManager
        isOpen={showDirectoryManager}
        onClose={() => setShowDirectoryManager(false)}
        onViewHistory={(dirId) => {
          setScope("directory");
          setEntityId(dirId);
          setShowDirectoryManager(false);
        }}
      />
    </div>
  );
}

// ---- helpers ----

function getFamilyForMetric(name: string): string {
  if (name.startsWith("cpu_")) return "cpu";
  if (name.startsWith("memory_") || name.startsWith("swap_")) return "memory";
  if (name.startsWith("disk_")) return "disk";
  if (name.startsWith("network_")) return "network";
  if (name.startsWith("process_")) return "process";
  if (name.startsWith("dir_")) return "directory";
  if (name.startsWith("total_")) return "system";
  return "other";
}

function formatValue(value: number, unit?: string): string {
  if (unit === "bytes") return formatBytes(value);
  if (unit === "bytes/sec") return `${formatBytes(value)}/s`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "count") return value.toFixed(0);
  return value.toFixed(2);
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function formatTimestamp(ts: string, range: TimeRange): string {
  const d = new Date(ts);
  if (range === "7d" || range === "30d" || range === "90d") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  return (
    <span className={up ? "text-rose-400" : "text-emerald-400"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
