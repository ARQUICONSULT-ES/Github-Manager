import { useState } from "react";
import type { SyncProgressLog, SyncStats } from "@/modules/applications/types/sync";

interface SyncResults {
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ repo: string; error: string }>;
}

interface UseSyncFromGitHubReturn {
  syncFromGitHub: () => Promise<void>;
  isSyncing: boolean;
  syncResults: SyncResults | null;
  error: string | null;
  logs: SyncProgressLog[];
  stats: SyncStats;
  resetSync: () => void;
}

export function useSyncFromGitHub(onSuccess?: () => void): UseSyncFromGitHubReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SyncProgressLog[]>([]);
  const [stats, setStats] = useState<SyncStats>({
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  });

  const addLog = (type: SyncProgressLog['type'], message: string) => {
    setLogs(prev => [...prev, {
      type,
      message,
      timestamp: new Date(),
    }]);
  };

  const updateStats = (key: keyof SyncStats, increment: boolean = true) => {
    setStats(prev => ({
      ...prev,
      [key]: increment ? prev[key] + 1 : prev[key],
    }));
  };

  const resetSync = () => {
    setLogs([]);
    setStats({
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    });
    setSyncResults(null);
    setError(null);
  };

  const syncFromGitHub = async () => {  
    try {
      setIsSyncing(true);
      setError(null);
      setSyncResults(null);
      resetSync();

      addLog('info', '🚀 Iniciando sincronización desde GitHub...');

      const response = await fetch("/api/applications/sync-github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al sincronizar aplicaciones");
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No se pudo leer la respuesta del servidor");
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'total') {
              setStats(prev => ({ ...prev, total: data.count }));
              addLog('info', `📦 Se encontraron ${data.count} repositorios`);
            } else if (data.type === 'processing') {
              addLog('info', `🔍 Procesando: ${data.repo}`);
            } else if (data.type === 'created') {
              updateStats('created');
              updateStats('processed');
              addLog('success', `✓ Creada: ${data.name}`);
            } else if (data.type === 'updated') {
              updateStats('updated');
              updateStats('processed');
              addLog('success', `↻ Actualizada: ${data.name}`);
            } else if (data.type === 'skipped') {
              updateStats('skipped');
              updateStats('processed');
              addLog('warning', `⊘ Omitida: ${data.repo} - ${data.reason}`);
            } else if (data.type === 'error') {
              updateStats('errors');
              updateStats('processed');
              addLog('error', `✗ Error en ${data.repo}: ${data.error}`);
            } else if (data.type === 'complete') {
              setSyncResults(data.results);
              addLog('success', `✅ Sincronización completada exitosamente`);
              if (onSuccess) {
                onSuccess();
              }
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      addLog('error', `❌ Error: ${errorMessage}`);
      console.error("Error en sincronización:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncFromGitHub,
    isSyncing,
    syncResults,
    error,
    logs,
    stats,
    resetSync,
  };
}
