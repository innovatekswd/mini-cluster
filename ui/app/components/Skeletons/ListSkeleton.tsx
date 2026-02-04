import React from "react";
import { Skeleton, SkeletonText } from "./Skeleton";

/**
 * Skeleton for a single row in a list/table
 */
export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 border-b border-slate-700/50">
    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <SkeletonText width="w-32" className="mb-1" />
      <SkeletonText width="w-48" className="h-3" />
    </div>
    <Skeleton className="w-16 h-6 rounded-full" />
  </div>
);

/**
 * Multiple list item skeletons
 */
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="divide-y divide-slate-700/50">
    {Array.from({ length: count }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
);

/**
 * Skeleton for tree view items (apps with services)
 */
export const TreeViewSkeleton: React.FC = () => (
  <div className="space-y-2">
    {/* App groups */}
    {Array.from({ length: 3 }).map((_, appIndex) => (
      <div
        key={appIndex}
        className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden"
      >
        {/* App header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="w-3 h-3" />
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1">
            <SkeletonText width="w-32" className="mb-1" />
            <SkeletonText width="w-24" className="h-3" />
          </div>
          <Skeleton className="w-20 h-6 rounded-full" />
        </div>
        {/* Services (for first group only to show expanded state) */}
        {appIndex === 0 && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-800 p-4 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <SkeletonText width="w-28" />
                    <Skeleton className="w-14 h-5 rounded-full" />
                  </div>
                  <SkeletonText width="w-48" className="h-3 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
);
