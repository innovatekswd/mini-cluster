import { useEffect, useCallback } from "react";
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

  useEffect(() => {
    if (!serviceId) return;

    // Start connection if needed
    if (connection.state === HubConnectionState.Disconnected) {
      connection.start().catch((err) =>
        console.error("Error starting SignalR connection:", err)
      );
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
    };
  }, [serviceId, connection, joinServiceGroup, leaveServiceGroup, onSignalRReconnect, onBackendReconnect, status, updateStatus, refetch]);

  return status;
}
