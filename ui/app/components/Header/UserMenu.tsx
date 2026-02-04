import React, { useRef, useEffect, useState, memo } from "react";
import { Link } from "react-router";
import {
  FaUser,
  FaCircle,
  FaUserCog,
  FaUsers,
  FaSignOutAlt,
} from "react-icons/fa";

interface UserMenuProps {
  connectionStatus: "connected" | "connecting" | "disconnected";
  lastOnline: Date | null;
  onLogout: () => void;
}

export const UserMenu = memo(function UserMenu({
  connectionStatus,
  lastOnline,
  onLogout,
}: UserMenuProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition-colors"
        aria-label="User menu"
        aria-expanded={showUserMenu}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <FaUser className="text-white text-sm" aria-hidden="true" />
        </div>
      </button>

      {/* User Dropdown */}
      {showUserMenu && (
        <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50 z-50">
          {/* User Info Header */}
          <div className="px-4 py-4 border-b border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <FaUser className="text-white text-lg" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  Administrator
                </p>
                <p className="text-xs text-slate-400 truncate">
                  admin@minicluster.local
                </p>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Status
            </p>
            <div className="flex items-center gap-2">
              <FaCircle
                className={`text-[8px] ${
                  connectionStatus === "connected"
                    ? "text-emerald-400"
                    : connectionStatus === "connecting"
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm text-slate-300">
                {connectionStatus === "connected"
                  ? "Online"
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Offline"}
              </span>
            </div>
            {lastOnline && connectionStatus !== "connected" && (
              <p className="text-xs text-slate-500 mt-1">
                Last online: {lastOnline.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              to="/settings"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
            >
              <FaUserCog className="text-slate-400" aria-hidden="true" />
              <span>Account Settings</span>
            </Link>
            <Link
              to="/settings?tab=users"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
            >
              <FaUsers className="text-slate-400" aria-hidden="true" />
              <span>Manage Users</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-700/50 py-2">
            <button
              onClick={() => {
                setShowUserMenu(false);
                onLogout();
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors w-full"
            >
              <FaSignOutAlt aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
