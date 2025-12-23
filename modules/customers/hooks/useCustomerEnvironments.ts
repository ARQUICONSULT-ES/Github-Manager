import { useState, useEffect, useCallback } from 'react';
import type { EnvironmentWithCustomer } from '@/modules/customers/types';

export function useCustomerEnvironments(customerId?: string) {
  const [environments, setEnvironments] = useState<EnvironmentWithCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEnvironments = useCallback(async (showRefreshing = false) => {
    if (!customerId) {
      setEnvironments([]);
      return;
    }

    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const response = await fetch(`/api/environments?customerId=${customerId}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar los entornos del cliente');
      }
      
      const data = await response.json();
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar entornos');
      console.error('Error loading customer environments:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [customerId]);

  const reload = useCallback(async () => {
    await loadEnvironments(true);
  }, [loadEnvironments]);

  const syncEnvironments = useCallback(async () => {
    if (!customerId) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/environments/sync-customer/${customerId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al sincronizar los entornos');
      }

      const result = await response.json();
      await loadEnvironments(true);
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [customerId, loadEnvironments]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  return {
    environments,
    loading,
    isRefreshing,
    error,
    reload,
    syncEnvironments,
  };
}
