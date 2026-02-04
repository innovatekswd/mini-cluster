import React, { memo } from "react";
import { type Service } from "~/types/Service";
import { FaPlay, FaStop, FaRedo, FaSpinner } from "react-icons/fa";
import {
  useAppStatusQuery,
  useAppControlMutation,
} from "../hooks/useServiceQueries";
import { useLogContext } from "../context/LogContext";

type ServiceControlProps = {
  service: Service;
};

export const ServiceControl = memo<ServiceControlProps>(({ service }) => {
  const { data: statusData } = useAppStatusQuery(service.id);
  const status =
    typeof statusData === "object" && statusData !== null
      ? (statusData as { status?: string }).status ?? "Unknown"
      : statusData || "Unknown";
  const { clearLogs } = useLogContext();

  const controlServiceMutation = useAppControlMutation({
    onMutate: async ({ action }) => {
      // Clear logs immediately when starting or restarting
      if (action === "start" || action === "restart") {
        clearLogs(service.id);
      }
    },
  });

  const handleAction = (action: "start" | "stop" | "restart") => {
    controlServiceMutation.mutate({ appId: service.id, appName: service.name, action });
  };

  const loading = controlServiceMutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Conditionally render controls based on the service's status */}
        {status !== "Running" && (
          <button
            type="button"
            aria-label={`Start service ${service.id}`}
            onClick={() => handleAction("start")}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center hover:bg-green-700 disabled:opacity-50 transition-all duration-300"
          >
            {loading ? (
              <FaSpinner className="animate-spin text-white" />
            ) : (
              <FaPlay className="text-white" />
            )}
          </button>
        )}

        {status === "Running" && (
          <button
            type="button"
            aria-label={`Stop service ${service.id}`}
            onClick={() => handleAction("stop")}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 disabled:opacity-50 transition-all duration-300"
          >
            {loading ? (
              <FaSpinner className="animate-spin text-white" />
            ) : (
              <FaStop className="text-white" />
            )}
          </button>
        )}

        <button
          type="button"
          aria-label={`Restart service ${service.id}`}
          onClick={() => handleAction("restart")}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center hover:bg-yellow-700 disabled:opacity-50 transition-all duration-300"
        >
          {loading ? (
            <FaSpinner className="animate-spin text-white" />
          ) : (
            <FaRedo className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
});

ServiceControl.displayName = "ServiceControl";
