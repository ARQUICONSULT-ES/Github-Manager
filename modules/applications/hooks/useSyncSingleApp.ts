import { useState } from "react";
import type { Application } from "@/modules/applications/types";
import type { SyncProgressLog, SyncStats } from "@/modules/applications/types/sync";

interface UseSyncSingleAppReturn {
  syncApplication: () => Promise<void>;
  isSyncing: boolean;
  error: string | null;
  success: boolean;
  logs: SyncProgressLog[];
  stats: SyncStats;
  resetSync: () => void;
}

export function useSyncSingleApp(
  applicationId: string,
  onSuccess?: (updatedApp: Application) => void
): UseSyncSingleAppReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<SyncProgressLog[]>([]);
  const [stats, setStats] = useState<SyncStats>({
    total: 1,
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

  const resetSync = () => {
    setLogs([]);
    setStats({
      total: 1,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    });
    setError(null);
    setSuccess(false);
  };

  const syncApplication = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      setSuccess(false);
      resetSync();

      addLog('info', '🚀 Iniciando sincronización desde GitHub...');

      const response = await fetch(`/api/applications/${applicationId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al sincronizar aplicación");
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

            if (data.type === 'start') {
              addLog('info', `📦 Procesando: ${data.repo}`);
            } else if (data.type === 'updated') {
              setStats(prev => ({ ...prev, updated: 1, processed: 1 }));
              addLog('success', `✓ Actualizada: ${data.name}`);
            } else if (data.type === 'error') {
              setStats(prev => ({ ...prev, errors: 1, processed: 1 }));
              addLog('error', `✗ Error: ${data.error}`);
              setError(data.error);
            } else if (data.type === 'complete') {
              setSuccess(true);
              addLog('success', `✅ Sincronización completada exitosamente`);
              if (onSuccess && data.application) {
                onSuccess(data.application);
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
    syncApplication,
    isSyncing,
    error,
    success,
    logs,
    stats,
    resetSync,
  };
}
