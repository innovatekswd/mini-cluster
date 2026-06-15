import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { metricsService, type SystemMetricsHistory } from "~/services/metricsService";

// ============================================================================
// Types
// ============================================================================

interface SparklineData {
  label: string;
  data: number[];
  color: string;
  unit: string;
  currentValue: string;
}

export type SparklineRange = "1h" | "6h" | "24h" | "7d" | "30d";

interface TimeRangeOption {
  value: SparklineRange;
  label: string;
  hours: number;
  buckets: number;
}

export const SPARKLINE_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: "1h", label: "1h", hours: 1, buckets: 12 },      // 5-min buckets
  { value: "6h", label: "6h", hours: 6, buckets: 24 },      // 15-min buckets
  { value: "24h", label: "24h", hours: 24, buckets: 48 },   // 30-min buckets
  { value: "7d", label: "7d", hours: 168, buckets: 56 },    // 3-hour buckets
  { value: "30d", label: "30d", hours: 720, buckets: 60 },  // 12-hour buckets
];

// ============================================================================
// Sparkline SVG Component
// ============================================================================

const Sparkline: React.FC<{
  data: number[];
  color: string;
  height?: number;
  maxValue?: number;
}> = ({ data, color, height = 30, maxValue }) => {
  if (data.length === 0) return null;

  const max = maxValue ?? Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 200;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  // Determine color intensity based on current value
  const currentVal = data[data.length - 1] || 0;
  const percentage = (currentVal / max) * 100;
  let strokeColor = color;
  if (percentage > 90) strokeColor = "#ef4444"; // red
  else if (percentage > 75) strokeColor = "#f59e0b"; // amber

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaD}
        fill={`url(#sparkline-gradient-${color})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface SparklinesWidgetProps {
  selectedRange?: SparklineRange;
  onRangeChange?: (range: SparklineRange) => void;
}

export const SparklinesWidget: React.FC<SparklinesWidgetProps> = ({ selectedRange: controlledRange, onRangeChange }) => {
  const [internalRange, setInternalRange] = useState<SparklineRange>("24h");
  const selectedRange = controlledRange ?? internalRange;
  const setSelectedRange = onRangeChange ?? setInternalRange;

  const rangeOption = SPARKLINE_RANGE_OPTIONS.find((o) => o.value === selectedRange) || SPARKLINE_RANGE_OPTIONS[2];

  // Fetch data based on selected time range
  const { data: history, isLoading } = useQuery({
    queryKey: ["sparklines", selectedRange],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - rangeOption.hours * 60 * 60 * 1000);
      return metricsService.getSystemMetricsHistory(from, to, rangeOption.buckets);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute
  });

  const sparklines = useMemo<SparklineData[]>(() => {
    if (!history || history.length === 0) {
      return [
        { label: "CPU", data: [], color: "#06b6d4", unit: "%", currentValue: "—" },
        { label: "Memory", data: [], color: "#8b5cf6", unit: "%", currentValue: "—" },
        { label: "Disk", data: [], color: "#10b981", unit: "%", currentValue: "—" },
        { label: "Net ↑", data: [], color: "#f59e0b", unit: "MB/s", currentValue: "—" },
        { label: "Net ↓", data: [], color: "#f97316", unit: "MB/s", currentValue: "—" },
      ];
    }

    const cpuData = history.map((h) => h.cpuUsagePercent ?? 0);
    const memData = history.map((h) => h.memoryUsagePercent ?? 0);
    const diskData = history.map((h) => h.diskUsagePercent ?? 0);
    const sendRateData = history.map((h) => (h.networkSendRate ?? 0) / (1024 * 1024)); // Convert to MB/s
    const recvRateData = history.map((h) => (h.networkReceiveRate ?? 0) / (1024 * 1024)); // Convert to MB/s

    const lastCpu = cpuData[cpuData.length - 1] ?? 0;
    const lastMem = memData[memData.length - 1] ?? 0;
    const lastDisk = diskData[diskData.length - 1] ?? 0;
    const lastSend = sendRateData[sendRateData.length - 1] ?? 0;
    const lastRecv = recvRateData[recvRateData.length - 1] ?? 0;

    return [
      { label: "CPU", data: cpuData, color: "#06b6d4", unit: "%", currentValue: `${lastCpu.toFixed(1)}%` },
      { label: "Memory", data: memData, color: "#8b5cf6", unit: "%", currentValue: `${lastMem.toFixed(1)}%` },
      { label: "Disk", data: diskData, color: "#10b981", unit: "%", currentValue: `${lastDisk.toFixed(1)}%` },
      { label: "Net ↑", data: sendRateData, color: "#f59e0b", unit: "MB/s", currentValue: `${lastSend.toFixed(1)} MB/s` },
      { label: "Net ↓", data: recvRateData, color: "#f97316", unit: "MB/s", currentValue: `${lastRecv.toFixed(1)} MB/s` },
    ];
  }, [history]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-slate-700 rounded w-12" />
              <div className="h-8 bg-slate-700/50 rounded" />
              <div className="h-3 bg-slate-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Time Range Selector */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
          {SPARKLINE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedRange(option.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedRange === option.value
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sparklines Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {sparklines.map((sparkline) => (
          <div
            key={sparkline.label}
            className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-400">{sparkline.label}</span>
              <span className="text-xs text-slate-500">{selectedRange}</span>
            </div>
            <Sparkline data={sparkline.data} color={sparkline.color} height={28} />
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-200">{sparkline.currentValue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
