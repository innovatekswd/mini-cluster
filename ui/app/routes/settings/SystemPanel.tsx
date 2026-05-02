import React, { useState, useEffect, useCallback } from "react";
import { FaServer, FaCheckCircle, FaTimesCircle, FaSync, FaDownload, FaTrash } from "react-icons/fa";
import { systemService, type SystemInfo } from "~/services/systemService";
import { useToast } from "~/components/Toast";

export function SystemPanel() {
  const toast = useToast();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"install" | "uninstall" | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setInfo(await systemService.getInfo());
    } catch {
      toast.error("Failed to load system info");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleInstall = async () => {
    setShowConfirm(null);
    setActionLoading(true);
    try {
      const result = await systemService.installService();
      toast.success(result.message);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to install service";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUninstall = async () => {
    setShowConfirm(null);
    setActionLoading(true);
    try {
      const result = await systemService.uninstallService();
      toast.success(result.message);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to uninstall service";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!info) return null;

  const isWindows = info.os === "windows";
  const isLinux   = info.os === "linux";
  const canManageService = isWindows || isLinux;

  const serviceLabel = isWindows ? "Windows Service" : "Systemd Service";
  const osLabel = isWindows ? "Windows" : isLinux ? "Linux" : info.os;

  return (
    <div className="space-y-6">
      {/* System Info Card */}
      <div className="card-elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <FaServer className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">System Information</h2>
            <p className="text-sm text-slate-500">Platform and runtime details</p>
          </div>
          <button
            onClick={load}
            className="ml-auto p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-700"
            aria-label="Refresh"
          >
            <FaSync />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          {[
            { label: "Operating System", value: osLabel },
            { label: "Architecture",     value: info.arch },
            { label: "Runtime",          value: info.runtime === "go" ? "Go" : ".NET" },
            { label: "Service Name",     value: info.serviceName },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg p-3">
              <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</dt>
              <dd className="text-sm font-medium text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Service Status Card */}
      <div className="card-elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            info.isService ? "bg-emerald-500/20" : "bg-slate-700/50"
          }`}>
            {info.isService
              ? <FaCheckCircle className="text-emerald-400" />
              : <FaTimesCircle className="text-slate-500" />
            }
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Service Status</h2>
            <p className="text-sm text-slate-500">
              {info.isService
                ? `Running as a ${serviceLabel}`
                : "Running as a standalone process"}
            </p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
            info.isService
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-700 text-slate-400 border border-slate-600"
          }`}>
            {info.isService ? "Service" : "Standalone"}
          </span>
        </div>

        {!canManageService ? (
          <p className="text-sm text-slate-500 italic">
            Service management is only available on Windows and Linux.
          </p>
        ) : info.isService ? (
          <>
            <p className="text-sm text-slate-400 mb-4">
              MiniCluster is registered as a <strong className="text-slate-200">{serviceLabel}</strong> and
              will start automatically on boot. Use the button below to uninstall the service registration
              (this will stop and remove the service but leave your data intact).
            </p>
            {showConfirm === "uninstall" ? (
              <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-800/40 rounded-lg">
                <p className="text-sm text-red-300 flex-1">
                  Stop and remove the {serviceLabel}? MiniCluster will keep running until next reboot.
                </p>
                <button onClick={() => setShowConfirm(null)} className="btn-secondary text-sm">Cancel</button>
                <button
                  onClick={handleUninstall}
                  disabled={actionLoading}
                  className="btn-danger text-sm flex items-center gap-2"
                >
                  {actionLoading ? <FaSync className="animate-spin" /> : <FaTrash />}
                  Uninstall
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm("uninstall")}
                disabled={actionLoading}
                className="btn-danger flex items-center gap-2"
              >
                <FaTrash />
                Uninstall {serviceLabel}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">
              MiniCluster is running as a standalone process. Install it as a <strong className="text-slate-200">
              {serviceLabel}</strong> so it starts automatically on boot and is managed by the OS
              {isWindows ? " Service Control Manager" : " (systemd)"}.
            </p>
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4 text-xs text-slate-400 font-mono space-y-1">
              {isWindows && (
                <>
                  <p className="text-slate-500">// What install does:</p>
                  <p>sc create MiniCluster binpath= "C:\Program Files\MiniCluster\minicluster.exe"</p>
                  <p>sc start MiniCluster</p>
                </>
              )}
              {isLinux && (
                <>
                  <p className="text-slate-500"># What install does:</p>
                  <p>systemctl enable minicluster</p>
                  <p>systemctl start minicluster</p>
                </>
              )}
            </div>
            {showConfirm === "install" ? (
              <div className="flex items-center gap-3 p-4 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
                <p className="text-sm text-cyan-300 flex-1">
                  {isWindows
                    ? "This requires Administrator privileges. MiniCluster will register and start as a Windows Service."
                    : "This requires root privileges (sudo). MiniCluster will be registered as a systemd service."}
                </p>
                <button onClick={() => setShowConfirm(null)} className="btn-secondary text-sm">Cancel</button>
                <button
                  onClick={handleInstall}
                  disabled={actionLoading}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  {actionLoading ? <FaSync className="animate-spin" /> : <FaDownload />}
                  Install
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm("install")}
                disabled={actionLoading}
                className="btn-primary flex items-center gap-2"
              >
                <FaDownload />
                Install as {serviceLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
