"use client";

import type { Environment } from "../types";
import { sortEnvironments, filterActivEnvironments, isSoftDeleted } from "../utils/environmentUtils";

interface EnvironmentsListProps {
  environments: Environment[];
  isLoading?: boolean;
  maxVisible?: number;
  onShowMore?: () => void;
  showSoftDeleted?: boolean; // Mostrar soft deleted (para modal)
}

function EnvironmentBadge({ environment }: { environment: Environment }) {
  const isDeleted = isSoftDeleted(environment);
  
  // Círculo de estado (Verde=Active, Amarillo=Pending, Rojo=SoftDeleted)
  const getStatusDotColor = (status?: string | null, isSoftDeleted?: boolean) => {
    if (isSoftDeleted) {
      return "bg-red-500";
    }
    
    if (!status) return "bg-gray-400";
    
    const statusLower = status.toLowerCase();
    if (statusLower === "active" || statusLower === "ready") {
      return "bg-green-500";
    }
    if (statusLower === "pending") {
      return "bg-yellow-500";
    }
    if (statusLower === "preparing" || statusLower === "mounting") {
      return "bg-yellow-400";
    }
    if (statusLower === "removing" || statusLower === "notready") {
      return "bg-red-500";
    }
    return "bg-gray-400";
  };

  // Badge de tipo (Verde=Production, Azul=Sandbox)
  const getTypeBadgeColor = (type?: string | null) => {
    if (!type) return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    
    const typeLower = type.toLowerCase();
    if (typeLower.includes("production")) {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
    if (typeLower.includes("sandbox")) {
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
    if (typeLower.includes("test")) {
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    }
    return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  };

  return (
    <div className={`group relative inline-flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:border-blue-400 dark:hover:border-blue-500 transition-all ${isDeleted ? 'opacity-60' : ''}`}>
      {/* Círculo de estado */}
      <span className={`w-2 h-2 rounded-full ${getStatusDotColor(environment.status, isDeleted)}`} />
      
      {/* Nombre del entorno */}
      <span className={`text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[100px] ${isDeleted ? 'line-through' : ''}`}>
        {environment.name}
      </span>
      
      {/* Badge de tipo de entorno */}
      {environment.type && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getTypeBadgeColor(environment.type)}`}>
          {environment.type}
        </span>
      )}
      
      {/* Tooltip con información detallada */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1.5">
            {environment.name}
          </div>
          {environment.type && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getTypeBadgeColor(environment.type)}`}>
                {environment.type}
              </span>
            </div>
          )}
          {environment.status && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Estado:</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${getStatusDotColor(environment.status, isDeleted)}`} />
                <span className="text-gray-900 dark:text-white font-medium">
                  {environment.status}
                </span>
              </div>
            </div>
          )}
          {isDeleted && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Eliminado:</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                Sí
              </span>
            </div>
          )}
          {environment.applicationVersion && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">App Version:</span>
              <span className="text-gray-900 dark:text-white font-mono">{environment.applicationVersion}</span>
            </div>
          )}
          {environment.platformVersion && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Platform:</span>
              <span className="text-gray-900 dark:text-white font-mono">{environment.platformVersion}</span>
            </div>
          )}
          {environment.locationName && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Location:</span>
              <span className="text-gray-900 dark:text-white">{environment.locationName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EnvironmentsList({ 
  environments, 
  isLoading = false,
  maxVisible = 3,
  onShowMore,
  showSoftDeleted = false // Por defecto no mostrar soft deleted en preview
}: EnvironmentsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Filtrar soft deleted si no queremos mostrarlos
  const filteredEnvs = showSoftDeleted ? environments : filterActivEnvironments(environments);
  
  // Ordenar environments
  const sortedEnvs = sortEnvironments(filteredEnvs);

  if (sortedEnvs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <span className="italic">Haz clic en "Sincronizar" para obtener los entornos</span>
      </div>
    );
  }

  const visibleEnvironments = sortedEnvs.slice(0, maxVisible);
  const remainingCount = sortedEnvs.length - maxVisible;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleEnvironments.map((env) => (
        <EnvironmentBadge key={`${env.tenantId}-${env.name}`} environment={env} />
      ))}
      {remainingCount > 0 && onShowMore && (
        <button
          onClick={onShowMore}
          className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
        >
          +{remainingCount} más
        </button>
      )}
    </div>
  );
}
