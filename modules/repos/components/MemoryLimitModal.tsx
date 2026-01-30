"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/modules/shared/hooks/useToast";

interface MemoryLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: string;
  repo: string;
}

interface MemoryLimitData {
  currentMemoryLimit: string;
  fullSettings: any;
}

type SaveStep = 
  | { status: 'idle' }
  | { status: 'creating_branch'; message: string }
  | { status: 'completed'; message: string }
  | { status: 'error'; message: string };

const MEMORY_OPTIONS = [
  { value: '8G', label: '8GB', description: 'Default - Sin verticales, Tegos' },
  { value: '16G', label: '16GB', description: 'Medio' },
  { value: '24G', label: '24GB', description: 'Alto' },
  { value: '32G', label: '32GB', description: 'Máximo - LS Central' },
];

const LoadingSpinner = ({ text = "Cargando..." }: { text?: string }) => (
  <div className="flex items-center justify-center h-32">
    <div className="flex items-center gap-2 text-gray-400">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-sm">{text}</span>
    </div>
  </div>
);

export function MemoryLimitModal({ isOpen, onClose, owner, repo }: MemoryLimitModalProps) {
  const { error: showError, success: showSuccess } = useToast();
  
  const [memoryData, setMemoryData] = useState<MemoryLimitData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<string>('8G');
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep>({ status: 'idle' });

  const isSaving = saveStep.status !== 'idle' && saveStep.status !== 'completed';

  useEffect(() => {
    if (!isOpen) return;

    // Reset estados al abrir el modal
    setMemoryData(null);
    setError(null);
    setSelectedMemory('8G');
    setSaveStep({ status: 'idle' });

    fetchMemoryLimit();
    fetchBranches();
  }, [isOpen, owner, repo]);

  // Bloquear cierre con Escape mientras se está guardando
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSaving) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isSaving]);

  const fetchMemoryLimit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch .github/AL-Go-Settings.json
      const settingsRes = await fetch(
        `/api/github/file-content?owner=${owner}&repo=${repo}&path=.github/AL-Go-Settings.json&ref=main`,
        { cache: "no-store" }
      );

      if (!settingsRes.ok) {
        throw new Error("No se pudo obtener .github/AL-Go-Settings.json");
      }

      const settingsData = await settingsRes.json();
      const currentMemoryLimit = settingsData.content.memoryLimit || '8G';

      setMemoryData({
        currentMemoryLimit,
        fullSettings: settingsData.content,
      });

      setSelectedMemory(currentMemoryLimit);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      showError(err instanceof Error ? err.message : "Error al cargar configuración de memoria");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const res = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`, { cache: "no-store" });
      
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches);
        
        // Prioridad: dev -> main -> primera disponible
        let defaultBranch = "main";
        if (data.branches.includes("dev")) {
          defaultBranch = "dev";
        } else if (data.branches.includes("main")) {
          defaultBranch = "main";
        } else if (data.branches.length > 0) {
          defaultBranch = data.branches[0];
        }
        
        setSelectedBranch(defaultBranch);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const hasChanges = (): boolean => {
    if (!memoryData) return false;
    return selectedMemory !== memoryData.currentMemoryLimit;
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      showError("No hay cambios para guardar");
      return;
    }

    try {
      setSaveStep({ status: 'creating_branch', message: 'Creando rama y actualizando configuración...' });

      const updateRes = await fetch('/api/github/update-memory-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          baseBranch: selectedBranch,
          memoryLimit: selectedMemory,
        }),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json();
        throw new Error(errorData.error || 'Error al actualizar límite de memoria');
      }

      const result = await updateRes.json();
      setSaveStep({ status: 'completed', message: 'Pull Request creado exitosamente' });
      
      // Abrir PR y cerrar modal después de un breve momento
      window.open(result.pullRequestUrl, '_blank');
      setTimeout(() => {
        setSaveStep({ status: 'idle' });
        onClose();
      }, 1000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar cambios';
      setSaveStep({ status: 'error', message: errorMessage });
      showError(errorMessage);
      setSaveStep({ status: 'idle' });
    }
  };

  const handleClose = () => {
    if (isSaving) return; // No cerrar mientras se guarda
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Límite de Memoria de Compilación
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <LoadingSpinner text="Cargando configuración..." />
          ) : error ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : memoryData ? (
            <div className="space-y-6">
              
              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-2">Límite de memoria para Docker</p>
                    <p className="mb-2">Este valor determina la cantidad máxima de RAM que usará el contenedor Docker durante la compilación.</p>
                    <p className="font-medium mb-1">Recomendaciones:</p>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                      <li><strong>8GB</strong>: Business Central sin verticales o Tegos</li>
                      <li><strong>32GB</strong>: LS Central</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Memory Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Seleccionar nuevo límite
                </label>
                <div className="space-y-3">
                  {MEMORY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedMemory === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="memory"
                        value={option.value}
                        checked={selectedMemory === option.value}
                        onChange={(e) => setSelectedMemory(e.target.value)}
                        disabled={isSaving}
                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                          {option.value === memoryData.currentMemoryLimit && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Actual
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Progress */}
              {saveStep.status !== 'idle' && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  {saveStep.status === 'creating_branch' && (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{saveStep.message}</span>
                    </div>
                  )}

                  {saveStep.status === 'completed' && (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {saveStep.message}
                      </span>
                    </div>
                  )}

                  {saveStep.status === 'error' && (
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-red-600 dark:text-red-400">{saveStep.message}</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {/* Branch Selector - izquierda */}
          <div className="flex items-center gap-2">
            {isLoadingBranches ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs">Cargando ramas...</span>
              </div>
            ) : (
              <>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rama base:
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={isSaving}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Botones - derecha */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStep.status === 'completed' ? 'Cerrar' : 'Cancelar'}
            </button>
            {saveStep.status !== 'completed' && (
              <button
                onClick={handleSave}
                disabled={!hasChanges() || isSaving || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  `Crear PR a ${selectedBranch}`
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
