"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/shared/hooks/useToast";
import ToastContainer from "@/modules/shared/components/ToastContainer";
import { isVersionOutdated } from "@/modules/applications/utils/versionComparison";
import type { Application } from "@/modules/applications/types";

interface InstalledApp {
  id: string;
  name: string;
  version: string;
  publisher: string;
  publishedAs: string;
  state?: string | null;
}

interface EnvironmentDetail {
  tenantId: string;
  name: string;
  type?: string | null;
  status?: string | null;
  webClientUrl?: string | null;
  locationName?: string | null;
  applicationVersion?: string | null;
  platformVersion?: string | null;
  customerId: string;
  customerName: string;
  customerImage?: string | null;
  tenantDescription?: string | null;
  installedApps: InstalledApp[];
}

interface EnvironmentComparePageProps {
  tenantId: string;
  environmentName: string;
  compareTenantId: string;
  compareEnvironmentName: string;
}

interface ComparisonResult {
  allApps: Array<{
    id: string;
    name: string;
    publisher: string;
    publishedAs: string;
    left?: InstalledApp;
    right?: InstalledApp;
    versionDiff: boolean;
    onlyInLeft: boolean;
    onlyInRight: boolean;
  }>;
}

export function EnvironmentComparePage({ 
  tenantId, 
  environmentName, 
  compareTenantId, 
  compareEnvironmentName 
}: EnvironmentComparePageProps) {
  const router = useRouter();
  const { toasts, removeToast, error: showError } = useToast();
  const [leftEnvironment, setLeftEnvironment] = useState<EnvironmentDetail | null>(null);
  const [rightEnvironment, setRightEnvironment] = useState<EnvironmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [hideMicrosoftApps, setHideMicrosoftApps] = useState(true);

  useEffect(() => {
    loadEnvironments();
  }, [tenantId, environmentName, compareTenantId, compareEnvironmentName]);

  const loadEnvironments = async () => {
    setLoading(true);
    try {
      const [leftResponse, rightResponse] = await Promise.all([
        fetch(`/api/environments/${encodeURIComponent(tenantId)}/${encodeURIComponent(environmentName)}`),
        fetch(`/api/environments/${encodeURIComponent(compareTenantId)}/${encodeURIComponent(compareEnvironmentName)}`)
      ]);

      if (!leftResponse.ok || !rightResponse.ok) {
        throw new Error("Error al cargar los entornos");
      }

      const leftData = await leftResponse.json();
      const rightData = await rightResponse.json();

      setLeftEnvironment(leftData);
      setRightEnvironment(rightData);

      // Compute comparison
      compareEnvironments(leftData, rightData);
    } catch (err) {
      console.error("Error loading environments:", err);
      showError("No se pudieron cargar los entornos para comparar");
    } finally {
      setLoading(false);
    }
  };

  const compareEnvironments = (left: EnvironmentDetail, right: EnvironmentDetail) => {
    const leftAppsMap = new Map(left.installedApps.map(app => [app.id, app]));
    const rightAppsMap = new Map(right.installedApps.map(app => [app.id, app]));
    const allAppIds = new Set([...leftAppsMap.keys(), ...rightAppsMap.keys()]);

    const allApps: ComparisonResult['allApps'] = [];

    allAppIds.forEach(appId => {
      const leftApp = leftAppsMap.get(appId);
      const rightApp = rightAppsMap.get(appId);
      
      // Use left or right app metadata (they should be the same)
      const metadata = leftApp || rightApp!;
      
      allApps.push({
        id: appId,
        name: metadata.name,
        publisher: metadata.publisher,
        publishedAs: metadata.publishedAs,
        left: leftApp,
        right: rightApp,
        versionDiff: leftApp && rightApp ? leftApp.version !== rightApp.version : false,
        onlyInLeft: !!leftApp && !rightApp,
        onlyInRight: !leftApp && !!rightApp
      });
    });

    // Sort by name
    allApps.sort((a, b) => a.name.localeCompare(b.name));

    setComparison({ allApps });
  };

  const getTypeColor = (type?: string | null) => {
    const typeStr = type?.toLowerCase();
    if (typeStr === 'production') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    } else if (typeStr === 'sandbox') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  };

  const getPublishedAsColor = (publishedAs: string) => {
    const type = publishedAs.toLowerCase();
    if (type === "global") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
    if (type === "tenant") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
    if (type === "dev") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!leftEnvironment || !rightEnvironment) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="w-16 h-16 text-red-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No se pudieron cargar los entornos
        </h3>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  const renderEnvironmentHeader = (env: EnvironmentDetail, side: 'left' | 'right') => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start gap-4">
        {/* Customer Image */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
          {env.customerImage ? (
            <img 
              src={env.customerImage} 
              alt={env.customerName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{env.customerName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Environment Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {env.name}
            </h2>
            {env.type && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(env.type)}`}>
                {env.type}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {env.customerName}
          </p>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-gray-500 dark:text-gray-400">App Version</p>
                <p className="font-medium text-gray-900 dark:text-white truncate" title={env.applicationVersion || undefined}>
                  {env.applicationVersion || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <div className="min-w-0">
                <p className="text-gray-500 dark:text-gray-400">Platform</p>
                <p className="font-medium text-gray-900 dark:text-white truncate" title={env.platformVersion || undefined}>
                  {env.platformVersion || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppCard = (app: InstalledApp | undefined, highlightColor?: string) => {
    if (!app) {
      return (
        <div className="p-2 rounded border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-center">
          <span className="text-xs text-gray-400 dark:text-gray-500">No instalada</span>
        </div>
      );
    }

    return (
      <div 
        className={`p-2 rounded border ${
          highlightColor || 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-xs text-gray-900 dark:text-white flex-1 leading-tight">
            {app.name}
          </h4>
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${getPublishedAsColor(app.publishedAs)}`}>
            {app.publishedAs}
          </span>
        </div>
        <div className="space-y-0.5 text-[10px]">
          <p className="text-gray-600 dark:text-gray-400 truncate">{app.publisher}</p>
          <p className="font-mono text-gray-900 dark:text-white font-semibold">{app.version}</p>
        </div>
      </div>
    );
  };

  // Filter apps based on hideMicrosoftApps
  const filteredApps = comparison?.allApps.filter(app => {
    if (hideMicrosoftApps && app.publisher.toLowerCase() === 'microsoft') {
      return false;
    }
    return true;
  }) || [];

  // Calculate statistics
  const stats = {
    onlyInLeft: filteredApps.filter(app => app.onlyInLeft).length,
    onlyInRight: filteredApps.filter(app => app.onlyInRight).length,
    inBoth: filteredApps.filter(app => !app.onlyInLeft && !app.onlyInRight).length,
    versionDiff: filteredApps.filter(app => app.versionDiff).length
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Comparación de Entornos
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comparando aplicaciones instaladas entre los dos entornos
        </p>
      </div>

      {/* Environment Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderEnvironmentHeader(leftEnvironment, 'left')}
        {renderEnvironmentHeader(rightEnvironment, 'right')}
      </div>

      {/* Comparison Summary */}
      {comparison && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {stats.onlyInLeft}
                  </p>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300">
                    Solo izquierda
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">
                    {stats.inBoth}
                  </p>
                  <p className="text-[10px] text-green-700 dark:text-green-300">
                    En ambos
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {stats.onlyInRight}
                  </p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300">
                    Solo derecha
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                    {stats.versionDiff}
                  </p>
                  <p className="text-[10px] text-orange-700 dark:text-orange-300">
                    Versión distinta
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center justify-between">
            <label className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors ${
              hideMicrosoftApps
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600"
                : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            }`}>
              <input
                type="checkbox"
                checked={hideMicrosoftApps}
                onChange={(e) => setHideMicrosoftApps(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white border-blue-500 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className={`text-xs font-medium ${
                hideMicrosoftApps
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                Ocultar apps Microsoft
              </span>
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {filteredApps.length} aplicaciones
            </p>
          </div>
        </div>
      )}

      {/* Detailed Comparison - Unified List */}
      {comparison && filteredApps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Comparación Detallada
          </h3>
          
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Aplicación</div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{leftEnvironment.name}</div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rightEnvironment.name}</div>
          </div>

          {/* App Rows */}
          <div className="space-y-1">
            {filteredApps.map((app) => {
              let highlightColor = '';
              if (app.onlyInLeft) {
                highlightColor = 'bg-blue-50/50 dark:bg-blue-900/10';
              } else if (app.onlyInRight) {
                highlightColor = 'bg-purple-50/50 dark:bg-purple-900/10';
              } else if (app.versionDiff) {
                highlightColor = 'bg-orange-50/50 dark:bg-orange-900/10';
              }

              return (
                <div 
                  key={app.id}
                  className={`grid grid-cols-[2fr_1fr_1fr] gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 ${highlightColor}`}
                >
                  {/* App Name Column */}
                  <div className="flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                        {app.name}
                      </h4>
                      {app.onlyInLeft && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                          Solo izq.
                        </span>
                      )}
                      {app.onlyInRight && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                          Solo der.
                        </span>
                      )}
                      {app.versionDiff && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Diff
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{app.publisher}</p>
                  </div>

                  {/* Left Environment */}
                  <div>
                    {renderAppCard(app.left, app.versionDiff ? 'border-orange-300 dark:border-orange-600 bg-orange-50/30 dark:bg-orange-900/10' : undefined)}
                  </div>

                  {/* Right Environment */}
                  <div>
                    {renderAppCard(app.right, app.versionDiff ? 'border-orange-300 dark:border-orange-600 bg-orange-50/30 dark:bg-orange-900/10' : undefined)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {comparison && filteredApps.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">
            No hay aplicaciones para mostrar con los filtros actuales
          </p>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
