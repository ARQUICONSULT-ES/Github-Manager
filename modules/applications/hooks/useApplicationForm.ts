"use client";

import { useState } from "react";
import type { Application, ApplicationFormData } from "@/modules/applications/types";

interface UseApplicationFormProps {
  application?: Application;
  onSuccess?: () => void;
}

export function useApplicationForm({ application, onSuccess }: UseApplicationFormProps) {
  const [formData, setFormData] = useState<ApplicationFormData>({
    name: application?.name || "",
    publisher: application?.publisher || "",
    githubRepoName: application?.githubRepoName || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof ApplicationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // Validación
    if (!formData.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!formData.publisher.trim()) {
      setError("El publisher es requerido");
      return;
    }
    if (!formData.githubRepoName.trim()) {
      setError("El nombre del repositorio de GitHub es requerido");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = application
        ? `/api/applications/${application.id}`
        : "/api/applications";
      
      const method = application ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar la aplicación");
      }

      onSuccess?.();
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!application) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar la aplicación");
      }

      onSuccess?.();
    } catch (err) {
      console.error("Error deleting application:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    isLoading,
    error,
    handleChange,
    handleSubmit,
    handleDelete,
  };
}
