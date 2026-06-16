import { useEffect, useRef } from "react";
import { useSignalRConnection, useSignalRServiceGroup } from "../context/SignalRConnectionContext";
import { HubConnectionState } from "@microsoft/signalr";
import { useAppStatusContext } from "../context/AppStatusContext";

/** Grace period (ms) to stay in SignalR group after service stops,
 *  allowing final log lines to arrive before we unsubscribe. */
const LEAVE_GRACE_MS = 3_000;

export function useLogStream(serviceId: string) {
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { statuses } = useAppStatusContext();
  
  // Get status directly from batch cache for immediate reactivity
  const serviceStatus = statuses[serviceId] || "Unknown";
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRef = useRef(false);
  
  useEffect(() => {
    if (!serviceId) return;
    
    const isRunning = serviceStatus === "Running" || serviceStatus === "Started";
    
    if (isRunning) {
      // Clear any pending grace timer — service is alive
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      
      // Start connection if needed
      if (connection.state === HubConnectionState.Disconnected) {
        connection.start().catch(console.error);
      }
      
      // Join service group (idempotent on server side)
      if (connection.state === HubConnectionState.Connected && !joinedRef.current) {
        joinServiceGroup(serviceId);
        joinedRef.current = true;
      }
    } else if (joinedRef.current) {
      // Service stopped — start grace timer instead of leaving immediately
      if (!graceTimerRef.current) {
        graceTimerRef.current = setTimeout(() => {
          leaveServiceGroup(serviceId);
          joinedRef.current = false;
          graceTimerRef.current = null;
        }, LEAVE_GRACE_MS);
      }
    }
    
    return () => {
      // Cleanup: only clear timers on unmount, don't leave group
      // (the grace timer handles the leave)
    };
  }, [serviceId, connection, joinServiceGroup, leaveServiceGroup, serviceStatus]);

  // True cleanup: leave group on unmount
  useEffect(() => {
    return () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
      }
      if (joinedRef.current && serviceId) {
        leaveServiceGroup(serviceId);
        joinedRef.current = false;
      }
    };
  }, [serviceId, leaveServiceGroup]);
}
