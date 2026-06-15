import React from "react";
import { FaClock, FaSync, FaPlay, FaPause } from "react-icons/fa";
import { useCockpitContext, type TimeRange } from "~/context/CockpitContext";

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '5m', label: 'Last 5m' },
  { value: '15m', label: 'Last 15m' },
  { value: '1h', label: 'Last 1h' },
  { value: '6h', label: 'Last 6h' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
];

const REFRESH_RATE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 5000, label: '5s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1m' },
];

// ============================================================================
// Component
// ============================================================================

export const GlobalContextBar: React.FC = () => {
  const {
    timeRange,
    refreshRate,
    isLive,
    setTimeRange,
    setRefreshRate,
    toggleLive,
  } = useCockpitContext();

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newRange: TimeRange = { type: 'relative', value };
    setTimeRange(newRange);
  };

  const handleRefreshRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setRefreshRate(value);
  };

  return (
    <div className="glass-card border border-slate-700/50 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
      {/* Time Range Picker */}
      <div className="flex items-center gap-2">
        <FaClock className="text-slate-400 text-sm" />
        <select
          value={timeRange.value}
          onChange={handleTimeRangeChange}
          className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />

      {/* Refresh Rate Selector */}
      <div className="flex items-center gap-2">
        <FaSync className="text-slate-400 text-sm" />
        <select
          value={refreshRate}
          onChange={handleRefreshRateChange}
          className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
        >
          {REFRESH_RATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />

      {/* Live Mode Toggle */}
      <button
        onClick={toggleLive}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isLive
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
            : 'bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:bg-slate-700'
        }`}
        title={isLive ? 'Live mode: Click to freeze' : 'Frozen: Click to go live'}
      >
        {isLive ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <FaPlay className="text-xs" />
            <span>LIVE</span>
          </>
        ) : (
          <>
            <FaPause className="text-xs" />
            <span>FROZEN</span>
          </>
        )}
      </button>
    </div>
  );
};
