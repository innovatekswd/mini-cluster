import React, { useRef, useEffect, useState, memo } from "react";
import {
  FaBell,
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaTrash,
  FaCheck,
} from "react-icons/fa";
import type { NotificationHistoryItem, ToastType } from "~/components/Toast";

interface NotificationDropdownProps {
  notifications: NotificationHistoryItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const getNotificationIcon = (type: ToastType) => {
  switch (type) {
    case "success":
      return <FaCheckCircle className="text-emerald-400" />;
    case "error":
      return <FaExclamationCircle className="text-rose-400" />;
    case "warning":
      return <FaExclamationCircle className="text-amber-400" />;
    case "info":
      return <FaInfoCircle className="text-cyan-400" />;
  }
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
};

export const NotificationDropdown = memo(function NotificationDropdown({
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  clearNotifications,
}: NotificationDropdownProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={notificationRef}>
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="icon-btn relative"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <FaBell className="text-lg" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-cyan-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <h3 className="font-semibold text-sm text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  aria-label="Mark all notifications as read"
                >
                  <FaCheck className="text-[10px]" aria-hidden="true" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-rose-400 transition-colors"
                  aria-label="Clear all notifications"
                >
                  <FaTrash className="text-xs" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto" role="list">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <FaBell className="text-2xl text-slate-600 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`
                    px-4 py-3 border-b border-slate-800/50 cursor-pointer
                    transition-colors hover:bg-slate-800/30
                    ${!notification.read ? "bg-cyan-500/5" : ""}
                  `}
                  role="listitem"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {notification.title && (
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>
                      )}
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <span 
                        className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0 mt-2"
                        aria-label="Unread"
                      ></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
