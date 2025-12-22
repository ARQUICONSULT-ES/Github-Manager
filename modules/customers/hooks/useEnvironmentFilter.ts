import { useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { EnvironmentWithCustomer } from '@/modules/customers/types';
import type { FilterConfig } from '@/modules/customers/types/filters';
import { useGenericFilter } from './useGenericFilter';

type SortBy = 'name' | 'customer' | 'type';

// Configuración de filtros para entornos
export const environmentFilterConfig: FilterConfig<EnvironmentWithCustomer> = {
  fields: [
    {
      key: "name",
      label: "Nombre del Entorno",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por nombre...",
      getValue: (env) => env.name,
    },
    {
      key: "customerName",
      label: "Cliente",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por cliente...",
      getValue: (env) => env.customerName,
    },
    {
      key: "type",
      label: "Tipo",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por tipo...",
      getValue: (env) => env.type || '',
    },
  ],
};

export function useEnvironmentFilter(environments: EnvironmentWithCustomer[]) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Inicializar showDeleted desde URL
  const initialShowDeleted = searchParams.get('showDeleted') === 'true';
  const [showDeleted, setShowDeletedState] = useState(initialShowDeleted);

  // Filtrar entornos eliminados antes de pasar al hook genérico
  const filteredByStatus = useMemo(() => {
    if (showDeleted) {
      return environments;
    }
    return environments.filter(env => env.status?.toLowerCase() !== 'softdeleted');
  }, [environments, showDeleted]);

  // Usar el hook genérico para búsqueda y ordenación
  const {
    filteredItems: filteredEnvironments,
    searchQuery,
    setSearchQuery: setSearchQueryBase,
    sortBy,
    setSortBy: setSortByBase,
  } = useGenericFilter(filteredByStatus, environmentFilterConfig, 'customer', { syncWithUrl: true });

  // Función para actualizar showDeleted en la URL
  const updateShowDeletedUrl = useCallback((value: boolean) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    if (value) {
      newParams.set('showDeleted', 'true');
    } else {
      newParams.delete('showDeleted');
    }

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  const setShowDeleted = useCallback((value: boolean) => {
    setShowDeletedState(value);
    updateShowDeletedUrl(value);
  }, [updateShowDeletedUrl]);

  return {
    filteredEnvironments,
    searchQuery,
    setSearchQuery: setSearchQueryBase,
    sortBy: sortBy as SortBy,
    setSortBy: setSortByBase as (value: SortBy) => void,
    showDeleted,
    setShowDeleted,
  };
}
