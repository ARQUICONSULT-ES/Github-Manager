export function ApplicationCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>

        {/* Info grid skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        </div>

        {/* Customer and Environment skeleton */}
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplicationListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, customerIdx) => (
        <div key={customerIdx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Header del cliente skeleton */}
          <div className="flex items-center w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* Contenido de aplicaciones skeleton */}
          <div className="p-4 space-y-4">
            {Array.from({ length: 2 }).map((_, envIdx) => (
              <div key={envIdx}>
                {/* Header del entorno skeleton */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-20 animate-pulse" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                </div>
                
                {/* Grid de aplicaciones (3 columnas) */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, appIdx) => (
                    <ApplicationCardSkeleton key={appIdx} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
