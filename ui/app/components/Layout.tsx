import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { FaCubes, FaCog, FaSync } from "react-icons/fa";
import { useToast } from "~/components/Toast";
import { useConnection } from "~/context/ConnectionContext";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useAuth } from "~/context/AuthContext";
import { NotificationDropdown, UserMenu } from "~/components/Header";
import { NavigationBar } from "~/components/NavigationBar";

type LayoutProps = {
  children: React.ReactNode;
};

import { systemService, type SystemInfo } from "~/services/systemService";

export const Layout = ({ children }: LayoutProps) => {
  const { status: connectionStatus, checkConnection, isChecking, lastOnline, onDisconnect, onReconnect } = useConnection();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useToast();
  const { clearStatuses } = useAppStatusContext();
  const { logout } = useAuth();
  const toast = useToast();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    if (connectionStatus === "connected") {
      systemService.getInfo().then(setSysInfo).catch(() => {});
    }
  }, [connectionStatus]);

  useEffect(() => {
    const unsubDisconnect = onDisconnect(() => {
      clearStatuses();
      toast.warning("Backend server is offline. Service statuses may be outdated.", "Connection Lost");
    });

    const unsubReconnect = onReconnect(() => {
      toast.success("Backend server is back online. Refreshing data...", "Connection Restored");
    });

    return () => {
      unsubDisconnect();
      unsubReconnect();
    };
  }, [onDisconnect, onReconnect, clearStatuses, toast]);

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return { dotClass: "connection-dot-connected", text: "Backend Online", textClass: "text-emerald-400" };
      case "connecting":
        return { dotClass: "connection-dot-connecting", text: "Connecting...", textClass: "text-amber-400" };
      case "disconnected":
        return { dotClass: "connection-dot-disconnected", text: "Backend Offline", textClass: "text-rose-400" };
    }
  };

  const statusConfig = getStatusConfig();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <header className="flex-none glass-card border-b border-slate-800/50 px-6 py-3 z-50">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FaCubes className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                MiniCluster
              </h1>
              <p className="text-xs text-slate-500 -mt-0.5 hidden sm:block">
                {sysInfo?.version ? `v${sysInfo.version}` : ""}
              </p>
            </div>
          </div>

          {/* Right side: nav + actions */}
          <div className="flex items-center gap-2">
            <NavigationBar />

            <div className="w-px h-6 bg-slate-700/50" />

            <Link to="/settings" className="icon-btn" aria-label="Settings">
              <FaCog className="text-lg" aria-hidden="true" />
            </Link>

            <button
              onClick={checkConnection}
              disabled={isChecking}
              className="flex items-center gap-2 px-2 md:px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={lastOnline ? `Check connection. Last online: ${lastOnline.toLocaleTimeString()}` : "Check connection status"}
            >
              <span className={`connection-dot ${statusConfig.dotClass}`} aria-hidden="true" />
              <span className={`hidden md:inline text-xs ${statusConfig.textClass}`}>{statusConfig.text}</span>
              <FaSync className={`text-xs text-slate-500 ${isChecking ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>

            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markAsRead}
              markAllAsRead={markAllAsRead}
              clearNotifications={clearNotifications}
            />

            <UserMenu
              connectionStatus={connectionStatus}
              lastOnline={lastOnline}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};
