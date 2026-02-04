import React from "react";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with pulse animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

/**
 * Skeleton for text lines
 */
export const SkeletonText: React.FC<{ width?: string; className?: string }> = ({
  width = "w-full",
  className = "",
}) => <Skeleton className={`h-4 ${width} ${className}`} />;

/**
 * Skeleton for circular elements (avatars, badges)
 */
export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({
  size = "w-8 h-8",
  className = "",
}) => <Skeleton className={`rounded-full ${size} ${className}`} />;

/**
 * Skeleton for buttons
 */
export const SkeletonButton: React.FC<{ className?: string }> = ({
  className = "",
}) => <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />;

/**
 * Skeleton for table rows
 */
export const SkeletonTableRow: React.FC<{ cols?: number; className?: string }> = ({
  cols = 4,
  className = "",
}) => (
  <tr className={className}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3 px-4">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

/**
 * Skeleton for entire table
 */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-800/50">
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="py-3 px-4 text-left">
              <Skeleton className="h-3 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Full page loading skeleton
 */
export const PageSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Page header */}
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
    
    {/* Content grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  </div>
);

/**
 * Dashboard skeleton with sidebar
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="flex h-full">
    {/* Sidebar skeleton */}
    <div className="w-64 border-r border-slate-700 p-4 space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
    
    {/* Main content skeleton */}
    <div className="flex-1 p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  </div>
);

/**
 * Form skeleton
 */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 4 }) => (
  <div className="space-y-4">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
    <div className="flex justify-end gap-2 pt-4">
      <Skeleton className="h-10 w-20" />
      <Skeleton className="h-10 w-24" />
    </div>
  </div>
);
