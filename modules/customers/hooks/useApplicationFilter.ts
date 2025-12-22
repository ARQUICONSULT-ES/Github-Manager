import { useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ApplicationWithEnvironment } from '@/modules/customers/types';
import type { FilterConfig } from '@/modules/customers/types/filters';
import { useGenericFilter } from './useGenericFilter';

// Configuración de filtros para aplicaciones
export const applicationFilterConfig: FilterConfig<ApplicationWithEnvironment> = {
  fields: [
    {
      key: "name",
      label: "Nombre de la Aplicación",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por nombre...",
      getValue: (app) => app.name,
    },
    {
      key: "publisher",
      label: "Publisher",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por publisher...",
      getValue: (app) => app.publisher,
    },
    {
      key: "customerName",
      label: "Cliente",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por cliente...",
      getValue: (app) => app.customerName,
    },
    {
      key: "environmentName",
      label: "Entorno",
      type: "text",
      operator: "contains",
      placeholder: "Filtrar por entorno...",
      getValue: (app) => app.environmentName,
    },
  ],
};

export function useApplicationFilter(applications: ApplicationWithEnvironment[]) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Inicializar filtros personalizados desde URL
  const initialFilterType = (searchParams.get('envType') as "all" | "Production" | "Sandbox") || 'all';
  const initialHideMicrosoft = searchParams.get('hideMicrosoft') !== 'false'; // por defecto true

  const [filterEnvironmentType, setFilterEnvironmentTypeState] = useState<"all" | "Production" | "Sandbox">(initialFilterType);
  const [hideMicrosoftApps, setHideMicrosoftAppsState] = useState(initialHideMicrosoft);

  // Aplicar filtros personalizados antes de pasar al hook genérico
  const preFilteredApps = useMemo(() => {
    let filtered = [...applications];

    // Filtro de tipo de entorno
    if (filterEnvironmentType !== "all") {
      filtered = filtered.filter(app => app.environmentType === filterEnvironmentType);
    }

    // Filtro para ocultar apps de Microsoft
    if (hideMicrosoftApps) {
      filtered = filtered.filter(app => app.publisher.toLowerCase() !== "microsoft");
    }

    return filtered;
  }, [applications, filterEnvironmentType, hideMicrosoftApps]);

  // Usar el hook genérico para búsqueda
  const {
    filteredItems: filteredApps,
    searchQuery,
    setSearchQuery,
  } = useGenericFilter(preFilteredApps, applicationFilterConfig, undefined, { syncWithUrl: true });

  // Función para actualizar filtros personalizados en la URL
  const updateCustomFilterUrl = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== 'false') {
        newParams.set(key, value);
      } else if (key === 'hideMicrosoft' && value === 'true') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  const setFilterEnvironmentType = useCallback((value: "all" | "Production" | "Sandbox") => {
    setFilterEnvironmentTypeState(value);
    updateCustomFilterUrl({ envType: value });
  }, [updateCustomFilterUrl]);

  const setHideMicrosoftApps = useCallback((value: boolean) => {
    setHideMicrosoftAppsState(value);
    updateCustomFilterUrl({ hideMicrosoft: value.toString() });
  }, [updateCustomFilterUrl]);

  return {
    filteredApps,
    searchQuery,
    setSearchQuery,
    filterEnvironmentType,
    setFilterEnvironmentType,
    hideMicrosoftApps,
    setHideMicrosoftApps,
  };
}
