import React from "react";
import { useLiveSystemMetrics } from "~/hooks/useLiveSystemMetrics";
import { formatBytesPerSecond } from "~/services/metricsService";

export const NetworkInterfacesWidget: React.FC = () => {
  const { current } = useLiveSystemMetrics();

  if (!current || !current.networkInterfaces || current.networkInterfaces.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-4 text-center">No network interface data available</div>
    );
  }

  // Filter out interfaces with no traffic (docker bridges, etc.)
  const activeInterfaces = current.networkInterfaces.filter(
    (iface) => iface.sendRate > 0 || iface.receiveRate > 0 || iface.name === "lo"
  );

  return (
    <div className="space-y-2">
      {activeInterfaces.map((iface) => (
        <div
          key={iface.name}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              {iface.name === "lo" ? (
                <span className="text-xs text-slate-500 font-mono">lo</span>
              ) : iface.name.startsWith("wlp") || iface.name.startsWith("wl") ? (
                <span className="text-xs text-cyan-400 font-mono">{iface.name}</span>
              ) : iface.name.startsWith("en") || iface.name.startsWith("eth") ? (
                <span className="text-xs text-emerald-400 font-mono">{iface.name}</span>
              ) : (
                <span className="text-xs text-slate-400 font-mono">{iface.name}</span>
              )}
            </div>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                iface.status === "up" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-emerald-400 font-mono">
                ↓ {formatBytesPerSecond(iface.receiveRate)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-cyan-400 font-mono">
                ↑ {formatBytesPerSecond(iface.sendRate)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
