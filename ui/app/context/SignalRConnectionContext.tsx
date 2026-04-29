import React, { createContext, useContext, useRef, useCallback, useState } from "react";
import { HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { useLogContext, type LogEntry } from "./LogContext";

type ReconnectCallback = () => void;
type JoinedGroups = Set<string>;

type SignalRConnectionContextType = {
  getConnection: () => HubConnection;
  joinServiceGroup: (serviceId: string) => Promise<void>;
  leaveServiceGroup: (serviceId: string) => Promise<void>;
  onReconnect: (callback: ReconnectCallback) => () => void;
  isConnected: boolean;
};

const SignalRConnectionContext = createContext<SignalRConnectionContextType | undefined>(undefined);

export const SignalRConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connectionRef = useRef<HubConnection | null>(null);
  const joinedGroupsRef = useRef<JoinedGroups>(new Set());
  const reconnectCallbacksRef = useRef<Set<ReconnectCallback>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const { addLog, addStructuredLog, addStructuredLogs, setCurrentSessionId } = useLogContext();

  const notifyReconnect = useCallback(() => {
    reconnectCallbacksRef.current.forEach(callback => callback());
  }, []);

  const onReconnect = useCallback((callback: ReconnectCallback) => {
    reconnectCallbacksRef.current.add(callback);
    return () => {
      reconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  const startConnection = useCallback((connection: HubConnection) => {
    connection.start().then(() => {
      setIsConnected(true);
    }).catch(err => {
      console.error("SignalR connection error:", err);
      setIsConnected(false);
    });
  }, []);

  const getConnection = useCallback((): HubConnection => {
    if (!connectionRef.current) {
      const connection = new HubConnectionBuilder()
        .withUrl("/loghub")
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff capped at 60s — retries indefinitely
            return Math.min(1000 * 2 ** retryContext.previousRetryCount, 60_000);
          }
        })
        .withServerTimeout(120_000) // Match server's 120s ClientTimeoutInterval
        .withKeepAliveInterval(15_000) // Match server's 15s KeepAliveInterval
        .build();
      connectionRef.current = connection;

      startConnection(connection);

      connection.onreconnecting(() => {
        setIsConnected(false);
      });

      connection.onreconnected(async () => {
        setIsConnected(true);
        // Rejoin all previously joined groups
        const groupsToRejoin = Array.from(joinedGroupsRef.current);
        for (const serviceId of groupsToRejoin) {
          try {
            await connection.invoke("JoinAppGroup", serviceId);
          } catch (err) {
            console.error("Failed to rejoin group", serviceId, err);
          }
        }
        notifyReconnect();
      });

      connection.onclose(() => {
        setIsConnected(false);
        // Auto-reconnect after onclose — the built-in retry policy exhausted
        // means the connection truly closed. Restart after a short delay.
        setTimeout(() => {
          if (connectionRef.current === connection) {
            startConnection(connection);
          }
        }, 5_000);
      });

      // Set up log handler — structured entries
      connection.on("ReceiveLog", (logData: any) => {
        if (typeof logData === "object" && logData !== null) {
          const serviceId = logData.serviceId || logData.appId || "";
          if (serviceId) {
            const entry: LogEntry = {
              timestamp: logData.timestamp || new Date().toISOString(),
              type: logData.type === "stderr" ? "stderr" : "stdout",
              line: logData.line || "",
              sessionId: logData.sessionId || undefined,
            };
            addStructuredLog(serviceId, entry);
            if (entry.sessionId) {
              setCurrentSessionId(serviceId, entry.sessionId);
            }
          }
        } else {
          // Legacy fallback
          const logLine = String(logData);
          addLog("", logLine);
        }
      });

      // Replay buffered logs on join (batch)
      connection.on("ReplayLogs", (logEntries: any[]) => {
        if (!Array.isArray(logEntries) || logEntries.length === 0) return;
        const serviceId = logEntries[0]?.serviceId || "";
        if (!serviceId) return;

        const entries: LogEntry[] = logEntries.map(l => ({
          timestamp: l.timestamp || new Date().toISOString(),
          type: l.type === "stderr" ? "stderr" as const : "stdout" as const,
          line: l.line || "",
          sessionId: l.sessionId || undefined,
        }));
        addStructuredLogs(serviceId, entries);
        const lastSessionId = entries[entries.length - 1]?.sessionId;
        if (lastSessionId) {
          setCurrentSessionId(serviceId, lastSessionId);
        }
      });
    }
    return connectionRef.current;
  }, [addLog, addStructuredLog, addStructuredLogs, setCurrentSessionId, notifyReconnect]);

  const joinServiceGroup = useCallback(async (serviceId: string) => {
    const connection = getConnection();
    if (connection.state === HubConnectionState.Connected) {
      try {
        await connection.invoke("JoinAppGroup", serviceId);
        joinedGroupsRef.current.add(serviceId);
      } catch (err) {
        console.error("Failed to join service group", serviceId, err);
      }
    }
  }, [getConnection]);

  const leaveServiceGroup = useCallback(async (serviceId: string) => {
    const connection = getConnection();
    // Only attempt to leave if connected, otherwise just clean up tracking
    joinedGroupsRef.current.delete(serviceId);
    if (connection.state === HubConnectionState.Connected) {
      try {
        await connection.invoke("LeaveAppGroup", serviceId);
      } catch (err) {
        // Silently ignore leave errors - connection may have closed
      }
    }
  }, [getConnection]);

  return (
    <SignalRConnectionContext.Provider value={{ getConnection, joinServiceGroup, leaveServiceGroup, onReconnect, isConnected }}>
      {children}
    </SignalRConnectionContext.Provider>
  );
};

export const useSignalRConnection = (): HubConnection => {
  const context = useContext(SignalRConnectionContext);
  if (!context) {
    throw new Error("useSignalRConnection must be used within a SignalRConnectionProvider");
  }
  return context.getConnection();
};

export const useSignalRServiceGroup = () => {
  const context = useContext(SignalRConnectionContext);
  if (!context) {
    throw new Error("useSignalRServiceGroup must be used within a SignalRConnectionProvider");
  }
  return { joinServiceGroup: context.joinServiceGroup, leaveServiceGroup: context.leaveServiceGroup };
};

export const useSignalRReconnect = () => {
  const context = useContext(SignalRConnectionContext);
  if (!context) {
    throw new Error("useSignalRReconnect must be used within a SignalRConnectionProvider");
  }
  return context.onReconnect;
};

export const useSignalRConnected = () => {
  const context = useContext(SignalRConnectionContext);
  if (!context) {
    throw new Error("useSignalRConnected must be used within a SignalRConnectionProvider");
  }
  return context.isConnected;
};

