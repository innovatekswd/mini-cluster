import { useState, useEffect, useCallback, useRef } from "react";
import { metricsService, type SystemMetricsSnapshot, type SystemMetricsHistory as BackendMetricsHistory } from "~/services/metricsService";

const MAX_HISTORY_POINTS = 60; // Keep last 60 data points for charts
const MIN_HISTORY_POINTS = 50; // Minimum points to request from backend on init
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

export interface SystemMetricsHistory {
  current: SystemMetricsSnapshot | null;
  cpuHistory: number[];
  memoryHistory: number[];
  diskHistory: number[];
  networkSendHistory: number[];
  networkReceiveHistory: number[];
  processCountHistory: number[];
  timestamps: string[];
  isLoading: boolean;
  error: string | null;
}

export function useSystemMetricsHistory(): SystemMetricsHistory {
  const [current, setCurrent] = useState<SystemMetricsSnapshot | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const [networkSendHistory, setNetworkSendHistory] = useState<number[]>([]);
  const [networkReceiveHistory, setNetworkReceiveHistory] = useState<number[]>([]);
  const [processCountHistory, setProcessCountHistory] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  const addToHistory = useCallback((arr: number[], value: number): number[] => {
    const newArr = [...arr, value];
    if (newArr.length > MAX_HISTORY_POINTS) {
      return newArr.slice(-MAX_HISTORY_POINTS);
    }
    return newArr;
  }, []);

  const addTimestamp = useCallback((arr: string[], value: string): string[] => {
    const newArr = [...arr, value];
    if (newArr.length > MAX_HISTORY_POINTS) {
      return newArr.slice(-MAX_HISTORY_POINTS);
    }
    return newArr;
  }, []);

  // Load historical data from backend on mount
  const loadHistoricalData = useCallback(async () => {
    try {
      // Request slightly longer time range to ensure we get MIN_HISTORY_POINTS
      // Backend stores at ~5s intervals, so 50 points = 250s = ~4.2 minutes
      const from = new Date(Date.now() - 6 * 60 * 1000); // Last 6 minutes
      const historyData = await metricsService.getSystemMetricsHistory(from, new Date(), MAX_HISTORY_POINTS);
      
      if (!mountedRef.current) return;

      if (historyData && historyData.length > 0) {
        // Populate histories from backend data
        setCpuHistory(historyData.map(d => d.cpuUsagePercent));
        setMemoryHistory(historyData.map(d => d.memoryUsagePercent));
        
        // Calculate disk percent from total/used
        setDiskHistory(historyData.map(d => d.diskUsagePercent));
        
        // Network rates (normalized to MB/s)
        setNetworkSendHistory(historyData.map(d => d.networkSendRate / (1024 * 1024)));
        setNetworkReceiveHistory(historyData.map(d => d.networkReceiveRate / (1024 * 1024)));
        
        setProcessCountHistory(historyData.map(d => d.totalProcesses));
        setTimestamps(historyData.map(d => d.timestamp));
      }
      
      initializedRef.current = true;
    } catch (err) {
      console.warn("Failed to load historical metrics, starting fresh:", err);
      initializedRef.current = true;
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await metricsService.getSystemMetrics();
      
      if (!mountedRef.current) return;
      
      setCurrent(data);
      setError(null);
      
      // Only update histories if we've initialized
      if (initializedRef.current) {
        setCpuHistory(prev => addToHistory(prev, data.cpuUsagePercent));
        setMemoryHistory(prev => addToHistory(prev, data.memoryUsagePercent));
        
        // Use first disk's usage percent, or 0 if none
        const diskPercent = data.disks[0]?.usagePercent ?? 0;
        setDiskHistory(prev => addToHistory(prev, diskPercent));
        
        // Network rates (normalized to MB/s for better visualization)
        const sendMBps = data.totalNetworkSendRate / (1024 * 1024);
        const recvMBps = data.totalNetworkReceiveRate / (1024 * 1024);
        setNetworkSendHistory(prev => addToHistory(prev, sendMBps));
        setNetworkReceiveHistory(prev => addToHistory(prev, recvMBps));
        
        setProcessCountHistory(prev => addToHistory(prev, data.totalProcesses));
        setTimestamps(prev => addTimestamp(prev, data.timestamp));
      }
      
    } catch (err) {
      if (!mountedRef.current) return;
      setError("Failed to fetch system metrics");
      console.error("System metrics fetch error:", err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [addToHistory, addTimestamp]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Load historical data first, then start polling
    const init = async () => {
      await loadHistoricalData();
      await fetchMetrics();
      
      // Set up polling
      const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
      
      return () => {
        clearInterval(interval);
      };
    };
    
    let cleanup: (() => void) | void;
    init().then(c => { cleanup = c; });
    
    return () => {
      mountedRef.current = false;
      if (cleanup) cleanup();
    };
  }, [loadHistoricalData, fetchMetrics]);

  return {
    current,
    cpuHistory,
    memoryHistory,
    diskHistory,
    networkSendHistory,
    networkReceiveHistory,
    processCountHistory,
    timestamps,
    isLoading,
    error,
  };
}
