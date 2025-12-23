import { useState, useEffect, useCallback } from 'react';
import type { InstalledAppWithEnvironment } from '@/modules/customers/types';

interface SyncResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ environmentName: string; error: string }>;
}

export function useCustomerInstalledApps(customerId?: string) {
  const [installedApps, setInstalledApps] = useState<InstalledAppWithEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInstalledApps = useCallback(async () => {
    if (!customerId) {
      setInstalledApps([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/installedapps?customerId=${customerId}`);
      if (!response.ok) {
        throw new Error('Error al cargar las instalaciones');
      }
      
      const data = await response.json();
      setInstalledApps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar instalaciones');
      console.error('Error loading customer installed apps:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const reload = useCallback(async () => {
    await loadInstalledApps();
  }, [loadInstalledApps]);

  const syncInstalledApps = useCallback(async (): Promise<SyncResult | null> => {
    if (!customerId) return null;

    try {
      setIsRefreshing(true);
      setError(null);

      const response = await fetch(`/api/installedapps/sync-customer/${customerId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al sincronizar las instalaciones');
      }

      const result: SyncResult = await response.json();
      
      // Recargar los datos después de la sincronización
      await loadInstalledApps();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error syncing customer installed apps:', err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [customerId, loadInstalledApps]);

  useEffect(() => {
    if (customerId) {
      loadInstalledApps();
    }
  }, [customerId, loadInstalledApps]);

  return {
    installedApps,
    loading,
    isRefreshing,
    error,
    reload,
    syncInstalledApps,
  };
}
