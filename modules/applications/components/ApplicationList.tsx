"use client";

import type { Application } from "@/modules/applications/types";
import ApplicationCard from "./ApplicationCard";
import ApplicationCardSkeleton from "./ApplicationCardSkeleton";

interface ApplicationListProps {
  applications: Application[];
  isLoading: boolean;
  onApplicationClick: (application: Application) => void;
}

export default function ApplicationList({ 
  applications, 
  isLoading, 
  onApplicationClick 
}: ApplicationListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ApplicationCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800 mb-4">
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          No hay aplicaciones
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          No se encontraron aplicaciones en el catálogo
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          onClick={onApplicationClick}
        />
      ))}
    </div>
  );
}
