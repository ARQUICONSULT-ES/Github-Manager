import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { EnvironmentWithCustomer } from '@/modules/customers/types';

// Interfaz para filtros avanzados
export interface EnvironmentAdvancedFilters {
  status?: string;
  type?: string;
  customer?: string;
  platformVersion?: string;
  applicationVersion?: string;
}

export function useEnvironmentFilter(environments: EnvironmentWithCustomer[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isInitialMount = useRef(true);

  // Inicializar filtros avanzados desde URL con valores por defecto
  const getInitialFilters = useCallback((): EnvironmentAdvancedFilters => {
    return {
      type: searchParams.get('filterType') || undefined,
      status: searchParams.get('filterStatus') || 'Active',
      customer: searchParams.get('filterCustomer') || undefined,
      platformVersion: searchParams.get('filterPlatformVersion') || undefined,
      applicationVersion: searchParams.get('filterApplicationVersion') || undefined,
    };
  }, [searchParams]);

  // Inicializar searchQuery desde URL
  const initialSearchQuery = searchParams.get('search') || '';

  const [advancedFilters, setAdvancedFiltersState] = useState<EnvironmentAdvancedFilters>(getInitialFilters);
  const [searchQuery, setSearchQueryState] = useState(initialSearchQuery);

  // Sincronizar con URL cuando cambian los filtros o el searchQuery
  useEffect(() => {
    // Evitar actualizar la URL en el primer render (ya tiene los valores correctos)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newParams = new URLSearchParams(window.location.search);
    
    // Actualizar parámetro de búsqueda
    if (searchQuery) {
      newParams.set('search', searchQuery);
    } else {
      newParams.delete('search');
    }

    // Actualizar parámetros de filtros - siempre setear si hay valor, eliminar si no hay
    if (advancedFilters.type) {
      newParams.set('filterType', advancedFilters.type);
    } else {
      newParams.delete('filterType');
    }

    if (advancedFilters.status) {
      newParams.set('filterStatus', advancedFilters.status);
    } else {
      newParams.delete('filterStatus');
    }

    if (advancedFilters.customer) {
      newParams.set('filterCustomer', advancedFilters.customer);
    } else {
      newParams.delete('filterCustomer');
    }

    if (advancedFilters.platformVersion) {
      newParams.set('filterPlatformVersion', advancedFilters.platformVersion);
    } else {
      newParams.delete('filterPlatformVersion');
    }

    if (advancedFilters.applicationVersion) {
      newParams.set('filterApplicationVersion', advancedFilters.applicationVersion);
    } else {
      newParams.delete('filterApplicationVersion');
    }

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    
    // Solo actualizar si la URL realmente cambió
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [advancedFilters, searchQuery, router]);

  // Aplicar filtros avanzados
  const filteredByAdvancedFilters = useMemo(() => {
    let result = [...environments];

    // Si hay un filtro de estado específico, aplicarlo
    if (advancedFilters.status) {
      const statuses = advancedFilters.status.split('|');
      result = result.filter(env => statuses.includes(env.status || ''));
    } else {
      // Si no hay filtro de estado, excluir softdeleted por defecto
      result = result.filter(env => env.status?.toLowerCase() !== 'softdeleted');
    }

    if (advancedFilters.type) {
      const types = advancedFilters.type.split('|');
      result = result.filter(env => env.type && types.includes(env.type));
    }

    if (advancedFilters.customer) {
      const customers = advancedFilters.customer.split('|');
      result = result.filter(env => customers.includes(env.customerName));
    }

    if (advancedFilters.platformVersion) {
      const versions = advancedFilters.platformVersion.split('|');
      result = result.filter(env => env.platformVersion && versions.includes(env.platformVersion));
    }

    if (advancedFilters.applicationVersion) {
      const versions = advancedFilters.applicationVersion.split('|');
      result = result.filter(env => env.applicationVersion && versions.includes(env.applicationVersion));
    }

    return result;
  }, [environments, advancedFilters]);

  // Aplicar filtro de búsqueda
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredByAdvancedFilters;
    }

    const query = searchQuery.toLowerCase();
    return filteredByAdvancedFilters.filter((env) => {
      // Buscar en nombre, cliente, tipo
      return (
        env.name.toLowerCase().includes(query) ||
        env.customerName.toLowerCase().includes(query) ||
        (env.type && env.type.toLowerCase().includes(query))
      );
    });
  }, [filteredByAdvancedFilters, searchQuery]);

  // Ordenar: Production primero, luego el resto
  const filteredEnvironments = useMemo(() => {
    return [...filteredBySearch].sort((a, b) => {
      const aIsProduction = a.type?.toLowerCase() === 'production';
      const bIsProduction = b.type?.toLowerCase() === 'production';
      
      if (aIsProduction && !bIsProduction) return -1;
      if (!aIsProduction && bIsProduction) return 1;
      return 0;
    });
  }, [filteredBySearch]);

  // Función para limpiar filtros avanzados (volver a valores por defecto)
  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFiltersState({
      status: 'Active',
    });
  }, []);

  // Función para actualizar filtros avanzados
  const updateAdvancedFilters = useCallback((newFilters: EnvironmentAdvancedFilters) => {
    setAdvancedFiltersState(newFilters);
  }, []);

  // Función para actualizar el searchQuery
  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
  }, []);

  return {
    filteredEnvironments,
    searchQuery,
    setSearchQuery,
    advancedFilters,
    updateAdvancedFilters,
    clearAdvancedFilters,
  };
}
