"use client";

import { useState } from "react";
import { useApplications } from "@/modules/applications/hooks/useApplications";
import { useApplicationFilter } from "@/modules/applications/hooks/useApplicationFilter";
import ApplicationList from "@/modules/applications/components/ApplicationList";
import ApplicationFormModal from "@/modules/applications/components/ApplicationFormModal";
import type { Application } from "@/modules/applications/types";

export function ApplicationsPage() {
  const { applications, isLoading, isRefreshing, refreshApplications } = useApplications();
  const {
    filteredApplications,
    searchQuery,
    setSearchQuery,
    publisherFilter,
    setPublisherFilter,
    publishers,
  } = useApplicationFilter(applications);
  const [selectedApplication, setSelectedApplication] = useState<Application | undefined>(undefined);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);

  const handleApplicationClick = (application: Application) => {
    setSelectedApplication(application);
    setIsApplicationModalOpen(true);
  };

  const handleCreateApplication = () => {
    setSelectedApplication(undefined);
    setIsApplicationModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsApplicationModalOpen(false);
    setSelectedApplication(undefined);
  };

  const handleSave = async () => {
    await refreshApplications();
  };

  const handleRefresh = async () => {
    await refreshApplications();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Aplicaciones
          </h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Actualizar"
          >
            {isRefreshing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {applications.length} aplicaciones en catálogo
        </p>
      </div>

      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar aplicaciones..."
            autoComplete="off"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        {/* Publisher Filter */}
        {publishers.length > 0 && (
          <select
            value={publisherFilter}
            onChange={(e) => setPublisherFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="all">Todos los publishers</option>
            {publishers.map((publisher) => (
              <option key={publisher} value={publisher}>
                {publisher}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleCreateApplication}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors whitespace-nowrap"
          title="Crear nueva aplicación"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir aplicación
        </button>
      </div>

      {/* Application Form Modal */}
      <ApplicationFormModal
        isOpen={isApplicationModalOpen}
        onClose={handleCloseModal}
        application={selectedApplication}
        onSave={handleSave}
      />

      {/* Contenido */}
      {isLoading ? (
        <ApplicationList applications={[]} isLoading={true} onApplicationClick={handleApplicationClick} />
      ) : filteredApplications.length > 0 ? (
        <ApplicationList applications={filteredApplications} isLoading={false} onApplicationClick={handleApplicationClick} />
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || publisherFilter !== "all"
              ? "No se encontraron aplicaciones con los filtros aplicados"
              : "No hay aplicaciones en el catálogo"}
          </p>
        </div>
      )}
    </div>
  );
}
