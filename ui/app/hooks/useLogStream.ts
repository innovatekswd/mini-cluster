import { useEffect } from "react";
import { useSignalRConnection, useSignalRServiceGroup } from "../context/SignalRConnectionContext";
import { HubConnectionState } from "@microsoft/signalr";
import { useAppStatusContext } from "../context/AppStatusContext";

export function useLogStream(serviceId: string) {
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { statuses } = useAppStatusContext();
  
  // Get status directly from batch cache for immediate reactivity
  const serviceStatus = statuses[serviceId] || "Unknown";
  
  useEffect(() => {
    if (!serviceId) return;
    
    // Only establish SignalR connection for running services
    const isRunning = serviceStatus === "Running" || serviceStatus === "Started";
    if (!isRunning) {
      return;
    }
    
    // Start connection if needed
    if (connection.state === HubConnectionState.Disconnected) {
      connection.start().catch(console.error);
    }
    
    // Join service group
    if (connection.state === HubConnectionState.Connected) {
      joinServiceGroup(serviceId);
    }
    
    return () => {
      // Leave service group when unmounting
      leaveServiceGroup(serviceId);
    };
  }, [serviceId, connection, joinServiceGroup, leaveServiceGroup, serviceStatus]);
}
