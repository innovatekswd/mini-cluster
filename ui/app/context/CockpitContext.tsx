import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// ============================================================================
// Types
// ============================================================================

export interface TimeRange {
  type: 'relative' | 'absolute';
  value: string;  // '5m' | '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom'
  from?: Date;    // Only for 'absolute' type
  to?: Date;      // Only for 'absolute' type
}

export interface CockpitContextType {
  machineId: string;              // 'local' in single-machine, selected machine in multi-machine
  timeRange: TimeRange;
  refreshRate: number;            // milliseconds, 0 = off
  isLive: boolean;                // sliding window vs frozen
  setMachine: (id: string) => void;
  setTimeRange: (range: TimeRange) => void;
  setRefreshRate: (ms: number) => void;
  toggleLive: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MACHINE_ID = 'local';
const DEFAULT_TIME_RANGE: TimeRange = { type: 'relative', value: '1h' };
const DEFAULT_REFRESH_RATE = 5000; // 5 seconds
const DEFAULT_IS_LIVE = true;

// Valid time range values
const VALID_TIME_RANGES = ['5m', '15m', '1h', '6h', '24h', '7d', '30d', 'custom'] as const;
type TimeRangeValue = typeof VALID_TIME_RANGES[number];

// Valid refresh rate values (in milliseconds)
const VALID_REFRESH_RATES = [0, 5000, 15000, 30000, 60000] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert TimeRange to Date objects for API calls
 */
export function getTimeRangeDates(timeRange: TimeRange): { from: Date; to: Date } {
  const to = new Date();
  let from: Date;

  if (timeRange.type === 'absolute') {
    return {
      from: timeRange.from || new Date(to.getTime() - 60 * 60 * 1000),
      to: timeRange.to || to
    };
  }

  // Relative time range
  const minutesMap: Record<string, number> = {
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200,
  };

  const minutes = minutesMap[timeRange.value] || 60;
  from = new Date(to.getTime() - minutes * 60 * 1000);
  return { from, to };
}

/**
 * Convert refresh rate ms to URL-friendly string
 */
export function refreshRateToString(ms: number): string {
  if (ms === 0) return 'off';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${ms / 1000}s`;
  return `${ms / 60000}m`;
}

/**
 * Parse URL refresh rate string to ms
 */
export function parseRefreshRate(str: string): number {
  if (str === 'off') return 0;
  if (str.endsWith('ms')) return parseInt(str) || 5000;
  if (str.endsWith('s')) return (parseInt(str) || 5) * 1000;
  if (str.endsWith('m')) return (parseInt(str) || 1) * 60 * 1000;
  return 5000; // default
}

/**
 * Parse URL time range string to TimeRange object
 */
function parseTimeRange(str: string | null): TimeRange {
  if (!str) return DEFAULT_TIME_RANGE;

  // Check if it's a valid relative time range
  if (VALID_TIME_RANGES.includes(str as TimeRangeValue)) {
    return { type: 'relative', value: str };
  }

  // Could be an absolute range in format "from:to" (ISO strings)
  if (str.includes(':')) {
    const [fromStr, toStr] = str.split(':');
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return { type: 'absolute', value: 'custom', from, to };
    }
  }

  return DEFAULT_TIME_RANGE;
}

/**
 * Serialize TimeRange to URL string
 */
function timeRangeToString(timeRange: TimeRange): string {
  if (timeRange.type === 'absolute' && timeRange.from && timeRange.to) {
    return `${timeRange.from.toISOString()}:${timeRange.to.toISOString()}`;
  }
  return timeRange.value;
}

/**
 * Parse boolean from URL string
 */
function parseBoolean(str: string | null, defaultValue: boolean): boolean {
  if (str === null) return defaultValue;
  return str === 'true';
}

// ============================================================================
// Context
// ============================================================================

const CockpitContext = createContext<CockpitContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export const CockpitContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params or defaults
  const [machineId, setMachineIdState] = useState<string>(() => {
    return searchParams.get('machine') || DEFAULT_MACHINE_ID;
  });

  const [timeRange, setTimeRangeState] = useState<TimeRange>(() => {
    return parseTimeRange(searchParams.get('range'));
  });

  const [refreshRate, setRefreshRateState] = useState<number>(() => {
    const rateStr = searchParams.get('refresh');
    return rateStr ? parseRefreshRate(rateStr) : DEFAULT_REFRESH_RATE;
  });

  const [isLive, setIsLiveState] = useState<boolean>(() => {
    return parseBoolean(searchParams.get('live'), DEFAULT_IS_LIVE);
  });

  // Sync state to URL (debounced to avoid excessive re-renders)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newParams = new URLSearchParams();

      if (machineId !== DEFAULT_MACHINE_ID) {
        newParams.set('machine', machineId);
      }

      const rangeStr = timeRangeToString(timeRange);
      if (rangeStr !== timeRangeToString(DEFAULT_TIME_RANGE)) {
        newParams.set('range', rangeStr);
      }

      if (refreshRate !== DEFAULT_REFRESH_RATE) {
        newParams.set('refresh', refreshRateToString(refreshRate));
      }

      if (isLive !== DEFAULT_IS_LIVE) {
        newParams.set('live', String(isLive));
      }

      // Only update if params changed
      const currentParams = searchParams.toString();
      const updatedParams = newParams.toString();
      if (currentParams !== updatedParams) {
        setSearchParams(newParams, { replace: true });
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [machineId, timeRange, refreshRate, isLive, searchParams, setSearchParams]);

  // Setters with validation
  const setMachine = useCallback((id: string) => {
    setMachineIdState(id);
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    setTimeRangeState(range);
  }, []);

  const setRefreshRate = useCallback((ms: number) => {
    // Validate refresh rate
    if (VALID_REFRESH_RATES.includes(ms as typeof VALID_REFRESH_RATES[number])) {
      setRefreshRateState(ms);
    } else {
      console.warn(`Invalid refresh rate: ${ms}. Using default.`);
      setRefreshRateState(DEFAULT_REFRESH_RATE);
    }
  }, []);

  const toggleLive = useCallback(() => {
    setIsLiveState(prev => !prev);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<CockpitContextType>(() => ({
    machineId,
    timeRange,
    refreshRate,
    isLive,
    setMachine,
    setTimeRange,
    setRefreshRate,
    toggleLive,
  }), [machineId, timeRange, refreshRate, isLive, setMachine, setTimeRange, setRefreshRate, toggleLive]);

  return (
    <CockpitContext.Provider value={value}>
      {children}
    </CockpitContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export const useCockpitContext = (): CockpitContextType => {
  const context = useContext(CockpitContext);
  if (!context) {
    throw new Error("useCockpitContext must be used within a CockpitContextProvider");
  }
  return context;
};

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get time range as Date objects (convenience for API calls)
 */
export const useTimeRangeDates = (): { from: Date; to: Date } => {
  const { timeRange } = useCockpitContext();
  return useMemo(() => getTimeRangeDates(timeRange), [timeRange]);
};

/**
 * Hook to check if cockpit is in single-machine mode
 * In single-machine mode, machineId is always 'local'
 */
export const useIsSingleMachine = (): boolean => {
  const { machineId } = useCockpitContext();
  return machineId === 'local';
};
