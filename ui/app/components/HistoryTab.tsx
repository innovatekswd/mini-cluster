import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { FaDownload, FaFolderOpen } from "react-icons/fa";
import { metricsService } from "../services/metricsService";
import type { AggregatedMetricsResponseNew, MetricCatalogEntry } from "../services/metricsService";
import { DirectoryManager } from "./DirectoryManager";

type Scope = "machine" | "service" | "app" | "multi-app" | "directory";
type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "custom";
type BucketSize = "auto" | "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

interface HistoryTabProps {
  onSelectService?: (serviceId: string) => void;
}

export function HistoryTab({ onSelectService }: HistoryTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL query params
  const urlScope = searchParams.get('scope') as Scope | null;
  const urlRange = searchParams.get('range') as TimeRange | null;
  const urlBucket = searchParams.get('bucket') as BucketSize | null;

  // Scope state
  const [scope, setScope] = useState<Scope>(urlScope || "machine");
  const [entityId, setEntityId] = useState<string>("");
  const [entityIds, setEntityIds] = useState<string[]>([]);

  // Time range state
  const [timeRange, setTimeRange] = useState<TimeRange>(urlRange || "24h");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Bucket state
  const [bucketSize, setBucketSize] = useState<BucketSize>(urlBucket || "auto");

  // Metrics state
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["cpu_usage_percent"]);
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set(["cpu"]));

  // Sub-entity state
  const [subEntity, setSubEntity] = useState<string>("");
  const [showSubEntityBreakdown, setShowSubEntityBreakdown] = useState(false);

  // Comparison mode state
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonPreset, setComparisonPreset] = useState<"previous-day" | "previous-week" | "previous-month" | "custom">("previous-day");
  const [comparisonData, setComparisonData] = useState<AggregatedMetricsResponseNew | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Directory manager state
  const [showDirectoryManager, setShowDirectoryManager] = useState(false);

  // Data state
  const [data, setData] = useState<AggregatedMetricsResponseNew | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
  }, []);

  // Load data when filters change
  useEffect(() => {
    loadData();
  }, [scope, entityId, entityIds, timeRange, customFrom, customTo, bucketSize, selectedMetrics, subEntity]);

  // Load comparison data when comparison is enabled or primary data changes
  useEffect(() => {
    if (comparisonEnabled && data) {
      loadComparisonData();
    } else {
      setComparisonData(null);
    }
  }, [comparisonEnabled, comparisonPreset, data]);

  // Sync scope/range/bucket to URL query params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (scope !== "machine") params.scope = scope;
    if (timeRange !== "24h") params.range = timeRange;
    if (bucketSize !== "auto") params.bucket = bucketSize;
    setSearchParams(params, { replace: true });
  }, [scope, timeRange, bucketSize, setSearchParams]);

  const loadCatalog = async () => {
    try {
      const catalogData = await metricsService.getMetricsCatalog();
      setCatalog(catalogData.metrics);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  const loadData = async () => {
    if (selectedMetrics.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      let from: Date;
      let to: Date = now;

      if (timeRange === "custom") {
        from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
        to = customTo ? new Date(customTo) : now;
      } else {
        const hours = { "1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720, "90d": 2160 }[timeRange];
        from = new Date(now.getTime() - hours * 60 * 60 * 1000);
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
      console.error("Failed to load aggregated metrics:", err);
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
      // Calculate the comparison time range based on primary range
      const primaryFrom = new Date(data.from);
      const primaryTo = new Date(data.to);
      const duration = primaryTo.getTime() - primaryFrom.getTime();

      let comparisonFrom: Date;
      let comparisonTo: Date;

      if (comparisonPreset === "previous-day") {
        comparisonTo = new Date(primaryFrom.getTime() - 24 * 60 * 60 * 1000);
        comparisonFrom = new Date(comparisonTo.getTime() - duration);
      } else if (comparisonPreset === "previous-week") {
        comparisonTo = new Date(primaryFrom.getTime() - 7 * 24 * 60 * 60 * 1000);
        comparisonFrom = new Date(comparisonTo.getTime() - duration);
      } else if (comparisonPreset === "previous-month") {
        comparisonTo = new Date(primaryFrom.getTime() - 30 * 24 * 60 * 60 * 1000);
        comparisonFrom = new Date(comparisonTo.getTime() - duration);
      } else {
        // Custom: shift back by the same duration
        comparisonTo = new Date(primaryFrom.getTime() - duration);
        comparisonFrom = new Date(comparisonTo.getTime() - duration);
      }

      const response = await metricsService.getAggregatedMetricsNew({
        scope,
        entityId: scope === "multi-app" ? undefined : entityId,
        entityIds: scope === "multi-app" ? entityIds : undefined,
        from: comparisonFrom.toISOString(),
        to: comparisonTo.toISOString(),
        bucket: bucketSize,
        metrics: selectedMetrics,
        subEntity: subEntity || undefined,
      });

      setComparisonData(response);
    } catch (err) {
      console.error("Failed to load comparison data:", err);
      setComparisonData(null);
    } finally {
      setComparisonLoading(false);
    }
  };

  // Export functions
  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = ["timestamp,metric,min,avg,max,p95,count,sum"];
    for (const metricName of selectedMetrics) {
      const series = data.series[metricName];
      if (!series) continue;
      for (const point of series) {
        rows.push([
          point.timestamp,
          metricName,
          point.min.toString(),
          point.avg.toString(),
          point.max.toString(),
          (point.p95 ?? "").toString(),
          point.count.toString(),
          (point.sum ?? "").toString(),
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metrics-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metrics-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Metric families
  const metricFamilies = useMemo(() => {
    const families = {
      cpu: { label: "CPU", metrics: catalog.filter(m => m.name.startsWith("cpu_")) },
      memory: { label: "Memory", metrics: catalog.filter(m => m.name.startsWith("memory_") || m.name.startsWith("swap_")) },
      disk: { label: "Disk", metrics: catalog.filter(m => m.name.startsWith("disk_")) },
      network: { label: "Network", metrics: catalog.filter(m => m.name.startsWith("network_")) },
      process: { label: "Process", metrics: catalog.filter(m => m.name.startsWith("process_")) },
      directory: { label: "Directory", metrics: catalog.filter(m => m.name.startsWith("dir_")) },
      system: { label: "System", metrics: catalog.filter(m => m.name.startsWith("total_")) },
    };
    return families;
  }, [catalog]);

  const toggleFamily = (family: string) => {
    const newFamilies = new Set(selectedFamilies);
    if (newFamilies.has(family)) {
      newFamilies.delete(family);
    } else {
      newFamilies.add(family);
    }
    setSelectedFamilies(newFamilies);

    // Update selected metrics
    const familyMetrics = metricFamilies[family as keyof typeof metricFamilies]?.metrics || [];
    const otherMetrics = selectedMetrics.filter(m => !familyMetrics.some(fm => fm.name === m));
    const newSelectedMetrics = newFamilies.has(family)
      ? [...otherMetrics, ...familyMetrics.map(m => m.name)]
      : otherMetrics;
    setSelectedMetrics(newSelectedMetrics);
  };

  const toggleMetric = (metricName: string) => {
    if (selectedMetrics.includes(metricName)) {
      setSelectedMetrics(selectedMetrics.filter(m => m !== metricName));
    } else {
      setSelectedMetrics([...selectedMetrics, metricName]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="p-4 border-b border-slate-700/50 space-y-4">
        {/* Scope Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-300">Scope:</label>
          <div className="flex gap-2" role="group" aria-label="Scope selection">
            {(["machine", "service", "app", "multi-app", "directory"] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  scope === s
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Entity Selector */}
        {(scope === "service" || scope === "app" || scope === "directory") && (
          <div className="flex items-center gap-4">
            <label htmlFor="entityId" className="text-sm font-medium text-slate-300">Entity ID:</label>
            <input
              id="entityId"
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={`Enter ${scope} ID`}
              className="flex-1 max-w-md px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
        )}

        {scope === "multi-app" && (
          <div className="flex items-center gap-4">
            <label htmlFor="entityIds" className="text-sm font-medium text-slate-300">App IDs (comma-separated):</label>
            <input
              id="entityIds"
              type="text"
              value={entityIds.join(",")}
              onChange={(e) => setEntityIds(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="app1,app2,app3"
              className="flex-1 max-w-md px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
        )}

        {/* Time Range Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-300">Time Range:</label>
          <div className="flex gap-2" role="group" aria-label="Time range selection">
            {(["1h", "6h", "24h", "7d", "30d", "90d", "custom"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                aria-pressed={timeRange === range}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  timeRange === range
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {timeRange === "custom" && (
          <div className="flex items-center gap-4">
            <label htmlFor="customFrom" className="text-sm font-medium text-slate-300">From:</label>
            <input
              id="customFrom"
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200"
            />
            <label htmlFor="customTo" className="text-sm font-medium text-slate-300">To:</label>
            <input
              id="customTo"
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200"
            />
          </div>
        )}

        {/* Bucket Size Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-300">Bucket Size:</label>
          <div className="flex gap-2" role="group" aria-label="Bucket size selection">
            {(["auto", "1m", "5m", "15m", "1h", "1d", "1w"] as const).map(bucket => (
              <button
                key={bucket}
                onClick={() => setBucketSize(bucket)}
                aria-pressed={bucketSize === bucket}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  bucketSize === bucket
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
                }`}
              >
                {bucket}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Families */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Metric Families:</label>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Metric family selection">
            {Object.entries(metricFamilies).map(([key, family]) => (
              <button
                key={key}
                onClick={() => toggleFamily(key)}
                aria-pressed={selectedFamilies.has(key)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedFamilies.has(key)
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
                }`}
              >
                {family.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-metrics */}
        {selectedFamilies.size > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sub-metrics:</label>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Sub-metric selection">
              {catalog
                .filter(m => selectedFamilies.has(getFamilyForMetric(m.name)))
                .map(metric => (
                  <button
                    key={metric.name}
                    onClick={() => toggleMetric(metric.name)}
                    aria-pressed={selectedMetrics.includes(metric.name)}
                    className={`px-3 py-1.5 rounded text-xs transition-colors ${
                      selectedMetrics.includes(metric.name)
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                        : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
                    }`}
                  >
                    {metric.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Sub-entity breakdown toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="subEntityBreakdown"
            checked={showSubEntityBreakdown}
            onChange={(e) => setShowSubEntityBreakdown(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="subEntityBreakdown" className="text-sm text-slate-300">
            Show sub-entity breakdown
          </label>
        </div>

        {showSubEntityBreakdown && (
          <div className="flex items-center gap-4">
            <label htmlFor="subEntity" className="text-sm font-medium text-slate-300">Sub-entity:</label>
            <input
              id="subEntity"
              type="text"
              value={subEntity}
              onChange={(e) => setSubEntity(e.target.value)}
              placeholder="e.g., /dev/sda1, eth0"
              className="flex-1 max-w-md px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
        )}

        {/* Comparison Mode */}
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            id="comparisonMode"
            checked={comparisonEnabled}
            onChange={(e) => setComparisonEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="comparisonMode" className="text-sm text-slate-300">
            Compare with previous period
          </label>
          {comparisonEnabled && (
            <select
              value={comparisonPreset}
              onChange={(e) => setComparisonPreset(e.target.value as typeof comparisonPreset)}
              className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200"
              aria-label="Comparison period preset"
            >
              <option value="previous-day">Previous Day</option>
              <option value="previous-week">Previous Week</option>
              <option value="previous-month">Previous Month</option>
              <option value="custom">Same Duration Before</option>
            </select>
          )}
        </div>

        {/* Action buttons: Directory Manager + Export */}
        <div className="flex items-center gap-2">
          {scope === "directory" && (
            <button
              onClick={() => setShowDirectoryManager(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded text-sm hover:bg-slate-700 transition-colors"
              aria-label="Manage monitored directories"
            >
              <FaFolderOpen className="text-xs" aria-hidden="true" />
              Manage Directories
            </button>
          )}
          {data && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => exportCSV()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded text-sm hover:bg-slate-700 transition-colors"
                aria-label="Export metrics as CSV"
              >
                <FaDownload className="text-xs" aria-hidden="true" />
                CSV
              </button>
              <button
                onClick={() => exportJSON()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded text-sm hover:bg-slate-700 transition-colors"
                aria-label="Export metrics as JSON"
              >
                <FaDownload className="text-xs" aria-hidden="true" />
                JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full" role="status" aria-live="polite">
            <div className="text-slate-400">Loading metrics...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full" role="alert" aria-live="assertive">
            <div className="text-red-400">{error}</div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {selectedMetrics.map(metricName => {
              const series = data.series[metricName];
              const summary = data.summary[metricName];
              const catalogEntry = catalog.find(m => m.name === metricName);

              if (!series || series.length === 0) {
                return (
                  <div key={metricName} className="text-slate-400 text-sm">
                    No data available for {metricName}
                  </div>
                );
              }

              return (
                <div key={metricName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-200">
                      {metricName} {catalogEntry && `(${catalogEntry.unit})`}
                    </h3>
                  </div>

                  {/* Stats Panel */}
                  {summary && (
                    <div className={`grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 ${comparisonEnabled && comparisonData ? "grid-cols-2 md:grid-cols-2" : "grid-cols-2 md:grid-cols-6"}`}>
                      {/* Primary period stats */}
                      <div className={comparisonEnabled && comparisonData ? "border-r border-slate-700/50 pr-4" : ""}>
                        {comparisonEnabled && comparisonData && (
                          <div className="text-xs text-cyan-400 font-medium mb-2">Current Period</div>
                        )}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                          <div>
                            <div className="text-xs text-slate-400">Current</div>
                            <div className="text-sm font-medium text-slate-200">
                              {formatValue(series[series.length - 1].avg, catalogEntry?.unit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">Avg</div>
                            <div className="text-sm font-medium text-slate-200">
                              {formatValue(summary.avg, catalogEntry?.unit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">Min</div>
                            <div className="text-sm font-medium text-slate-200">
                              {formatValue(summary.min, catalogEntry?.unit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">Max</div>
                            <div className="text-sm font-medium text-slate-200">
                              {formatValue(summary.max, catalogEntry?.unit)}
                            </div>
                          </div>
                          {summary.p95 !== undefined && summary.p95 !== null && (
                            <div>
                              <div className="text-xs text-slate-400">P95</div>
                              <div className="text-sm font-medium text-slate-200">
                                {formatValue(summary.p95, catalogEntry?.unit)}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="text-xs text-slate-400">Samples</div>
                            <div className="text-sm font-medium text-slate-200">
                              {series.reduce((sum, p) => sum + p.count, 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Comparison period stats */}
                      {comparisonEnabled && comparisonData && (() => {
                        const compSeries = comparisonData.series[metricName];
                        const compSummary = comparisonData.summary[metricName];
                        if (!compSeries || compSeries.length === 0 || !compSummary) return null;
                        return (
                          <div className="border-l border-slate-700/50 pl-4">
                            <div className="text-xs text-amber-400 font-medium mb-2">Comparison Period</div>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                              <div>
                                <div className="text-xs text-slate-400">Current</div>
                                <div className="text-sm font-medium text-slate-200">
                                  {formatValue(compSeries[compSeries.length - 1].avg, catalogEntry?.unit)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Avg</div>
                                <div className="text-sm font-medium text-slate-200">
                                  {formatValue(compSummary.avg, catalogEntry?.unit)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Min</div>
                                <div className="text-sm font-medium text-slate-200">
                                  {formatValue(compSummary.min, catalogEntry?.unit)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Max</div>
                                <div className="text-sm font-medium text-slate-200">
                                  {formatValue(compSummary.max, catalogEntry?.unit)}
                                </div>
                              </div>
                              {compSummary.p95 !== undefined && compSummary.p95 !== null && (
                                <div>
                                  <div className="text-xs text-slate-400">P95</div>
                                  <div className="text-sm font-medium text-slate-200">
                                    {formatValue(compSummary.p95, catalogEntry?.unit)}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-xs text-slate-400">Samples</div>
                                <div className="text-sm font-medium text-slate-200">
                                  {compSeries.reduce((sum, p) => sum + p.count, 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Simple Chart Visualization */}
                  <div className="h-64 bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
                    <TimeSeriesChart
                      data={series}
                      comparisonData={comparisonEnabled && comparisonData ? comparisonData.series[metricName] : undefined}
                      unit={catalogEntry?.unit}
                    />
                    {comparisonEnabled && comparisonData && comparisonData.series[metricName]?.length > 0 && (
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-4 h-0.5 bg-cyan-400 rounded"></span>
                          <span className="text-slate-400">Current</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-4 h-0.5 bg-amber-400 rounded border-dashed" style={{borderTop: '2px dashed rgb(251, 191, 36)'}}></span>
                          <span className="text-slate-400">Comparison</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && !data && (
          <div className="flex items-center justify-center h-full" aria-live="polite">
            <div className="text-slate-400">Select metrics to view historical data</div>
          </div>
        )}
      </div>

      {/* Directory Manager Modal */}
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

// Helper function to determine metric family
function getFamilyForMetric(metricName: string): string {
  if (metricName.startsWith("cpu_")) return "cpu";
  if (metricName.startsWith("memory_") || metricName.startsWith("swap_")) return "memory";
  if (metricName.startsWith("disk_")) return "disk";
  if (metricName.startsWith("network_")) return "network";
  if (metricName.startsWith("process_")) return "process";
  if (metricName.startsWith("dir_")) return "directory";
  if (metricName.startsWith("total_")) return "system";
  return "other";
}

// Helper function to format values based on unit
function formatValue(value: number, unit?: string): string {
  if (unit === "bytes") {
    return formatBytes(value);
  }
  if (unit === "bytes/sec") {
    return formatBytesPerSecond(value);
  }
  if (unit === "percent") {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "count") {
    return value.toFixed(0);
  }
  return value.toFixed(2);
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatBytesPerSecond(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

// Simple Time Series Chart Component
interface TimeSeriesChartProps {
  data: Array<{
    timestamp: string;
    avg: number;
    min: number;
    max: number;
    p95?: number | null;
  }>;
  comparisonData?: Array<{
    timestamp: string;
    avg: number;
    min: number;
    max: number;
    p95?: number | null;
  }>;
  unit?: string;
}

function TimeSeriesChart({ data, comparisonData, unit }: TimeSeriesChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400">No data</div>;
  }

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales using primary data timestamps
  const timestamps = data.map(d => new Date(d.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  // Include comparison data in value range calculation
  const allValues = data.flatMap(d => [d.min, d.max, d.avg, d.p95 || d.avg]);
  if (comparisonData && comparisonData.length > 0) {
    allValues.push(...comparisonData.flatMap(d => [d.min, d.max, d.avg, d.p95 || d.avg]));
  }
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  const xScale = (time: number) => padding.left + ((time - minTime) / timeRange) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  // Generate paths for primary data
  const avgPath = data.map((d, i) => {
    const x = xScale(timestamps[i]);
    const y = yScale(d.avg);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  const minMaxPath = data.map((d, i) => {
    const x = xScale(timestamps[i]);
    const yMin = yScale(d.min);
    const yMax = yScale(d.max);
    return `${i === 0 ? "M" : "L"} ${x} ${yMax} L ${x} ${yMin}`;
  }).join(" ");

  // Generate paths for comparison data (normalized to same time range)
  let compAvgPath = "";
  if (comparisonData && comparisonData.length > 0) {
    compAvgPath = comparisonData.map((d, i) => {
      // Normalize comparison timestamps to primary time range
      const normalizedX = padding.left + (i / (comparisonData.length - 1 || 1)) * chartWidth;
      const y = yScale(d.avg);
      return `${i === 0 ? "M" : "L"} ${normalizedX} ${y}`;
    }).join(" ");
  }

  // Generate time labels
  const timeLabels = [];
  const labelCount = Math.min(6, data.length);
  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((i / (labelCount - 1)) * (data.length - 1));
    const time = new Date(timestamps[index]);
    timeLabels.push({
      x: xScale(timestamps[index]),
      label: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Generate value labels
  const valueLabels = [];
  const valueLabelCount = 5;
  for (let i = 0; i < valueLabelCount; i++) {
    const value = minValue + (i / (valueLabelCount - 1)) * valueRange;
    valueLabels.push({
      y: yScale(value),
      label: formatValue(value, unit),
    });
  }

  return (
    <svg width={width} height={height} className="w-full h-full" role="img" aria-label="Time series chart showing metric data over time">
      {/* Grid lines */}
      {valueLabels.map((label, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={label.y}
            x2={width - padding.right}
            y2={label.y}
            stroke="rgba(100, 116, 139, 0.2)"
            strokeDasharray="2,2"
          />
          <text
            x={padding.left - 5}
            y={label.y + 4}
            textAnchor="end"
            className="text-xs fill-slate-400"
          >
            {label.label}
          </text>
        </g>
      ))}

      {/* Min/Max band */}
      <path
        d={minMaxPath}
        fill="rgba(6, 182, 212, 0.1)"
        stroke="none"
      />

      {/* Comparison average line (dashed, amber) */}
      {compAvgPath && (
        <path
          d={compAvgPath}
          fill="none"
          stroke="rgb(251, 191, 36)"
          strokeWidth="2"
          strokeDasharray="6,3"
          opacity="0.7"
        />
      )}

      {/* Average line (solid, cyan) */}
      <path
        d={avgPath}
        fill="none"
        stroke="rgb(6, 182, 212)"
        strokeWidth="2"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(timestamps[i])}
          cy={yScale(d.avg)}
          r="3"
          fill="rgb(6, 182, 212)"
        />
      ))}

      {/* Time labels */}
      {timeLabels.map((label, i) => (
        <text
          key={i}
          x={label.x}
          y={height - 10}
          textAnchor="middle"
          className="text-xs fill-slate-400"
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
}
