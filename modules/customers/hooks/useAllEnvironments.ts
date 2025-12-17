import { useState, useEffect, useCallback } from 'react';
import { fetchAllEnvironments } from '../services/environmentService';
import type { EnvironmentWithCustomer } from '../types';

export function useAllEnvironments() {
  const [environments, setEnvironments] = useState<EnvironmentWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEnvironments = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await fetchAllEnvironments();
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar environments');
      console.error('Error loading environments:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const reload = useCallback(async () => {
    await loadEnvironments(true);
  }, [loadEnvironments]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  return {
    environments,
    loading,
    isRefreshing,
    error,
    reload,
  };
}
