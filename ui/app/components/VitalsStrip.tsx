import React from "react";
import { FaMicrochip, FaMemory, FaHdd, FaNetworkWired, FaExclamationTriangle } from "react-icons/fa";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";
import { formatBytesPerSecond } from "~/services/metricsService";

// ============================================================================
// Helper Functions
// ============================================================================

function getProgressColor(percent: number): string {
  if (percent >= 80) return 'bg-rose-500';
  if (percent >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressGradient(percent: number): string {
  if (percent >= 80) return 'from-rose-600 to-rose-400';
  if (percent >= 60) return 'from-amber-600 to-amber-400';
  return 'from-emerald-600 to-emerald-400';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ProgressBarProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  maxValue?: number;
  unit?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  icon,
  value,
  maxValue = 100,
  unit = '%',
}) => {
  const percent = Math.min((value / maxValue) * 100, 100);
  const colorClass = getProgressColor(percent);
  const gradientClass = getProgressGradient(percent);

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <span className="text-slate-400 text-sm">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-slate-400">{label}</span>
          <span className="text-xs font-medium text-slate-200">
            {value.toFixed(1)}{unit}
          </span>
        </div>
        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${gradientClass} rounded-full transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface NetworkRatesProps {
  sendRate: number;
  receiveRate: number;
}

const NetworkRates: React.FC<NetworkRatesProps> = ({ sendRate, receiveRate }) => {
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <FaNetworkWired className="text-slate-400 text-sm" />
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-emerald-400">↑</span>
          <span className="text-slate-200 font-medium">{formatBytesPerSecond(sendRate)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-cyan-400">↓</span>
          <span className="text-slate-200 font-medium">{formatBytesPerSecond(receiveRate)}</span>
        </span>
      </div>
    </div>
  );
};

interface ServiceCountsProps {
  total: number;
}

const ServiceCounts: React.FC<ServiceCountsProps> = ({ total }) => {
  // For now, just show total process count
  // Future: integrate with useAppsWithStatsQuery for running/stopped/failed counts
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <span className="text-xs text-slate-400">Processes:</span>
      <span className="text-xs font-medium text-slate-200">{total}</span>
    </div>
  );
};

interface AlertCountProps {
  count: number;
}

const AlertCount: React.FC<AlertCountProps> = ({ count }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
      <FaExclamationTriangle className="text-amber-400 text-xs" />
      <span className="text-xs font-medium text-amber-400">{count}</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const VitalsStrip: React.FC = () => {
  const { current, isLoading } = useSystemMetricsHistory();

  if (isLoading || !current) {
    return (
      <div className="glass-card border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-6">
        <div className="animate-pulse flex items-center gap-6 w-full">
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-4 bg-slate-700 rounded w-24" />
        </div>
      </div>
    );
  }

  // Calculate disk usage (use first disk or aggregate)
  const diskUsage = current.disks && current.disks.length > 0
    ? current.disks[0].usagePercent
    : 0;

  return (
    <div className="glass-card border border-slate-700/50 rounded-xl px-4 py-3 flex flex-wrap items-center gap-6">
      {/* CPU */}
      <ProgressBar
        label="CPU"
        icon={<FaMicrochip className="text-cyan-400" />}
        value={current.cpuUsagePercent}
      />

      {/* Memory */}
      <ProgressBar
        label="Memory"
        icon={<FaMemory className="text-violet-400" />}
        value={current.memoryUsagePercent}
      />

      {/* Disk */}
      <ProgressBar
        label="Disk"
        icon={<FaHdd className="text-amber-400" />}
        value={diskUsage}
      />

      {/* Network Rates */}
      <NetworkRates
        sendRate={current.totalNetworkSendRate}
        receiveRate={current.totalNetworkReceiveRate}
      />

      {/* Service/Process Count */}
      <ServiceCounts total={current.totalProcesses} />

      {/* Alert Count (placeholder - future enhancement) */}
      <AlertCount count={0} />
    </div>
  );
};
