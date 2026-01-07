"use client";

import type { InstalledAppWithEnvironment } from "@/modules/customers/types";
import { FilterDropdown } from "@/modules/shared/components/FilterDropdown";

interface InstalledAppFilters {
  publisher?: string;
  customerName?: string;
  environmentName?: string;
  environmentType?: string;
  publishedAs?: string;
  hideMicrosoftApps?: boolean;
  showOnlyOutdated?: boolean;
}

interface ApplicationFilterPanelProps {
  installedApps: InstalledAppWithEnvironment[];
  filters: InstalledAppFilters;
  onFilterChange: (filters: InstalledAppFilters) => void;
  onClearFilters: () => void;
}

export function ApplicationFilterPanel({
  installedApps,
  filters,
  onFilterChange,
  onClearFilters,
}: ApplicationFilterPanelProps) {
  // Extraer valores únicos para las opciones de filtro
  const uniquePublishers = Array.from(
    new Set(installedApps.map((app) => app.publisher).filter((v): v is string => !!v))
  ).sort();

  const uniqueCustomers = Array.from(
    new Set(installedApps.map((app) => app.customerName).filter((v): v is string => !!v))
  ).sort();

  const uniqueEnvironments = Array.from(
    new Set(installedApps.map((app) => app.environmentName).filter((v): v is string => !!v))
  ).sort();

  const uniqueEnvironmentTypes = Array.from(
    new Set(installedApps.map((app) => app.environmentType).filter((v): v is string => !!v))
  ).sort();

  const uniquePublishedAs = Array.from(
    new Set(installedApps.map((app) => app.publishedAs).filter((v): v is string => !!v))
  ).sort();

  const hasActiveFilters =
    filters.publisher ||
    filters.customerName ||
    filters.environmentName ||
    filters.environmentType ||
    filters.publishedAs ||
    filters.showOnlyOutdated;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Toggle para ocultar/mostrar apps de Microsoft */}
      <label className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
        filters.hideMicrosoftApps
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600"
          : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
      }`}>
        <input
          type="checkbox"
          checked={filters.hideMicrosoftApps ?? true}
          onChange={(e) => onFilterChange({ ...filters, hideMicrosoftApps: e.target.checked })}
          className="w-4 h-4 text-blue-600 bg-white border-blue-500 rounded focus:ring-blue-500 focus:ring-2 checked:bg-blue-600 checked:border-blue-600 dark:bg-gray-700 dark:border-blue-500 dark:checked:bg-blue-600 dark:checked:border-blue-600"
        />
        <span className={`text-xs font-medium ${
          filters.hideMicrosoftApps
            ? "text-blue-700 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300"
        }`}>
          Ocultar apps Microsoft
        </span>
      </label>

      {/* Toggle para mostrar solo aplicaciones desactualizadas */}
      <label className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
        filters.showOnlyOutdated
          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600"
          : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
      }`}>
        <input
          type="checkbox"
          checked={filters.showOnlyOutdated ?? false}
          onChange={(e) => onFilterChange({ ...filters, showOnlyOutdated: e.target.checked })}
          className="w-4 h-4 text-orange-600 bg-white border-orange-500 rounded focus:ring-orange-500 focus:ring-2 checked:bg-orange-600 checked:border-orange-600 dark:bg-gray-700 dark:border-orange-500 dark:checked:bg-orange-600 dark:checked:border-orange-600"
        />
        <span className={`text-xs font-medium flex items-center gap-1 ${
          filters.showOnlyOutdated
            ? "text-orange-700 dark:text-orange-300"
            : "text-gray-700 dark:text-gray-300"
        }`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Solo desactualizadas
        </span>
      </label>

      {/* Filtro de Publisher */}
      <FilterDropdown
        label="Publisher"
        value={filters.publisher || ""}
        onChange={(value) => onFilterChange({ ...filters, publisher: value || undefined })}
        options={uniquePublishers}
        placeholder="Todos"
      />

      {/* Filtro de Cliente */}
      <FilterDropdown
        label="Cliente"
        value={filters.customerName || ""}
        onChange={(value) => onFilterChange({ ...filters, customerName: value || undefined })}
        options={uniqueCustomers}
        placeholder="Todos"
      />

      {/* Filtro de Tipo de Entorno */}
      <FilterDropdown
        label="Tipo Entorno"
        value={filters.environmentType || ""}
        onChange={(value) => onFilterChange({ ...filters, environmentType: value || undefined })}
        options={uniqueEnvironmentTypes}
        placeholder="Todos"
      />

      {/* Filtro de Publicación */}
      <FilterDropdown
        label="Publicado como"
        value={filters.publishedAs || ""}
        onChange={(value) => onFilterChange({ ...filters, publishedAs: value || undefined })}
        options={uniquePublishedAs}
        placeholder="Todos"
      />

      {/* Filtro de Entorno */}
      <FilterDropdown
        label="Entorno"
        value={filters.environmentName || ""}
        onChange={(value) => onFilterChange({ ...filters, environmentName: value || undefined })}
        options={uniqueEnvironments}
        placeholder="Todos"
      />

      {/* Botón de restablecer filtros */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Restablecer
        </button>
      )}
    </div>
  );
}
