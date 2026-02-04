import React from "react";
import { Skeleton, SkeletonText, SkeletonCircle } from "./Skeleton";

/**
 * Skeleton loader for ServiceCard component
 */
export const ServiceCardSkeleton: React.FC = () => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col gap-4 border border-gray-700">
    <div className="flex items-center gap-4 mb-2">
      <div className="flex-1 min-w-0">
        {/* App badge skeleton */}
        <div className="flex items-center gap-1.5 mb-2">
          <Skeleton className="w-5 h-5 rounded" />
          <SkeletonText width="w-16" />
        </div>
        {/* Service name */}
        <SkeletonText width="w-48" className="h-5 mb-2" />
        {/* Executable path */}
        <SkeletonText width="w-64" className="h-3 mb-2" />
        {/* Auto start text */}
        <SkeletonText width="w-24" className="h-3" />
      </div>
      <div className="flex flex-col items-end gap-2">
        {/* Status badge */}
        <Skeleton className="w-16 h-6 rounded-full" />
        {/* Control buttons */}
        <div className="flex gap-2">
          <SkeletonCircle size="w-10 h-10" />
          <SkeletonCircle size="w-10 h-10" />
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-4 items-center justify-between mt-2">
      {/* Date info */}
      <SkeletonText width="w-48" className="h-3" />
      {/* Edit button */}
      <Skeleton className="w-16 h-6 rounded" />
    </div>
  </div>
);

/**
 * Grid of ServiceCard skeletons
 */
export const ServiceCardGridSkeleton: React.FC<{ count?: number }> = ({
  count = 6,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <ServiceCardSkeleton key={i} />
    ))}
  </div>
);
