import React, { useEffect, useState, useCallback, useRef } from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes, FaRocket, FaBell } from "react-icons/fa";

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
  persistent?: boolean;
  showProgress?: boolean;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.duration || 4000);

  const duration = toast.duration || 4000;
  const showProgress = toast.showProgress !== false && !toast.persistent;

  const startTimer = useCallback(() => {
    if (toast.persistent) return;
    
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, remainingTimeRef.current);
  }, [toast.id, toast.persistent, onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  // Progress bar animation
  useEffect(() => {
    if (!showProgress || toast.persistent) return;

    const interval = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          const newProgress = prev - (100 / (duration / 50));
          return newProgress > 0 ? newProgress : 0;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, isPaused, showProgress, toast.persistent]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    pauseTimer();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimer();
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const icons = {
    success: <FaCheckCircle className="text-emerald-400 text-lg" />,
    error: <FaExclamationCircle className="text-rose-400 text-lg" />,
    warning: <FaExclamationCircle className="text-amber-400 text-lg" />,
    info: <FaInfoCircle className="text-cyan-400 text-lg" />,
  };

  const styles = {
    success: {
      border: "border-emerald-500/30",
      bg: "bg-gradient-to-r from-emerald-500/10 to-emerald-600/5",
      progress: "bg-emerald-500",
      glow: "shadow-emerald-500/10",
    },
    error: {
      border: "border-rose-500/30",
      bg: "bg-gradient-to-r from-rose-500/10 to-rose-600/5",
      progress: "bg-rose-500",
      glow: "shadow-rose-500/10",
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-gradient-to-r from-amber-500/10 to-amber-600/5",
      progress: "bg-amber-500",
      glow: "shadow-amber-500/10",
    },
    info: {
      border: "border-cyan-500/30",
      bg: "bg-gradient-to-r from-cyan-500/10 to-cyan-600/5",
      progress: "bg-cyan-500",
      glow: "shadow-cyan-500/10",
    },
  };

  const style = styles[toast.type];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-md
        shadow-xl ${style.glow} min-w-[320px] max-w-lg
        ${style.border} ${style.bg}
        ${isExiting ? "animate-slide-out" : "animate-slide-in"}
        transition-all duration-200 hover:scale-[1.02]
      `}
    >
      {/* Main content */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="font-semibold text-sm text-slate-100 mb-0.5">{toast.title}</p>
          )}
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{toast.message}</p>
          
          {/* Action button */}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className="mt-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 
                transition-colors underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-700/50 
            text-slate-500 hover:text-slate-300 transition-all"
        >
          <FaTimes size={12} />
        </button>
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/50">
          <div
            className={`h-full ${style.progress} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Toast Container & Context
export interface NotificationHistoryItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => Promise<T>;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  notifications: NotificationHistoryItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ 
  children, 
  position = "bottom-right",
  maxToasts = 5 
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);

  const showToast = useCallback((
    type: ToastType, 
    message: string, 
    options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => {
      const newToasts = [...prev, { id, type, message, ...options }];
      // Limit the number of toasts
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });
    
    // Add to notification history (skip loading toasts from promises)
    if (!options?.persistent) {
      setNotifications((prev) => {
        const newNotification: NotificationHistoryItem = {
          id,
          type,
          title: options?.title,
          message,
          timestamp: new Date(),
          read: false,
        };
        const updated = [newNotification, ...prev];
        // Keep last 50 notifications
        return updated.slice(0, 50);
      });
    }
    
    return id;
  }, [maxToasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const promise = useCallback(async <T,>(
    promiseToResolve: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ): Promise<T> => {
    const id = showToast("info", messages.loading, { persistent: true, showProgress: false });
    
    try {
      const result = await promiseToResolve;
      // Dismiss loading toast and show success
      dismissToast(id);
      showToast("success", messages.success);
      return result;
    } catch (error) {
      // Dismiss loading toast and show error
      dismissToast(id);
      showToast("error", messages.error);
      throw error;
    }
  }, [showToast, dismissToast]);

  const value: ToastContextType = {
    showToast,
    success: (message, title) => showToast("success", message, { title }),
    error: (message, title) => showToast("error", message, { title, duration: 8000 }), // Longer duration for errors
    warning: (message, title) => showToast("warning", message, { title, duration: 6000 }),
    info: (message, title) => showToast("info", message, { title }),
    promise,
    dismiss: dismissToast,
    dismissAll,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };

  const positionClasses: Record<ToastPosition, string> = {
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6",
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-center": "top-6 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  };

  const isTop = position.startsWith("top");

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div 
        className={`fixed z-[100] flex flex-col gap-3 ${positionClasses[position]}`}
        style={{ flexDirection: isTop ? "column" : "column-reverse" }}
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
