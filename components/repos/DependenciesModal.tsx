"use client";

import { useState, useEffect } from "react";
import { GitHubRepository } from "@/types/github";

interface AppDependencyProbingPath {
  repo: string;
  version: string;
  release_status: string;
  authTokenSecret?: string;
  projects?: string;
}

interface FileDependency {
  name: string;
  path: string;
  sha: string;
  size: number;
}

interface AppDependency {
  id: string;
  name: string;
  publisher: string;
  version: string;
}

interface DependenciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: string;
  repo: string;
  allRepos: GitHubRepository[];
}

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

const EmptyState = ({ message, icon }: { message: string; icon: React.ReactNode }) => (
  <div className="flex items-center justify-center h-32">
    <div className="text-center">
      {icon}
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  </div>
);

const formatFileSize = (size: number) => 
  size >= 1024 * 1024 
    ? `${(size / (1024 * 1024)).toFixed(2)} MB`
    : `${(size / 1024).toFixed(2)} KB`;

type SaveStep = 
  | { status: 'idle' }
  | { status: 'updating-settings'; message: 'Actualizando settings.json...' }
  | { status: 'uploading-files'; message: string; current: number; total: number }
  | { status: 'deleting-files'; message: string; current: number; total: number }
  | { status: 'creating-pr'; message: 'Creando Pull Request...' }
  | { status: 'completed'; message: 'Pull Request creado exitosamente' };

export function DependenciesModal({ isOpen, onClose, owner, repo, allRepos }: DependenciesModalProps) {
  const [settingsData, setSettingsData] = useState<{
    appDependencyProbingPaths: AppDependencyProbingPath[];
  } | null>(null);
  const [appJsonData, setAppJsonData] = useState<{
    dependencies: AppDependency[];
  } | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isLoadingAppJson, setIsLoadingAppJson] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [appJsonError, setAppJsonError] = useState<string | null>(null);
  const [editedDependencies, setEditedDependencies] = useState<AppDependencyProbingPath[]>([]);
  const [fileDependencies, setFileDependencies] = useState<FileDependency[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep>({ status: 'idle' });
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const isSaving = saveStep.status !== 'idle' && saveStep.status !== 'completed';

  useEffect(() => {
    if (!isOpen) return;
    
    // Reset estados al abrir el modal
    setSettingsData(null);
    setAppJsonData(null);
    setSettingsError(null);
    setAppJsonError(null);
    setEditedDependencies([]);
    setFileDependencies([]);
    setFilesToUpload([]);
    setFilesToDelete([]);
    setSaveStep({ status: 'idle' });
    
    fetchSettings();
    fetchAppJson();
    fetchBranches();
    fetchFileDependencies();
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

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch(
        `/api/github/file-content?owner=${owner}&repo=${repo}&path=.AL-Go/settings.json&ref=main`,
        { cache: "no-store" }
      );
      
      if (res.status === 404) {
        setSettingsError("Archivo .AL-Go/settings.json no encontrado");
      } else if (res.ok) {
        const data = await res.json();
        setSettingsData(data.content);
      } else {
        throw new Error("Error al obtener settings.json");
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const fetchAppJson = async () => {
    setIsLoadingAppJson(true);
    setAppJsonError(null);
    try {
      const res = await fetch(
        `/api/github/file-content?owner=${owner}&repo=${repo}&path=app.json&ref=main`,
        { cache: "no-store" }
      );
      
      if (res.status === 404) {
        setAppJsonError("Archivo app.json no encontrado");
      } else if (res.ok) {
        const data = await res.json();
        setAppJsonData(data.content);
      } else {
        throw new Error("Error al obtener app.json");
      }
    } catch (error) {
      setAppJsonError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsLoadingAppJson(false);
    }
  };

  const fetchBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const res = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`, { cache: "no-store" });
      
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches);
        setSelectedBranch(data.branches.includes("main") ? "main" : data.branches[0] || "main");
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchFileDependencies = async () => {
    try {
      const res = await fetch(
        `/api/github/list-dependencies?owner=${owner}&repo=${repo}&ref=main`,
        { cache: "no-store" }
      );
      
      if (res.ok) {
        const data = await res.json();
        setFileDependencies(data.files || []);
      }
    } catch (error) {
      console.error("Error fetching file dependencies:", error);
    }
  };

  // Extraer nombre del repo de la URL
  const getRepoName = (repoUrl: string): string => {
    const match = repoUrl.match(/github\.com\/[^/]+\/([^/@]+)/);
    return match ? match[1] : repoUrl;
  };

  // Inicializar editedDependencies cuando se carga settingsData
  useEffect(() => {
    if (settingsData?.appDependencyProbingPaths) {
      setEditedDependencies([...settingsData.appDependencyProbingPaths]);
    }
  }, [settingsData]);

  const handleRemoveDependency = (index: number) => {
    const updated = editedDependencies.filter((_, i) => i !== index);
    setEditedDependencies(updated);
  };

  const handleRemoveFileDependency = (fileName: string) => {
    setFilesToDelete([...filesToDelete, fileName]);
    setFileDependencies(fileDependencies.filter(f => f.name !== fileName));
  };

  const handleAddFileDependencies = (files: File[]) => {
    setFilesToUpload([...filesToUpload, ...files]);
    const newFiles: FileDependency[] = files.map(file => ({
      name: file.name,
      path: `dependencies/${file.name}`,
      sha: "pending",
      size: file.size,
    }));
    setFileDependencies([...fileDependencies, ...newFiles]);
  };

  const handleAddDependencies = (selectedRepos: GitHubRepository[], version: string, releaseStatus: string) => {
    const newDeps: AppDependencyProbingPath[] = selectedRepos.map(repo => ({
      repo: repo.html_url,
      version: version,
      release_status: releaseStatus,
      authTokenSecret: "GHTOKENWORKFLOW",
      projects: "*",
    }));
    setEditedDependencies([...editedDependencies, ...newDeps]);
    setShowAddRepoModal(false);
  };

  const handleSaveChanges = async () => {
    try {
      // Paso 1: Actualizar settings.json
      setSaveStep({ status: 'updating-settings', message: 'Actualizando settings.json...' });
      
      const res = await fetch("/api/github/update-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          baseBranch: selectedBranch,
          appDependencyProbingPaths: editedDependencies,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar cambios");
      }

      const data = await res.json();
      const branchName = data.branch;

      // Paso 2: Subir archivos
      if (filesToUpload.length > 0) {
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          setSaveStep({ 
            status: 'uploading-files', 
            message: `Subiendo ${file.name}...`,
            current: i + 1,
            total: filesToUpload.length
          });

          const formData = new FormData();
          formData.append("file", file);
          formData.append("owner", owner);
          formData.append("repo", repo);
          formData.append("branch", branchName);

          const uploadRes = await fetch("/api/github/upload-dependency", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(`Error subiendo ${file.name}: ${errorData.error}`);
          }
        }
      }

      // Paso 3: Eliminar archivos
      if (filesToDelete.length > 0) {
        for (let i = 0; i < filesToDelete.length; i++) {
          const fileName = filesToDelete[i];
          setSaveStep({ 
            status: 'deleting-files', 
            message: `Eliminando ${fileName}...`,
            current: i + 1,
            total: filesToDelete.length
          });

          const deleteRes = await fetch("/api/github/delete-dependency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ owner, repo, branch: branchName, fileName }),
          });

          if (!deleteRes.ok) {
            const errorData = await deleteRes.json();
            console.warn(`Error eliminando ${fileName}: ${errorData.error}`);
          }
        }
      }
      
      // Paso 4: Crear PR
      setSaveStep({ status: 'creating-pr', message: 'Creando Pull Request...' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa para que se vea el mensaje
      
      setSaveStep({ status: 'completed', message: 'Pull Request creado exitosamente' });
      
      // Abrir PR y cerrar modal después de un breve momento
      window.open(data.pullRequestUrl, '_blank');
      setTimeout(() => {
        setSaveStep({ status: 'idle' });
        onClose();
      }, 1000);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al guardar cambios");
      setSaveStep({ status: 'idle' });
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isSaving) {
        // No hacer nada, el modal está bloqueado
        return;
      }
      onClose();
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return; // Bloquear cierre
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-[90vw] max-w-6xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Dependencias CI/CD - {repo}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isSaving ? "Procesando cambios..." : "Cerrar"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Split view */}
        <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-gray-700">
          {/* Left side - AL-Go/settings.json */}
          <div className="flex flex-col overflow-hidden">
            <div className="p-3 bg-gray-900/50 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <code className="text-xs bg-gray-700 px-2 py-0.5 rounded">.AL-Go/settings.json</code>
              </h3>
              <p className="text-xs text-gray-500 mt-1">appDependencyProbingPaths</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingSettings ? (
                <LoadingSpinner />
              ) : settingsError ? (
                <EmptyState 
                  message={settingsError}
                  icon={
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
              ) : editedDependencies.length > 0 || fileDependencies.length > 0 ? (
                <div className="space-y-3">
                  {/* Dependencias de repositorio */}
                  {editedDependencies.map((dep, index) => (
                    <div 
                      key={`repo-${index}`}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-blue-400 truncate">
                              {getRepoName(dep.repo)}
                            </h4>
                            <p className="text-xs text-gray-500 truncate mt-0.5" title={dep.repo}>
                              {dep.repo}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                {dep.release_status}
                              </span>
                              {dep.projects && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                  </svg>
                                  {dep.projects}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-green-500/20 text-green-400">
                            {dep.version}
                          </span>
                          <button
                            onClick={() => handleRemoveDependency(index)}
                            disabled={isSaving}
                            className="shrink-0 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar dependencia"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Dependencias de archivo */}
                  {fileDependencies.map((file, index) => (
                    <div 
                      key={`file-${index}`}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate">
                              {file.name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFileDependency(file.name)}
                          disabled={isSaving}
                          className="shrink-0 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Eliminar archivo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState 
                  message="Sin dependencias CI/CD configuradas"
                  icon={
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  }
                />
              )}
            </div>

            {/* Counter and Add buttons */}
            <div className="p-2 border-t border-gray-700 bg-gray-900/30 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {editedDependencies.length + fileDependencies.length} dependencia(s)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddRepoModal(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Añadir repositorio"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Repositorio
                </button>
                <button
                  onClick={() => setShowAddFileModal(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-500 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Añadir archivo .app"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Archivo
                </button>
              </div>
            </div>
          </div>

          {/* Right side - app.json */}
          <div className="flex flex-col overflow-hidden">
            <div className="p-3 bg-gray-900/50 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <code className="text-xs bg-gray-700 px-2 py-0.5 rounded">app.json</code>
              </h3>
              <p className="text-xs text-gray-500 mt-1">dependencies</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingAppJson ? (
                <LoadingSpinner />
              ) : appJsonError ? (
                <EmptyState 
                  message={appJsonError}
                  icon={
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
              ) : appJsonData?.dependencies && appJsonData.dependencies.length > 0 ? (
                <div className="space-y-3">
                  {appJsonData.dependencies.map((dep, index) => (
                    <div 
                      key={index}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-purple-400">
                            {dep.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {dep.publisher}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-400">
                          v{dep.version}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-400 font-mono">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          {dep.id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState 
                  message="Sin dependencias de app"
                  icon={
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  }
                />
              )}
            </div>

            {/* Counter */}
            <div className="p-2 border-t border-gray-700 bg-gray-900/30">
              <p className="text-xs text-gray-500 text-center">
                {appJsonData?.dependencies?.length || 0} dependencia(s)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex flex-col gap-3">
          {/* Barra de progreso */}
          {isSaving && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {saveStep.status === 'updating-settings' && saveStep.message}
                    {saveStep.status === 'uploading-files' && `${saveStep.message} (${saveStep.current}/${saveStep.total})`}
                    {saveStep.status === 'deleting-files' && `${saveStep.message} (${saveStep.current}/${saveStep.total})`}
                    {saveStep.status === 'creating-pr' && saveStep.message}
                  </p>
                  {(saveStep.status === 'uploading-files' || saveStep.status === 'deleting-files') && (
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(saveStep.current / saveStep.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Selector de rama */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">PR a rama:</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={isLoadingBranches || isSaving}
                className="px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingBranches ? (
                  <option>Cargando...</option>
                ) : branches.length > 0 ? (
                  branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))
                ) : (
                  <option>No hay ramas disponibles</option>
                )}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saveStep.status === 'completed' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Completado
                  </>
                ) : isSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Crear PR a {selectedBranch}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de selección de repositorio */}
      {showAddRepoModal && (
        <AddRepoModal
          onClose={() => setShowAddRepoModal(false)}
          repos={allRepos}
          currentRepoFullName={`${owner}/${repo}`}
          existingDeps={editedDependencies}
          onAdd={handleAddDependencies}
        />
      )}

      {/* Modal de carga de archivos */}
      {showAddFileModal && (
        <AddFileModal
          onClose={() => setShowAddFileModal(false)}
          onAdd={handleAddFileDependencies}
        />
      )}
    </div>
  );
}

interface AddRepoModalProps {
  onClose: () => void;
  repos: GitHubRepository[];
  currentRepoFullName: string;
  existingDeps: AppDependencyProbingPath[];
  onAdd: (repos: GitHubRepository[], version: string, releaseStatus: string) => void;
}

function AddRepoModal({ onClose, repos, currentRepoFullName, existingDeps, onAdd }: AddRepoModalProps) {
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [version, setVersion] = useState("latest");
  const [releaseStatus, setReleaseStatus] = useState("release");
  const [searchQuery, setSearchQuery] = useState("");

  const existingRepoUrls = new Set(existingDeps.map(dep => dep.repo));
  const availableRepos = repos.filter(repo => 
    !existingRepoUrls.has(repo.html_url) && repo.full_name !== currentRepoFullName
  );
  const filteredRepos = availableRepos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRepoSelection = (repoId: number) => {
    setSelectedRepos(prev => {
      const newSelection = new Set(prev);
      newSelection.has(repoId) ? newSelection.delete(repoId) : newSelection.add(repoId);
      return newSelection;
    });
  };

  const getSelectedRepoNames = () => {
    return availableRepos
      .filter(repo => selectedRepos.has(repo.id))
      .map(repo => repo.name);
  };

  const handleAdd = () => {
    if (selectedRepos.size === 0) return;
    
    const reposToAdd = availableRepos.filter(repo => selectedRepos.has(repo.id));
    onAdd(reposToAdd, version, releaseStatus);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-[90vw] max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Añadir dependencia</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar repositorio..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-600 bg-gray-900 text-white text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredRepos.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">
                {availableRepos.length === 0 
                  ? "Todos los repositorios ya están agregados" 
                  : "No se encontraron repositorios"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepos.has(repo.id);
                return (
                  <button
                    key={repo.id}
                    onClick={() => toggleRepoSelection(repo.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 bg-gray-900 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">
                          {repo.name}
                        </h4>
                        <p className="text-xs text-gray-400 truncate">
                          {repo.full_name}
                        </p>
                      </div>
                      <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-500"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected repos indicator */}
        {selectedRepos.size > 0 && (
          <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/30">
            <p className="text-xs text-gray-400">
              <span className="font-medium text-blue-400">Seleccionados:</span>{" "}
              {getSelectedRepoNames().join(", ")}
            </p>
          </div>
        )}

        {/* Config */}
        {selectedRepos.size > 0 && (
          <div className="p-4 border-t border-gray-700 bg-gray-900/50">
            <p className="text-xs text-gray-400 mb-3">
              Configuración aplicada a todos los repositorios seleccionados
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Versión
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-900 text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Release Status
                </label>
                <select
                  value={releaseStatus}
                  onChange={(e) => setReleaseStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-900 text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="release">release</option>
                  <option value="prerelease">prerelease</option>
                  <option value="draft">draft</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedRepos.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Añadir {selectedRepos.size > 0 && `(${selectedRepos.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddFileModalProps {
  onClose: () => void;
  onAdd: (files: File[]) => void;
}

function AddFileModal({ onClose, onAdd }: AddFileModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter(f => f.name.endsWith('.app'));
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (selectedFiles.length === 0) return;
    onAdd(selectedFiles);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-[90vw] max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            Añadir archivos .app
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-gray-400 bg-gray-500/10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-300 mb-2">
              Arrastra archivos .app aquí
            </p>
            <p className="text-gray-500 text-sm mb-4">o</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-500 rounded-md transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Seleccionar archivos
              <input
                type="file"
                accept=".app"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Archivos seleccionados ({selectedFiles.length})
              </h4>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="shrink-0 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Añadir {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
