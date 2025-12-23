import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GitHubRepository } from "@/types/github";
import { dataCache, CACHE_KEYS } from "../../shared/utils/cache";

interface UseReposReturn {
  repos: GitHubRepository[];
  isLoading: boolean;
  error: string | null;
  needsToken: boolean;
  fetchRepos: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook para gestionar la carga de repositorios desde la API de GitHub
 */
export function useRepos(): UseReposReturn {
  const { update: updateSession } = useSession();
  const [repos, setRepos] = useState<GitHubRepository[]>(() => {
    // Intentar cargar desde cache al inicializar
    return dataCache.get<GitHubRepository[]>(CACHE_KEYS.REPOS) || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Si hay datos en cache, no mostrar loading
    return !dataCache.has(CACHE_KEYS.REPOS);
  });
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const router = useRouter();

  const fetchRepos = async () => {
    setIsLoading(true);
    setError(null);
    setNeedsToken(false);
    
    try {
      const res = await fetch("/api/github/repos");
      
      if (res.status === 401) {
        const data = await res.json();
        if (data.error?.includes("GitHub token")) {
          setNeedsToken(true);
          setError("Se requiere un token de GitHub para acceder a los repositorios");
          return;
        }
        router.push("/");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cargar repositorios");
      }

      const data = await res.json();
      
      // Si la respuesta incluye un avatar actualizado, actualizar la sesión
      if (data.githubAvatar !== undefined) {
        await updateSession({ 
          image: data.githubAvatar 
        });
      }
      
      // La respuesta ahora incluye { repos, githubAvatar }
      const repositories = data.repos || data;
      setRepos(repositories);
      // Guardar en cache
      dataCache.set(CACHE_KEYS.REPOS, repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Siempre cargar los repos al montar el componente para verificar el token
    fetchRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    repos,
    isLoading,
    error,
    needsToken,
    fetchRepos,
    refetch: fetchRepos,
  };
}
