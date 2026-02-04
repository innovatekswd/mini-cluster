import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serviceService } from "~/services/appService";
import { appQueryKeys } from "~/hooks/useServiceQueries";
import { setBackendConnectionStatus } from "~/lib/queryClient";

type ConnectionStatus = "connected" | "connecting" | "disconnected";
type ConnectionCallback = () => void;

interface ConnectionContextType {
  status: ConnectionStatus;
  lastOnline: Date | null;
  checkConnection: () => Promise<void>;
  isChecking: boolean;
  onDisconnect: (callback: ConnectionCallback) => () => void;
  onReconnect: (callback: ConnectionCallback) => () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Health check interval (10 seconds)
const HEALTH_CHECK_INTERVAL = 10000;

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const isCheckingRef = useRef(false);
  const queryClientRef = useRef(useQueryClient());
  const disconnectCallbacksRef = useRef<Set<ConnectionCallback>>(new Set());
  const reconnectCallbacksRef = useRef<Set<ConnectionCallback>>(new Set());

  // Subscribe to disconnect events
  const onDisconnect = useCallback((callback: ConnectionCallback) => {
    disconnectCallbacksRef.current.add(callback);
    return () => {
      disconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  // Subscribe to reconnect events
  const onReconnect = useCallback((callback: ConnectionCallback) => {
    reconnectCallbacksRef.current.add(callback);
    return () => {
      reconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  const checkConnection = useCallback(async () => {
    if (isCheckingRef.current) return; // Prevent concurrent checks
    isCheckingRef.current = true;
    setIsChecking(true);
    try {
      await serviceService.checkHealth();
      const wasDisconnected = wasDisconnectedRef.current;
      
      setStatus("connected");
      setBackendConnectionStatus(true); // Update global connection status
      setLastOnline(new Date());
      wasDisconnectedRef.current = false;

      // If we just reconnected after being disconnected, notify listeners and refresh data
      if (wasDisconnected) {
        // Notify all reconnect listeners
        reconnectCallbacksRef.current.forEach(callback => callback());
        // Invalidate all app-related queries to force refresh
        queryClientRef.current.invalidateQueries({ queryKey: appQueryKeys.all });
        // Also invalidate any status queries
        queryClientRef.current.invalidateQueries({ queryKey: ["apps", "detail"] });
      }
    } catch (error) {
      // Track if this is a new disconnection
      const wasConnected = !wasDisconnectedRef.current;
      setStatus("disconnected");
      setBackendConnectionStatus(false); // Update global connection status
      wasDisconnectedRef.current = true;
      
      // Cancel all in-flight queries on first disconnect to prevent flickering
      if (wasConnected) {
        queryClientRef.current.cancelQueries();
        disconnectCallbacksRef.current.forEach(callback => callback());
      }
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, []); // No dependencies - uses refs

  // Initial health check and periodic checks
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, HEALTH_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return (
    <ConnectionContext.Provider value={{ status, lastOnline, checkConnection, isChecking, onDisconnect, onReconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = (): ConnectionContextType => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
};
