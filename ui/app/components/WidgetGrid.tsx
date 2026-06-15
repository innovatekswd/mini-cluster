import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import { FaChevronDown, FaChevronRight, FaExclamationTriangle, FaArrowRight } from "react-icons/fa";

// ============================================================================
// Types
// ============================================================================

export interface WidgetCardProps {
  title: string;
  icon?: React.ReactNode;
  viewAllLink?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

const WidgetSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-slate-700 rounded w-1/3"></div>
      <div className="h-32 bg-slate-800 rounded"></div>
      <div className="h-3 bg-slate-700 rounded w-2/3"></div>
    </div>
  );
};

interface WidgetErrorProps {
  message: string;
  onRetry?: () => void;
}

const WidgetError: React.FC<WidgetErrorProps> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <FaExclamationTriangle className="text-rose-400 text-2xl mb-2" />
      <p className="text-sm text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};

// ============================================================================
// WidgetCard Component
// ============================================================================

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  icon,
  viewAllLink,
  viewAllLabel = "View All",
  children,
  isLoading = false,
  error = null,
  onRetry,
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(`widget-${title}-collapsed`);
    if (stored !== null) return stored === 'true';
    return defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(`widget-${title}-collapsed`, String(isCollapsed));
  }, [title, isCollapsed]);

  const handleToggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-700/50 ${
          collapsible ? 'cursor-pointer hover:bg-slate-700/30' : ''
        }`}
        onClick={handleToggleCollapse}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <span className="text-slate-400 text-xs">
              {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
            </span>
          )}
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        </div>
        {viewAllLink && !isCollapsed && (
          <Link
            to={viewAllLink}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{viewAllLabel}</span>
            <FaArrowRight className="text-[10px]" />
          </Link>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {isLoading ? (
            <WidgetSkeleton />
          ) : error ? (
            <WidgetError message={error} onRetry={onRetry} />
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WidgetGrid Component
// ============================================================================

interface WidgetGridProps {
  children: React.ReactNode;
}

export const WidgetGrid: React.FC<WidgetGridProps> = ({ children }) => {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
};

// ============================================================================
// WidgetRow Component (for side-by-side layouts)
// ============================================================================

interface WidgetRowProps {
  children: React.ReactNode;
}

export const WidgetRow: React.FC<WidgetRowProps> = ({ children }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {children}
    </div>
  );
};
