import React from "react";
import { FaFolder, FaSearch, FaCubes, FaExclamationTriangle, FaPlus } from "react-icons/fa";

type EmptyStateVariant = "default" | "no-results" | "no-services" | "error";

interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon variant or custom icon */
  variant?: EmptyStateVariant;
  /** Custom icon element (overrides variant) */
  icon?: React.ReactNode;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Secondary action link */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const VARIANT_ICONS: Record<EmptyStateVariant, React.ReactNode> = {
  default: <FaFolder className="text-slate-500" size={48} />,
  "no-results": <FaSearch className="text-slate-500" size={48} />,
  "no-services": <FaCubes className="text-slate-500" size={48} />,
  error: <FaExclamationTriangle className="text-red-400" size={48} />,
};

export function EmptyState({
  title,
  description,
  variant = "default",
  icon,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const displayIcon = icon ?? VARIANT_ICONS[variant];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="mb-6">{displayIcon}</div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>

      {/* Description */}
      {description && (
        <p className="text-gray-400 mb-6 max-w-md">{description}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            {action.icon ?? <FaPlus size={14} />}
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Preset empty states for common scenarios
 */
export const EmptyStatePresets = {
  NoAppsSelected: () => (
    <EmptyState
      title="No apps selected"
      description="Select one or more apps to view their services"
      variant="no-results"
    />
  ),
  NoServicesFound: () => (
    <EmptyState
      title="No services found"
      description="The selected apps don't have any services yet"
      variant="no-services"
    />
  ),
  NoSearchResults: ({ query }: { query: string }) => (
    <EmptyState
      title="No results found"
      description={`No items matching "${query}"`}
      variant="no-results"
    />
  ),
  LoadError: ({ onRetry }: { onRetry: () => void }) => (
    <EmptyState
      title="Failed to load data"
      description="Something went wrong. Please try again."
      variant="error"
      action={{ label: "Retry", onClick: onRetry }}
    />
  ),
};
