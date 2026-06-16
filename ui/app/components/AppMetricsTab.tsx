import React, { useState } from "react";
import type { Service } from "~/types/Service";
import { ProcessMetrics } from "./ProcessMetrics";

interface AppMetricsTabProps {
  services: Service[];
}

export function AppMetricsTab({ services }: AppMetricsTabProps) {
  const [selectedId, setSelectedId] = useState<string>(services[0]?.id ?? "");

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <p className="text-slate-400">No services to show metrics for.</p>
        <p className="text-slate-500 text-sm mt-1">Add a service to get started.</p>
      </div>
    );
  }

  const selected = services.find(s => s.id === selectedId) ?? services[0];

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      {/* Service selector pills */}
      {services.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {services.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (selectedId || services[0].id) === s.id
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ProcessMetrics for selected service */}
      <ProcessMetrics
        serviceId={selected.id}
        serviceName={selected.name}
      />
    </div>
  );
}
