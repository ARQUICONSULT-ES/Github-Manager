"use client";

import { useState, useEffect } from "react";
import type { InstalledAppWithEnvironment } from "@/modules/customers/types";

interface UseApplicationInstallationsReturn {
  installations: InstalledAppWithEnvironment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApplicationInstallations(
  applicationId?: string
): UseApplicationInstallationsReturn {
  const [installations, setInstallations] = useState<InstalledAppWithEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallations = async () => {
    if (!applicationId) {
      setInstallations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}/installations`);

      if (!response.ok) {
        throw new Error("Error al cargar las instalaciones");
      }

      const data = await response.json();
      setInstallations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setInstallations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallations();
  }, [applicationId]);

  return {
    installations,
    loading,
    error,
    refetch: fetchInstallations,
  };
}
