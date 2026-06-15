import React, { useMemo } from "react";
import { Link } from "react-router";
import { FaMicrochip, FaMemory, FaNetworkWired, FaHdd, FaArrowRight } from "react-icons/fa";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLiveSystemMetrics } from "~/hooks/useLiveSystemMetrics";

// ============================================================================
// Types
// ============================================================================

interface ChartStats {
  min: number;
  max: number;
  avg: number;
}

// ============================================================================
// Color Mapping
// ============================================================================

const COLOR_MAP: Record<string, { stroke: string; fill: string }> = {
  blue: { stroke: "#06b6d4", fill: "#06b6d4" },
  green: { stroke: "#10b981", fill: "#10b981" },
  violet: { stroke: "#8b5cf6", fill: "#8b5cf6" },
  cyan: { stroke: "#06b6d4", fill: "#06b6d4" },
  amber: { stroke: "#f59e0b", fill: "#f59e0b" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function calcStats(data: number[]): ChartStats {
  if (data.length === 0) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
  return { min, max, avg };
}

function formatTimeLabel(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return timestamp;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  data: number[];
  timestamps: string[];
  color: "blue" | "green" | "violet" | "cyan" | "amber";
  maxValue?: number; // Set to undefined for dynamic scaling
  unit?: string;
  viewAllLink: string;
  currentLabel?: string;
  currentColor?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  icon,
  data,
  timestamps,
  color,
  maxValue = 100,
  unit = "%",
  viewAllLink,
  currentLabel,
  currentColor,
}) => {
  const stats = useMemo(() => calcStats(data), [data]);
  const currentValue = data.length > 0 ? data[data.length - 1] : 0;

  // Dynamic Y-axis scaling: if maxValue is not provided, calculate from data
  const dynamicMaxValue = useMemo(() => {
    if (maxValue !== undefined) return maxValue;
    const max = stats.max;
    // Add 20% padding and minimum of 10 to avoid tiny scales
    return Math.max(max * 1.2, 10);
  }, [maxValue, stats.max]);

  const chartData = useMemo(() => {
    return data.map((value, index) => ({
      time: timestamps[index] || "",
      value,
    }));
  }, [data, timestamps]);

  const colors = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        </div>
        <Link
          to={viewAllLink}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <span>View All</span>
          <FaArrowRight className="text-[10px]" />
        </Link>
      </div>

      {/* Chart */}
      <div style={{ height: 128, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.fill} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTimeLabel}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, dynamicMaxValue]}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: colors.stroke }}
              formatter={(value) => [`${Number(value).toFixed(1)}${unit}`, title]}
              labelFormatter={(label) => formatTimeLabel(String(label))}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.stroke}
              strokeWidth={2}
              fill={`url(#gradient-${color})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-500">Current: </span>
            <span className={`font-medium ${currentColor || "text-slate-200"}`}>
              {currentValue.toFixed(1)}
              {unit}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Avg: </span>
            <span className="text-slate-300">
              {stats.avg.toFixed(1)}
              {unit}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Peak: </span>
            <span className="text-slate-300">
              {stats.max.toFixed(1)}
              {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface NetworkChartCardProps {
  sendData: number[];
  receiveData: number[];
  timestamps: string[];
  viewAllLink: string;
}

// Adaptive unit formatting: show KB/s for small values, MB/s for larger
function formatNetworkRate(valueMBps: number): string {
  if (valueMBps < 0.1) {
    return `${(valueMBps * 1024).toFixed(1)} KB/s`;
  }
  return `${valueMBps.toFixed(2)} MB/s`;
}

function getNetworkUnit(valueMBps: number): string {
  return valueMBps < 0.1 ? "KB/s" : "MB/s";
}

function toDisplayValue(valueMBps: number): number {
  return valueMBps < 0.1 ? valueMBps * 1024 : valueMBps;
}

const NetworkChartCard: React.FC<NetworkChartCardProps> = ({
  sendData,
  receiveData,
  timestamps,
  viewAllLink,
}) => {
  const sendStats = useMemo(() => calcStats(sendData), [sendData]);
  const receiveStats = useMemo(() => calcStats(receiveData), [receiveData]);
  const currentSend = sendData.length > 0 ? sendData[sendData.length - 1] : 0;
  const currentReceive = receiveData.length > 0 ? receiveData[receiveData.length - 1] : 0;

  // Combine data for max value calculation
  const allData = [...sendData, ...receiveData];
  const maxMBps = allData.length > 0 ? Math.max(...allData) * 1.2 : 0.1;
  // Use KB/s scale if max is small
  const useKB = maxMBps < 0.1;
  const maxValue = useKB ? maxMBps * 1024 : maxMBps;
  const unit = useKB ? "KB/s" : "MB/s";
  const toDisplay = (v: number) => (useKB ? v * 1024 : v);

  const sendChartData = useMemo(() => {
    return sendData.map((value, index) => ({
      time: timestamps[index] || "",
      value: toDisplay(value),
    }));
  }, [sendData, timestamps, useKB]);

  const receiveChartData = useMemo(() => {
    return receiveData.map((value, index) => ({
      time: timestamps[index] || "",
      value: toDisplay(value),
    }));
  }, [receiveData, timestamps, useKB]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaNetworkWired className="text-cyan-400" />
          <h3 className="text-sm font-medium text-slate-200">Network I/O</h3>
        </div>
        <Link
          to={viewAllLink}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <span>View All</span>
          <FaArrowRight className="text-[10px]" />
        </Link>
      </div>

      {/* Dual Chart */}
      <div className="flex-1 min-h-0 space-y-2">
        {/* Send Chart */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-400">↑ Send</span>
            <span className="text-xs text-slate-300">{formatNetworkRate(currentSend)}</span>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={sendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradient-send" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, maxValue]} hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#10b981" }}
                  formatter={(value) => [`${Number(value).toFixed(2)} ${unit}`, "Send"]}
                  labelFormatter={(label) => formatTimeLabel(String(label))}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradient-send)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Receive Chart */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-cyan-400">↓ Receive</span>
            <span className="text-xs text-slate-300">{formatNetworkRate(currentReceive)}</span>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={receiveChartData}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradient-receive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTimeLabel}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis domain={[0, maxValue]} hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#06b6d4" }}
                  formatter={(value) => [`${Number(value).toFixed(2)} ${unit}`, "Receive"]}
                  labelFormatter={(label) => formatTimeLabel(String(label))}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#gradient-receive)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">↑</span>
          <span className="text-slate-500">Peak:</span>
          <span className="text-slate-300">{formatNetworkRate(sendStats.max)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">↓</span>
          <span className="text-slate-500">Peak:</span>
          <span className="text-slate-300">{formatNetworkRate(receiveStats.max)}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const LiveChartsWidget: React.FC = () => {
  const {
    cpuHistory,
    memoryHistory,
    diskHistory,
    networkSendHistory,
    networkReceiveHistory,
    timestamps,
    isLoading,
  } = useLiveSystemMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-1/3 mb-3" />
            <div className="h-32 bg-slate-700 rounded mb-3" />
            <div className="h-3 bg-slate-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CPU Usage Chart */}
      <ChartCard
        title="CPU Usage"
        icon={<FaMicrochip className="text-cyan-400" />}
        data={cpuHistory}
        timestamps={timestamps}
        color="blue"
        maxValue={100}
        unit="%"
        viewAllLink="/observe/resources"
        currentColor="text-cyan-400"
      />

      {/* Memory Usage Chart */}
      <ChartCard
        title="Memory Usage"
        icon={<FaMemory className="text-violet-400" />}
        data={memoryHistory}
        timestamps={timestamps}
        color="violet"
        maxValue={100}
        unit="%"
        viewAllLink="/observe/resources"
        currentColor="text-violet-400"
      />

      {/* Network I/O Chart */}
      <NetworkChartCard
        sendData={networkSendHistory}
        receiveData={networkReceiveHistory}
        timestamps={timestamps}
        viewAllLink="/observe/resources"
      />

      {/* Disk Usage Chart */}
      <ChartCard
        title="Disk Usage"
        icon={<FaHdd className="text-amber-400" />}
        data={diskHistory}
        timestamps={timestamps}
        color="amber"
        maxValue={100}
        unit="%"
        viewAllLink="/observe/resources"
        currentColor="text-amber-400"
      />
    </div>
  );
};
