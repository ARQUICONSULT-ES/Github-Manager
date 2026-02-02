import { useState, useEffect, useRef, useCallback } from "react";
import { GitHubRepository } from "@/types/github";
import { RepoExtraInfo } from "@/modules/repos/types";
import { fetchBatchRepoInfo } from "@/modules/repos/services/batchInfoService";
import { dataCache, CACHE_KEYS } from "@/modules/shared/utils/cache";

interface UseRepoExtraInfoReturn {
  extraInfo: Record<string, RepoExtraInfo>;
  isLoading: boolean;
  isLoadingIncremental: boolean;
  loadWorkflows: () => Promise<void>;
  resetExtraInfo: () => void;
}

const COOLDOWN_MS = 1000; // 1 segundo de cooldown entre cargas

/**
 * Hook para gestionar la carga de información adicional de repositorios
 * (releases, workflows, PRs, branches)
 * Ahora con soporte para cargar información faltante cuando aparecen nuevos repos filtrados
 */
export function useRepoExtraInfo(repos: GitHubRepository[]): UseRepoExtraInfoReturn {
  const [extraInfo, setExtraInfo] = useState<Record<string, RepoExtraInfo>>(() => {
    // Intentar cargar desde cache al inicializar
    return dataCache.get<Record<string, RepoExtraInfo>>(CACHE_KEYS.REPO_EXTRA_INFO) || {};
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingIncremental, setIsLoadingIncremental] = useState(false);
  const hasLoadedData = useRef<boolean>(dataCache.has(CACHE_KEYS.REPO_EXTRA_INFO));
  const lastLoadTime = useRef<number>(0);
  const loadingMissingInfo = useRef<boolean>(false);

  // Cargar toda la información automáticamente cuando se obtienen los repos por primera vez
  useEffect(() => {
    if (repos.length === 0 || hasLoadedData.current) return;
    
    hasLoadedData.current = true;
    setIsLoading(true);
    lastLoadTime.current = Date.now();
    
    const loadRepoInfo = async () => {
      try {
        const repoRequests = repos.map((repo) => {
          const [owner, repoName] = repo.full_name.split("/");
          return { owner, repo: repoName };
        });

        const repoInfoData = await fetchBatchRepoInfo(repoRequests);
        console.log('[useRepoExtraInfo] Batch info response:', repoInfoData);
        console.log('[useRepoExtraInfo] Total repos with data:', Object.keys(repoInfoData).length);
        
        setExtraInfo(repoInfoData);
        // Guardar en cache
        dataCache.set(CACHE_KEYS.REPO_EXTRA_INFO, repoInfoData);
      } catch (error) {
        console.error("Error fetching repo info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRepoInfo();
  }, [repos]);

  // Efecto para cargar información de repos que aparecen después (por ejemplo, al cambiar filtros)
  useEffect(() => {
    if (repos.length === 0 || !hasLoadedData.current || loadingMissingInfo.current) return;
    
    // Verificar si hay repos sin información
    const reposWithoutInfo = repos.filter(repo => !extraInfo[repo.full_name]);
    
    if (reposWithoutInfo.length === 0) return;
    
    // Aplicar cooldown para evitar demasiadas peticiones
    const timeSinceLastLoad = Date.now() - lastLoadTime.current;
    if (timeSinceLastLoad < COOLDOWN_MS) {
      // Esperar el tiempo restante del cooldown
      const timeoutId = setTimeout(() => {
        loadMissingInfo(reposWithoutInfo);
      }, COOLDOWN_MS - timeSinceLastLoad);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Cargar inmediatamente si ya pasó el cooldown
    loadMissingInfo(reposWithoutInfo);
    
    async function loadMissingInfo(missingRepos: GitHubRepository[]) {
      if (loadingMissingInfo.current) return;
      
      loadingMissingInfo.current = true;
      setIsLoadingIncremental(true);
      lastLoadTime.current = Date.now();
      
      try {
        console.log(`[useRepoExtraInfo] Loading info for ${missingRepos.length} new repos`);
        
        const repoRequests = missingRepos.map((repo) => {
          const [owner, repoName] = repo.full_name.split("/");
          return { owner, repo: repoName };
        });

        const newRepoInfo = await fetchBatchRepoInfo(repoRequests);
        
        setExtraInfo(prev => {
          const updated = { ...prev, ...newRepoInfo };
          // Actualizar cache
          dataCache.set(CACHE_KEYS.REPO_EXTRA_INFO, updated);
          return updated;
        });
        
        console.log(`[useRepoExtraInfo] Successfully loaded info for ${Object.keys(newRepoInfo).length} repos`);
      } catch (error) {
        console.error("[useRepoExtraInfo] Error loading missing repo info:", error);
      } finally {
        loadingMissingInfo.current = false;
        setIsLoadingIncremental(false);
      }
    }
  }, [repos, extraInfo]);

  // Función para recargar workflows manualmente (mantener compatibilidad)
  const loadWorkflows = useCallback(async () => {
    if (repos.length === 0) return;
    
    setIsLoading(true);
    try {
      const repoRequests = repos.map((repo) => {
        const [owner, repoName] = repo.full_name.split("/");
        return { owner, repo: repoName };
      });

      const repoInfoData = await fetchBatchRepoInfo(repoRequests);
      
      setExtraInfo(repoInfoData);
      // Guardar en cache
      dataCache.set(CACHE_KEYS.REPO_EXTRA_INFO, repoInfoData);
    } catch (error) {
      console.error("Error fetching repo info:", error);
    } finally {
      setIsLoading(false);
    }
  }, [repos]);

  const resetExtraInfo = useCallback(() => {
    setExtraInfo({});
    hasLoadedData.current = false;
    // Invalidar cache
    dataCache.invalidate(CACHE_KEYS.REPO_EXTRA_INFO);
  }, []);

  return {
    extraInfo,
    isLoading,
    isLoadingIncremental,
    loadWorkflows,
    resetExtraInfo,
  };
}
