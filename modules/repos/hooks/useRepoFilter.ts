import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GitHubRepository } from "@/types/github";

type SortOption = "updated" | "name";

interface UseRepoFilterReturn {
  filteredRepos: GitHubRepository[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (option: SortOption) => void;
}

/**
 * Hook para gestionar el filtrado y ordenamiento de repositorios
 */
export function useRepoFilter(repos: GitHubRepository[]): UseRepoFilterReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Inicializar desde URL
  const initialSearchQuery = searchParams.get('search') || '';
  const initialSortBy = (searchParams.get('sort') as SortOption) || 'updated';

  const [searchQuery, setSearchQueryState] = useState(initialSearchQuery);
  const [sortBy, setSortByState] = useState<SortOption>(initialSortBy);

  // Función para actualizar la URL
  const updateUrl = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'updated') { // 'updated' es el valor por defecto
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  // Wrappers que actualizan la URL
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    updateUrl({ search: query });
  }, [updateUrl]);

  const setSortBy = useCallback((option: SortOption) => {
    setSortByState(option);
    updateUrl({ sort: option });
  }, [updateUrl]);

  const filteredRepos = useMemo(() => {
    let result = [...repos];

    // Filtrar por nombre (espacios se convierten en guiones)
    if (searchQuery.trim()) {
      const normalizedQuery = searchQuery.trim().toLowerCase().replace(/\s+/g, "-");
      result = result.filter((repo) =>
        repo.name.toLowerCase().includes(normalizedQuery)
      );
    }

    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "updated":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [repos, searchQuery, sortBy]);

  return {
    filteredRepos,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
  };
}
