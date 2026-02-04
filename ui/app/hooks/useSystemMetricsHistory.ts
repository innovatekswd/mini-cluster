import { useState, useEffect, useCallback, useRef } from "react";
import { metricsService, type SystemMetricsSnapshot } from "~/services/metricsService";

const MAX_HISTORY_POINTS = 30; // Keep last 30 data points for sparklines
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

export interface SystemMetricsHistory {
  current: SystemMetricsSnapshot | null;
  cpuHistory: number[];
  memoryHistory: number[];
  diskHistory: number[];
  networkSendHistory: number[];
  networkReceiveHistory: number[];
  processCountHistory: number[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const mountedRef = useRef(true);

  const addToHistory = useCallback((arr: number[], value: number): number[] => {
    const newArr = [...arr, value];
    if (newArr.length > MAX_HISTORY_POINTS) {
      return newArr.slice(-MAX_HISTORY_POINTS);
    }
    return newArr;
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await metricsService.getSystemMetrics();
      
      if (!mountedRef.current) return;
      
      setCurrent(data);
      setError(null);
      
      // Update histories
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
      
    } catch (err) {
      if (!mountedRef.current) return;
      setError("Failed to fetch system metrics");
      console.error("System metrics fetch error:", err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [addToHistory]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    fetchMetrics();
    
    // Set up polling
    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMetrics]);

  return {
    current,
    cpuHistory,
    memoryHistory,
    diskHistory,
    networkSendHistory,
    networkReceiveHistory,
    processCountHistory,
    isLoading,
    error,
  };
}
