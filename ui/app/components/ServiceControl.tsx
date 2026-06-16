import React, { memo } from "react";
import { type Service } from "~/types/Service";
import { FaPlay, FaStop, FaRedo, FaSpinner } from "react-icons/fa";
import { useAppStatusQuery, useAppControlMutation } from "../hooks/useServiceQueries";
import { useLogContext } from "../context/LogContext";

type ServiceControlProps = {
  service: Service;
  onAction?: () => void;
};

export const ServiceControl = memo<ServiceControlProps>(({ service, onAction }) => {
  const { data: statusData } = useAppStatusQuery(service.id);
  const status =
    typeof statusData === "object" && statusData !== null
      ? (statusData as { status?: string }).status ?? "Unknown"
      : statusData || "Unknown";
  const { clearLogs } = useLogContext();

  const controlServiceMutation = useAppControlMutation({
    onMutate: async ({ action }) => {
      if (action === "start" || action === "restart") clearLogs(service.id);
    },
  });

  const handleAction = (action: "start" | "stop" | "restart") => {
    controlServiceMutation.mutate(
      { appId: service.id, appName: service.name, action },
      { onSettled: () => onAction?.() }
    );
  };

  const loading = controlServiceMutation.isPending;

  const btnBase = "flex items-center justify-center w-7 h-7 rounded-lg transition-colors disabled:opacity-40";

  return (
    <div className="flex items-center gap-1">
      {status !== "Running" ? (
        <button
          type="button"
          aria-label={`Start ${service.name}`}
          onClick={() => handleAction("start")}
          disabled={loading}
          className={`${btnBase} bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400`}
          title="Start"
        >
          {loading ? <FaSpinner size={11} className="animate-spin" /> : <FaPlay size={11} />}
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Stop ${service.name}`}
          onClick={() => handleAction("stop")}
          disabled={loading}
          className={`${btnBase} bg-rose-500/15 hover:bg-rose-500/30 text-rose-400`}
          title="Stop"
        >
          {loading ? <FaSpinner size={11} className="animate-spin" /> : <FaStop size={11} />}
        </button>
      )}
      <button
        type="button"
        aria-label={`Restart ${service.name}`}
        onClick={() => handleAction("restart")}
        disabled={loading}
        className={`${btnBase} bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200`}
        title="Restart"
      >
        {loading ? <FaSpinner size={11} className="animate-spin" /> : <FaRedo size={11} />}
      </button>
    </div>
  );
});

ServiceControl.displayName = "ServiceControl";
