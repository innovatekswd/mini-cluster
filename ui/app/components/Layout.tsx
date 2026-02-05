import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router";
import { FaCubes, FaBars, FaTimes, FaCog, FaDesktop, FaTerminal, FaFolder, FaGlobe, FaSlidersH, FaSync } from "react-icons/fa";
import { useToast, type NotificationHistoryItem, type ToastType } from "~/components/Toast";
import { useConnection } from "~/context/ConnectionContext";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useAuth } from "~/context/AuthContext";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";
import { NotificationDropdown, UserMenu, SystemMetricsBar } from "~/components/Header";

export interface AppStats {
  total: number;
  running: number;
  stopped: number;
  failed: number;
}

type LayoutProps = {
  children: React.ReactNode;
  appStats?: AppStats;
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
  isSidebarPinned?: boolean;
};

export const Layout = ({ children, appStats, onMenuToggle, isSidebarOpen, isSidebarPinned }: LayoutProps) => {
  const { status: connectionStatus, checkConnection, isChecking, lastOnline, onDisconnect, onReconnect } = useConnection();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useToast();
  const { clearStatuses } = useAppStatusContext();
  const { logout } = useAuth();
  const toast = useToast();
  
  // System metrics with history for sparklines
  const { 
    current: systemMetrics, 
    cpuHistory, 
    memoryHistory, 
    diskHistory, 
    processCountHistory,
    isLoading: metricsLoading 
  } = useSystemMetricsHistory();

  // Subscribe to connection events for notifications and status clearing
  useEffect(() => {
    const unsubDisconnect = onDisconnect(() => {
      // Clear all service statuses to show "Unknown"
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
        return {
          dotClass: "connection-dot-connected",
          text: "Backend Online",
          textClass: "text-emerald-400",
        };
      case "connecting":
        return {
          dotClass: "connection-dot-connecting",
          text: "Connecting...",
          textClass: "text-amber-400",
        };
      case "disconnected":
        return {
          dotClass: "connection-dot-disconnected",
          text: "Backend Offline",
          textClass: "text-rose-400",
        };
    }
  };

  const statusConfig = getStatusConfig();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex-none glass-card border-b border-slate-800/50 px-6 py-3 z-50">
        <div className="flex items-center justify-between">
          {/* Menu Toggle (Tablet) + Logo & Brand */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu toggle - hidden when pinned */}
            {onMenuToggle && !isSidebarPinned && (
              <button
                onClick={onMenuToggle}
                className="icon-btn"
                aria-label="Toggle sidebar"
              >
                {isSidebarOpen ? <FaTimes /> : <FaBars />}
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FaCubes className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                MiniCluster
              </h1>
              <p className="text-xs text-slate-500 -mt-0.5 hidden sm:block">Control Center</p>
            </div>
          </div>

          {/* Center: Service Stats + System Metrics with Donuts */}
          <SystemMetricsBar appStats={appStats} systemMetrics={systemMetrics} />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Dashboard/Services link */}
            <Link
              to="/"
              className="icon-btn"
              aria-label="Dashboard / Services"
            >
              <FaCubes className="text-lg" aria-hidden="true" />
            </Link>

            {/* Environments link */}
            <Link
              to="/environments"
              className="icon-btn"
              aria-label="Environments"
            >
              <FaSlidersH className="text-lg" aria-hidden="true" />
            </Link>

            {/* File Explorer link */}
            <Link
              to="/explorer"
              className="icon-btn"
              aria-label="File Explorer"
            >
              <FaFolder className="text-lg" aria-hidden="true" />
            </Link>

            {/* Terminal link */}
            <Link
              to="/terminal"
              className="icon-btn"
              aria-label="Terminal"
            >
              <FaTerminal className="text-lg" aria-hidden="true" />
            </Link>

            {/* System Monitor link */}
            <Link
              to="/monitor"
              className="icon-btn"
              aria-label="System Monitor"
            >
              <FaDesktop className="text-lg" aria-hidden="true" />
            </Link>

            {/* Proxy link */}
            <Link
              to="/proxy"
              className="icon-btn"
              aria-label="Reverse Proxy"
            >
              <FaGlobe className="text-lg" aria-hidden="true" />
            </Link>

            {/* Settings link */}
            <Link
              to="/settings"
              className="icon-btn"
              aria-label="Settings"
            >
              <FaCog className="text-lg" aria-hidden="true" />
            </Link>

            {/* Status indicator - compact on tablet */}
            <button 
              onClick={checkConnection}
              disabled={isChecking}
              className="flex items-center gap-2 px-2 md:px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={lastOnline ? `Check connection. Last online: ${lastOnline.toLocaleTimeString()}` : "Check connection status"}
            >
              <span className={`connection-dot ${statusConfig.dotClass}`} aria-hidden="true"></span>
              <span className={`hidden md:inline text-xs ${statusConfig.textClass}`}>{statusConfig.text}</span>
              <FaSync className={`text-xs text-slate-500 ${isChecking ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            
            {/* Notification Dropdown */}
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markAsRead}
              markAllAsRead={markAllAsRead}
              clearNotifications={clearNotifications}
            />
            
            {/* User Menu */}
            <UserMenu
              connectionStatus={connectionStatus}
              lastOnline={lastOnline}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};
