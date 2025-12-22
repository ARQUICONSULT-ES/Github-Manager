"use client";

import { useState, useEffect, useCallback } from "react";
import type { Application } from "@/modules/applications/types";
import { dataCache, CACHE_KEYS } from "@/modules/shared/utils/cache";

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>(() => {
    // Intentar cargar desde cache al inicializar
    return dataCache.get<Application[]>(CACHE_KEYS.APPLICATIONS) || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Si hay datos en cache, no mostrar loading
    return !dataCache.has(CACHE_KEYS.APPLICATIONS);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/api/app-catalog");
      
      if (!response.ok) {
        throw new Error("Error al cargar las aplicaciones");
      }
      
      const data = await response.json();
      const applicationsData = data.applications || [];
      
      setApplications(applicationsData);
      // Guardar en cache
      dataCache.set(CACHE_KEYS.APPLICATIONS, applicationsData);
    } catch (err) {
      console.error("Error loading applications:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setApplications([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshApplications = useCallback(async () => {
    await loadApplications(true);
  }, [loadApplications]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  return {
    applications,
    isLoading,
    isRefreshing,
    error,
    refreshApplications,
  };
}
