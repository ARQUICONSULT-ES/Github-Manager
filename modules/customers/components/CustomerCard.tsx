"use client";

import { useState, useRef } from "react";
import type { CustomerCardProps } from "../types";
import { statusColors, statusLabels } from "../types";

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "hace unos segundos";
  if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)} d`;
  if (diffInSeconds < 2592000) return `hace ${Math.floor(diffInSeconds / 604800)} sem`;
  if (diffInSeconds < 31536000) return `hace ${Math.floor(diffInSeconds / 2592000)} mes`;
  return `hace ${Math.floor(diffInSeconds / 31536000)} año`;
}

export function CustomerCard({ customer }: CustomerCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleViewDetails = () => {
    console.log("Ver detalles del cliente:", customer.id);
    setIsMenuOpen(false);
    // TODO: Implementar navegación a detalles
  };

  const handleManageEnvironments = () => {
    console.log("Gestionar entornos del cliente:", customer.id);
    setIsMenuOpen(false);
    // TODO: Implementar gestión de entornos
  };

  const handleManageConnections = () => {
    console.log("Gestionar conexiones del cliente:", customer.id);
    setIsMenuOpen(false);
    // TODO: Implementar gestión de conexiones
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 hover:shadow-lg transition-shadow">
      {/* Header con nombre y menú */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {customer.customerName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">
            {customer.tenantId}
          </p>
        </div>

        {/* Menú de 3 puntos */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={handleMenuToggle}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            title="Más opciones"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handleViewDetails}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Ver detalles
                </button>
                <button
                  onClick={handleManageEnvironments}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Gestionar entornos
                </button>
                <button
                  onClick={handleManageConnections}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Gestionar conexiones
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Badge de estado */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusColors[customer.status]
          }`}
        >
          {statusLabels[customer.status]}
        </span>
      </div>

      {/* Estadísticas */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <span>{customer.environmentsCount} entornos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span>{customer.connectionsCount} conexiones</span>
        </div>
      </div>

      {/* Footer con fecha de actualización */}
      <div className="mt-auto pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Actualizado {getRelativeTime(customer.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
