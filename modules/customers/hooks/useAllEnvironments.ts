import { useState, useEffect } from 'react';
import { fetchAllEnvironments } from '../services/environmentService';
import type { EnvironmentWithCustomer } from '../types';

export function useAllEnvironments() {
  const [environments, setEnvironments] = useState<EnvironmentWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllEnvironments();
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar environments');
      console.error('Error loading environments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnvironments();
  }, []);

  return {
    environments,
    loading,
    error,
    reload: loadEnvironments,
  };
}
