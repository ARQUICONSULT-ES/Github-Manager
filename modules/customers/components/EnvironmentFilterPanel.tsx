"use client";

import { useState, useRef, useEffect } from "react";
import type { EnvironmentWithCustomer } from "@/modules/customers/types";

interface EnvironmentFilters {
  status?: string;
  type?: string;
  customer?: string;
  platformVersion?: string;
  applicationVersion?: string;
}

interface EnvironmentFilterPanelProps {
  environments: EnvironmentWithCustomer[];
  filters: EnvironmentFilters;
  onFilterChange: (filters: EnvironmentFilters) => void;
  onClearFilters: () => void;
}

export function EnvironmentFilterPanel({
  environments,
  filters,
  onFilterChange,
  onClearFilters,
}: EnvironmentFilterPanelProps) {
  // Extraer valores únicos para las opciones de filtro
  const uniqueTypes = Array.from(
    new Set(environments.map((env) => env.type).filter((v): v is string => !!v))
  ).sort();

  const uniqueStatuses = Array.from(
    new Set(environments.map((env) => env.status).filter((v): v is string => !!v))
  ).sort();

  const uniqueCustomers = Array.from(
    new Set(environments.map((env) => env.customerName).filter((v): v is string => !!v))
  ).sort();

  const uniquePlatformVersions = Array.from(
    new Set(environments.map((env) => env.platformVersion).filter((v): v is string => !!v))
  ).sort();

  const uniqueApplicationVersions = Array.from(
    new Set(environments.map((env) => env.applicationVersion).filter((v): v is string => !!v))
  ).sort();

  const hasActiveFilters =
    filters.status !== 'Active' ||
    filters.type ||
    filters.customer ||
    filters.platformVersion ||
    filters.applicationVersion;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filtro de Tipo */}
      <FilterDropdown
        label="Tipo"
        value={filters.type || ""}
        onChange={(value) => onFilterChange({ ...filters, type: value || undefined })}
        options={uniqueTypes}
        placeholder="Todos"
      />

      {/* Filtro de Estado */}
      <FilterDropdown
        label="Estado"
        value={filters.status || ""}
        onChange={(value) => onFilterChange({ ...filters, status: value || undefined })}
        options={uniqueStatuses}
        placeholder="Todos"
      />

      {/* Filtro de Cliente */}
      <FilterDropdown
        label="Cliente"
        value={filters.customer || ""}
        onChange={(value) => onFilterChange({ ...filters, customer: value || undefined })}
        options={uniqueCustomers}
        placeholder="Todos"
      />

      {/* Filtro de Platform Version */}
      <FilterDropdown
        label="Platform Version"
        value={filters.platformVersion || ""}
        onChange={(value) => onFilterChange({ ...filters, platformVersion: value || undefined })}
        options={uniquePlatformVersions}
        placeholder="Todas"
      />

      {/* Filtro de App Version */}
      <FilterDropdown
        label="App Version"
        value={filters.applicationVersion || ""}
        onChange={(value) => onFilterChange({ ...filters, applicationVersion: value || undefined })}
        options={uniqueApplicationVersions}
        placeholder="Todas"
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

// Componente de dropdown minimalista
interface FilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

function FilterDropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const displayValue = value || placeholder;
  const hasValue = !!value;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
          hasValue
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}:
        </span>
        <span className={`text-xs ${hasValue ? 'font-medium' : ''}`}>
          {displayValue}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          <button
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                value === option
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
