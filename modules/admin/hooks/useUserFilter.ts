"use client";

import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { User } from "@/modules/admin/types";

export function useUserFilter(users: User[]) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Inicializar desde URL
  const initialSearchQuery = searchParams.get('search') || '';
  const [searchQuery, setSearchQueryState] = useState(initialSearchQuery);

  // Función para actualizar la URL
  const updateUrl = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  // Wrapper que actualiza la URL
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    updateUrl({ search: query });
  }, [updateUrl]);

  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    // Aplicar búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [users, searchQuery]);

  return {
    filteredUsers,
    searchQuery,
    setSearchQuery,
  };
}
