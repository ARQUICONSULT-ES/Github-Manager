"use client";

export default function ApplicationCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* GitHub Repo skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>

        {/* Latest Release skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-20" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>

        {/* Stats badges skeleton */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-20" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-24" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-28" />
        </div>
      </div>
    </div>
  );
}
