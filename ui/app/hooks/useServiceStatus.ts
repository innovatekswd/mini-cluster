import { useEffect, useCallback, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useAppStatusContext } from "../context/AppStatusContext";
import { useSignalRConnection, useSignalRReconnect, useSignalRServiceGroup } from "../context/SignalRConnectionContext";
import { useConnection } from "../context/ConnectionContext";

export function useServiceStatus(serviceId: string) {
  const { updateStatus, statuses, refetch } = useAppStatusContext();

  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const onSignalRReconnect = useSignalRReconnect();
  const { onReconnect: onBackendReconnect } = useConnection();

  // Get status from batch cache
  const status = statuses[serviceId] || "Unknown";

  // Exponential backoff for starting the connection
  const startAttemptRef = useRef(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConnectionWithBackoff = useCallback(() => {
    if (connection.state !== HubConnectionState.Disconnected) return;
    const attempt = startAttemptRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
    startAttemptRef.current += 1;

    startTimerRef.current = setTimeout(() => {
      connection
        .start()
        .then(() => {
          // Reset attempt counter on success
          startAttemptRef.current = 0;
        })
        .catch((err) => {
          console.error("Error starting SignalR connection:", err);
          // Retry with backoff
          startConnectionWithBackoff();
        });
    }, delay);
  }, [connection]);

  useEffect(() => {
    if (!serviceId) return;

    // Start connection if needed (with backoff retry)
    if (connection.state === HubConnectionState.Disconnected) {
      startConnectionWithBackoff();
    }

    // Join service group for status updates if running
    const isRunning = status === "Running" || status === "Started";
    
    if (connection.state === HubConnectionState.Connected && isRunning) {
      joinServiceGroup(serviceId);
    }

    // Listen for status updates via SignalR
    const handleStatusUpdate = (updatedServiceId: string, newStatus: any) => {
      if (updatedServiceId === serviceId) {
        const statusString =
          typeof newStatus === "object" && newStatus !== null
            ? newStatus.status
            : newStatus;
        updateStatus(serviceId, statusString);
        
        // If service stopped, leave the group
        if (statusString === "Stopped" || statusString === "Exited") {
          leaveServiceGroup(serviceId);
        }
      }
    };

    connection.on("StatusUpdated", handleStatusUpdate);

    // Subscribe to SignalR reconnect events to refresh status
    const unsubscribeSignalRReconnect = onSignalRReconnect(() => {
      refetch();
    });

    // Subscribe to backend HTTP reconnect events to refresh status
    const unsubscribeBackendReconnect = onBackendReconnect(() => {
      refetch();
    });

    // Cleanup
    return () => {
      connection.off("StatusUpdated", handleStatusUpdate);
      unsubscribeSignalRReconnect();
      unsubscribeBackendReconnect();
      // Leave service group when unmounting
      leaveServiceGroup(serviceId);
      // Cancel any pending start retries
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, [serviceId, connection, joinServiceGroup, leaveServiceGroup, onSignalRReconnect, onBackendReconnect, status, updateStatus, refetch, startConnectionWithBackoff]);

  return status;
}
