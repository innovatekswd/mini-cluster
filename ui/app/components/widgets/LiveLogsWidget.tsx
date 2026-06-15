import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaPlay, FaPause, FaArrowDown, FaFilter } from "react-icons/fa";
import { useAppsQuery } from "~/hooks/useServiceQueries";

// ============================================================================
// Types
// ============================================================================

export interface LogEntry {
  timestamp: string;
  serviceId: string;
  serviceName: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
}

type LogLevel = LogEntry['level'];

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'text-slate-400',
  INFO: 'text-emerald-400',
  WARN: 'text-amber-400',
  ERROR: 'text-rose-400',
  FATAL: 'text-rose-500 font-bold',
};

const LOG_LEVEL_OPTIONS: { value: LogLevel | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Levels' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'FATAL', label: 'FATAL' },
];

const MAX_LOG_ENTRIES = 1000;

// ============================================================================
// Helper Functions
// ============================================================================

function formatLogTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

interface LogEntryRowProps {
  entry: LogEntry;
}

const LogEntryRow: React.FC<LogEntryRowProps> = ({ entry }) => {
  const levelColor = LOG_LEVEL_COLORS[entry.level];

  return (
    <div className="flex items-start gap-2 py-1 px-2 hover:bg-slate-700/30 rounded text-xs font-mono">
      <span className="text-slate-500 whitespace-nowrap">{formatLogTimestamp(entry.timestamp)}</span>
      <span className="text-cyan-400 whitespace-nowrap min-w-[80px]">[{entry.serviceName}]</span>
      <span className={`${levelColor} whitespace-nowrap min-w-[50px]`}>{entry.level}</span>
      <span className="text-slate-200 break-all">{entry.message}</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const LiveLogsWidget: React.FC = () => {
  const { data: apps = [] } = useAppsQuery();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Local state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;

      // Service filter
      if (serviceFilter !== 'ALL' && log.serviceId !== serviceFilter) return false;

      // Search filter
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [logs, levelFilter, serviceFilter, searchQuery]);

  // Auto-scroll behavior
  useEffect(() => {
    if (isPaused || isHovering) return;

    const container = logContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [filteredLogs, isPaused, isHovering]);

  // Simulate incoming logs (placeholder - will be replaced with SignalR integration)
  // TODO: Replace with actual SignalR machine-wide log stream when backend supports it
  useEffect(() => {
    // This is a placeholder for demonstration
    // In production, this would be replaced with SignalR subscription
    const sampleLogs: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        serviceId: 'api',
        serviceName: 'api',
        level: 'INFO',
        message: 'Request received: GET /api/health',
      },
      {
        timestamp: new Date(Date.now() - 1000).toISOString(),
        serviceId: 'worker',
        serviceName: 'worker',
        level: 'DEBUG',
        message: 'Processing background job #1234',
      },
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        serviceId: 'database',
        serviceName: 'database',
        level: 'WARN',
        message: 'Slow query detected: 2.3s',
      },
    ];

    setLogs(sampleLogs);

    // Note: Actual SignalR integration would look like:
    // const connection = useSignalRConnection();
    // connection.on('ReceiveLog', (logData) => {
    //   setLogs(prev => [...prev.slice(-MAX_LOG_ENTRIES + 1), logData]);
    // });
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleExportLogs = () => {
    const logText = filteredLogs
      .map((log) => `${log.timestamp}\t${log.serviceName}\t${log.level}\t${log.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-700/50">
        <FaFilter className="text-slate-400 text-sm" />

        {/* Level Filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'ALL')}
          className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          {LOG_LEVEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Service Filter */}
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="ALL">All Services</option>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-800/50 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 flex-1 min-w-[120px]"
        />

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded transition-colors ${
              isPaused
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
            title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {isPaused ? <FaPlay className="text-xs" /> : <FaPause className="text-xs" />}
          </button>
          <button
            onClick={() => {
              const container = logContainerRef.current;
              if (container) {
                container.scrollTo({
                  top: container.scrollHeight,
                  behavior: 'smooth',
                });
              }
            }}
            className="p-1.5 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
            title="Scroll to bottom"
          >
            <FaArrowDown className="text-xs" />
          </button>
          <button
            onClick={handleClearLogs}
            className="px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExportLogs}
            className="px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-2 space-y-0.5 min-h-[200px] max-h-[400px]"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {logs.length === 0 ? (
              <div className="text-center">
                <p>No logs available</p>
                <p className="text-xs mt-1 text-slate-600">
                  Logs will appear here when services are running
                </p>
              </div>
            ) : (
              <p>No logs match the current filters</p>
            )}
          </div>
        ) : (
          filteredLogs.map((log, index) => <LogEntryRow key={index} entry={log} />)
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
        <span>
          Showing {filteredLogs.length} of {logs.length} entries
        </span>
        {isPaused && (
          <span className="flex items-center gap-1 text-amber-400">
            <FaPause className="text-[10px]" />
            Paused
          </span>
        )}
      </div>
    </div>
  );
};
