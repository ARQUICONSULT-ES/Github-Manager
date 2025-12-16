"use client";

import { useEffect } from "react";
import type { Environment } from "../types";
import { sortEnvironments, isSoftDeleted } from "../utils/environmentUtils";

interface EnvironmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  tenantName?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EnvironmentsModal({
  isOpen,
  onClose,
  environments,
  tenantName,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
}: EnvironmentsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  const getStatusColor = (status?: string | null, isSoftDeleted?: boolean) => {
    // SoftDeleted tiene prioridad
    if (isSoftDeleted) {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    
    if (!status) return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    
    const statusLower = status.toLowerCase();
    if (statusLower === "active" || statusLower === "ready") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
    if (statusLower === "pending") {
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    }
    if (statusLower === "preparing" || statusLower === "mounting") {
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
    if (statusLower === "removing" || statusLower === "notready") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Entornos
            </h2>
            {tenantName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tenantName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                title="Actualizar entornos"
              >
                <svg 
                  className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : environments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                No hay entornos disponibles
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortEnvironments(environments).map((env) => {
                const isDeleted = isSoftDeleted(env);
                return (
                  <div
                    key={`${env.tenantId}-${env.name}`}
                    className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors ${isDeleted ? 'opacity-60 bg-red-50 dark:bg-red-900/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-semibold text-gray-900 dark:text-white ${isDeleted ? 'line-through' : ''}`}>
                            {env.name}
                          </h3>
                          
                          {/* Badge de tipo */}
                          {env.type && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(env.type)}`}>
                              {env.type}
                            </span>
                          )}
                        </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {env.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${getStatusDotColor(env.status, isDeleted)}`} />
                              <span className="text-gray-900 dark:text-white font-medium">{env.status}</span>
                            </div>
                          </div>
                        )}
                        {isDeleted && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">Eliminado:</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">Sí</span>
                          </div>
                        )}
                        {env.applicationVersion && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">App Version:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">{env.applicationVersion}</span>
                          </div>
                        )}
                        {env.platformVersion && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">Platform:</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">{env.platformVersion}</span>
                          </div>
                        )}
                        {env.locationName && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">Location:</span>
                            <span className="text-gray-900 dark:text-white">{env.locationName}</span>
                          </div>
                        )}
                      </div>
                      
                      {env.webClientUrl && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <a
                            href={env.webClientUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Abrir Web Client
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {environments.length} {environments.length === 1 ? "entorno" : "entornos"}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
