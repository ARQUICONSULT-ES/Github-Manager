import { ensureValidToken } from "@/lib/installedapp-sync";

interface DeploymentResult {
  success: boolean;
  appId: string;
  appName: string;
  error?: string;
  details?: {
    downloadUrl?: string;
    installationStatus?: string;
  };
}

interface DeploymentBatchResult {
  success: number;
  failed: number;
  total: number;
  results: DeploymentResult[];
}

/**
 * Obtiene la URL de descarga del último release de GitHub
 */
async function getLatestReleaseAsset(
  owner: string,
  repo: string,
  token: string
): Promise<{ downloadUrl: string; version: string; assetId?: number } | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    console.log(`Fetching release from: ${url}`);
    
    // Obtener el último release
    const releaseRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!releaseRes.ok) {
      const errorText = await releaseRes.text();
      console.error(`Error obteniendo release: ${releaseRes.status} ${releaseRes.statusText}`);
      console.error(`Response body: ${errorText}`);
      return null;
    }

    const release = await releaseRes.json();
    console.log(`Release encontrado: ${release.tag_name || release.name}`);
    console.log(`Assets disponibles: ${release.assets.map((a: any) => a.name).join(', ')}`);
    
    // Buscar el asset .app (o .zip que contenga .app)
    const asset = release.assets.find((a: any) => 
      a.name.endsWith('.app') || a.name.endsWith('.zip')
    );

    if (!asset) {
      console.error('No se encontró archivo .app o .zip en el release');
      console.error(`Assets disponibles: ${JSON.stringify(release.assets.map((a: any) => a.name))}`);
      return null;
    }

    console.log(`Asset seleccionado: ${asset.name}`);
    console.log(`Asset ID: ${asset.id}`);
    console.log(`Browser download URL: ${asset.browser_download_url}`);
    
    // Usar la URL de la API de GitHub para descargar el asset
    // Esto es más confiable que browser_download_url
    const downloadUrl = asset.url; // URL de la API: /repos/{owner}/{repo}/releases/assets/{asset_id}
    
    console.log(`API download URL: ${downloadUrl}`);
    
    return {
      downloadUrl,
      version: release.tag_name || release.name,
      assetId: asset.id,
    };
  } catch (error) {
    console.error('Error obteniendo release de GitHub:', error);
    return null;
  }
}

/**
 * Descarga y extrae el archivo .app desde GitHub
 */
async function downloadAndExtractApp(
  downloadUrl: string,
  githubToken: string
): Promise<Buffer | null> {
  try {
    // Descargar el archivo usando la API de GitHub
    // Si downloadUrl es una URL de API (contiene /repos/), usar Accept: application/octet-stream
    // Si es una URL directa de GitHub, usarla tal cual
    const headers: HeadersInit = {
      Authorization: `Bearer ${githubToken}`,
    };

    // Si es URL de la API de GitHub (asset.url), necesitamos Accept: application/octet-stream
    if (downloadUrl.includes('api.github.com')) {
      headers.Accept = 'application/octet-stream';
    }

    console.log(`Descargando desde: ${downloadUrl}`);
    const response = await fetch(downloadUrl, { headers });

    if (!response.ok) {
      console.error(`Error descargando asset: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Response: ${errorText.substring(0, 200)}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`Archivo descargado: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

    // Detectar si es ZIP por magic bytes (PK) en lugar de por extensión
    const uint8Array = new Uint8Array(arrayBuffer);
    const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // "PK"

    if (isZip) {
      console.log('Archivo detectado como ZIP, extrayendo...');
      // Para Node.js, usaremos el módulo adm-zip
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(Buffer.from(arrayBuffer));
      const zipEntries = zip.getEntries();

      console.log(`Entradas en ZIP: ${zipEntries.map(e => e.entryName).join(', ')}`);

      // Buscar el archivo .app dentro del zip
      const appEntry = zipEntries.find(entry => entry.entryName.endsWith('.app'));
      
      if (!appEntry) {
        console.error('No se encontró archivo .app dentro del .zip');
        return null;
      }

      console.log(`Extrayendo: ${appEntry.entryName}`);
      // Extraer el .app - getData() devuelve Buffer
      const buffer = appEntry.getData();
      return Buffer.from(buffer);
    }

    console.log('Archivo es .app directo');
    // Si ya es un .app, retornar directamente como Buffer
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error descargando o extrayendo app:', error);
    return null;
  }
}

/**
 * Instala una aplicación en Business Central mediante la Admin API
 * Documentación: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/administration-center-api_app_management
 */
async function installAppInBC(
  tenantId: string,
  environmentName: string,
  appId: string,
  appBuffer: Buffer,
  bcToken: string
): Promise<{ success: boolean; error?: string; operationId?: string }> {
  try {
    const bcApiUrl = process.env.BC_ADMIN_API_URL || "https://api.businesscentral.dynamics.com/admin/v2.28/applications";
    
    console.log(`Instalando app con ID: ${appId}`);
    
    // Subir el archivo usando el endpoint correcto con el appId
    // PUT /admin/v2.28/applications/{applicationFamily}/environments/{environmentName}/apps/{appId}
    const uploadUrl = `${bcApiUrl}/BusinessCentral/environments/${environmentName}/apps/${appId}`;
    
    console.log(`Subiendo app a: ${uploadUrl}`);
    console.log(`Tamaño del archivo: ${appBuffer.length} bytes`);
    
    // Convertir Buffer a Uint8Array para fetch
    const uint8Array = new Uint8Array(appBuffer);
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${bcToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: uint8Array,
    });

    console.log(`Respuesta de BC: ${uploadRes.status} ${uploadRes.statusText}`);

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Error subiendo app a BC:', errorText);
      return { 
        success: false, 
        error: `Error ${uploadRes.status}: ${errorText || uploadRes.statusText}` 
      };
    }

    const uploadResult = await uploadRes.json();
    console.log('App subida exitosamente:', uploadResult);

    // La respuesta puede contener un operationId para hacer seguimiento
    const operationId = uploadResult.operationId || uploadResult.id;

    if (operationId) {
      // Opcionalmente, podemos hacer polling del estado
      return { 
        success: true, 
        operationId: operationId 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error instalando app en BC:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Despliega múltiples aplicaciones en un entorno de Business Central
 * Se detiene en el primer error encontrado
 */
export async function deployApplications(
  tenantId: string,
  environmentName: string,
  applications: Array<{
    id: string;
    name: string;
    githubRepoName: string;
    versionType: 'release' | 'prerelease';
  }>,
  githubToken: string,
  onProgress?: (progress: {
    applicationId: string;
    applicationName: string;
    status: 'pending' | 'downloading' | 'installing' | 'success' | 'error';
    message?: string;
    error?: string;
    steps?: Array<{
      name: string;
      status: 'pending' | 'running' | 'success' | 'error';
      message?: string;
    }>;
  }) => void
): Promise<DeploymentBatchResult> {
  const results: DeploymentResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Verificar y obtener token válido de BC
  const tokenResult = await ensureValidToken(tenantId);
  if (!tokenResult.success || !tokenResult.token) {
    // Si no hay token válido, marcar todas como fallidas
    return {
      success: 0,
      failed: applications.length,
      total: applications.length,
      results: applications.map(app => ({
        success: false,
        appId: app.id,
        appName: app.name,
        error: tokenResult.error || 'No se pudo obtener token de BC',
      })),
    };
  }

  const bcToken = tokenResult.token;

  // Inicializar todas las apps como pendientes
  console.log(`\n🚀 Iniciando despliegue de ${applications.length} aplicación(es)...`);
  console.log(`📍 Entorno: ${environmentName}`);
  console.log('━'.repeat(80));
  
  // Procesar cada aplicación secuencialmente
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    const appNumber = i + 1;
    
    // Inicializar los 3 pasos
    const steps = [
      { name: '1. Validación', status: 'pending' as const, message: undefined },
      { name: '2. Descarga', status: 'pending' as const, message: undefined },
      { name: '3. Instalación', status: 'pending' as const, message: undefined },
    ];
    
    try {
      console.log(`\n📦 [${appNumber}/${applications.length}] ${app.name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Repo: ${app.githubRepoName}`);
      console.log('─'.repeat(80));

      // === PASO 1: VALIDACIÓN ===
      console.log(`   1️⃣  Validando configuración...`);
      steps[0].status = 'running';
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'downloading',
        message: 'Validando configuración...',
        steps: [...steps],
      });
      
      const [owner, repo] = app.githubRepoName.split('/');
      
      if (!owner || !repo) {
        const error = `Formato inválido de repositorio GitHub: "${app.githubRepoName}"`;
        console.error(`   ❌ ${error}`);
        steps[0].status = 'error';
        steps[0].message = error;
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error: `Paso 1/3: ${error}`,
          steps: [...steps],
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
        });
        failedCount++;
        
        // Marcar las apps restantes como abortadas
        for (let j = i + 1; j < applications.length; j++) {
          const abortedApp = applications[j];
          console.log(`\n⏸️  [${j + 1}/${applications.length}] ${abortedApp.name} - ABORTADO`);
          onProgress?.({
            applicationId: abortedApp.id,
            applicationName: abortedApp.name,
            status: 'error',
            error: 'Despliegue abortado por error anterior',
          });
          results.push({
            success: false,
            appId: abortedApp.id,
            appName: abortedApp.name,
            error: 'Despliegue abortado por error anterior',
          });
          failedCount++;
        }
        break;
      }
      console.log(`   ✅ Configuración válida`);
      steps[0].status = 'success';
      steps[0].message = `Repositorio: ${owner}/${repo}`;

      // === PASO 2: DESCARGA ===
      console.log(`   2️⃣  Obteniendo release desde GitHub...`);
      steps[1].status = 'running';
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'downloading',
        message: `Buscando última versión en GitHub`,
        steps: [...steps],
      });
      
      const releaseInfo = await getLatestReleaseAsset(owner, repo, githubToken);
      if (!releaseInfo) {
        const error = 'No se encontró release disponible en GitHub';
        console.error(`   ❌ ${error}`);
        steps[1].status = 'error';
        steps[1].message = error;
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error: `Paso 2/3: ${error}`,
          steps: [...steps],
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
        });
        failedCount++;
        
        // Abortar apps restantes
        for (let j = i + 1; j < applications.length; j++) {
          const abortedApp = applications[j];
          console.log(`\n⏸️  [${j + 1}/${applications.length}] ${abortedApp.name} - ABORTADO`);
          onProgress?.({
            applicationId: abortedApp.id,
            applicationName: abortedApp.name,
            status: 'error',
            error: 'Despliegue abortado por error anterior',
          });
          results.push({
            success: false,
            appId: abortedApp.id,
            appName: abortedApp.name,
            error: 'Despliegue abortado por error anterior',
          });
          failedCount++;
        }
        break;
      }

      console.log(`   ✅ Release encontrado: ${releaseInfo.version}`);
      console.log(`   📥 Descargando archivo .app...`);
      steps[1].message = `Descargando v${releaseInfo.version}...`;
      
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'downloading',
        message: `Descargando v${releaseInfo.version}`,
        steps: [...steps],
      });
      
      const appBuffer = await downloadAndExtractApp(releaseInfo.downloadUrl, githubToken);
      if (!appBuffer) {
        const error = 'Error descargando archivo .app desde GitHub';
        console.error(`   ❌ ${error}`);
        steps[1].status = 'error';
        steps[1].message = error;
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error: `Paso 2/3: ${error}`,
          steps: [...steps],
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
          details: { downloadUrl: releaseInfo.downloadUrl },
        });
        failedCount++;
        
        // Abortar apps restantes
        for (let j = i + 1; j < applications.length; j++) {
          const abortedApp = applications[j];
          console.log(`\n⏸️  [${j + 1}/${applications.length}] ${abortedApp.name} - ABORTADO`);
          onProgress?.({
            applicationId: abortedApp.id,
            applicationName: abortedApp.name,
            status: 'error',
            error: 'Despliegue abortado por error anterior',
          });
          results.push({
            success: false,
            appId: abortedApp.id,
            appName: abortedApp.name,
            error: 'Despliegue abortado por error anterior',
          });
          failedCount++;
        }
        break;
      }

      console.log(`   ✅ Descargado: ${(appBuffer.byteLength / 1024).toFixed(2)} KB`);
      steps[1].status = 'success';
      steps[1].message = `${(appBuffer.byteLength / 1024).toFixed(2)} KB descargados`;

      // === PASO 3: INSTALACIÓN ===
      console.log(`   3️⃣  Instalando en Business Central...`);
      steps[2].status = 'running';
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'installing',
        message: `Subiendo a Business Central`,
        steps: [...steps],
      });
      
      const installResult = await installAppInBC(tenantId, environmentName, app.id, appBuffer, bcToken);

      if (installResult.success) {
        console.log(`   ✅ ¡INSTALADO EXITOSAMENTE!`);
        console.log(`   📌 Versión: ${releaseInfo.version}`);
        if (installResult.operationId) {
          console.log(`   🔄 Operation ID: ${installResult.operationId}`);
        }
        console.log('━'.repeat(80));
        
        steps[2].status = 'success';
        steps[2].message = installResult.operationId 
          ? `Instalado (Op: ${installResult.operationId.substring(0, 8)}...)`
          : 'Instalado correctamente';
        
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'success',
          message: `✓ Instalado: v${releaseInfo.version}`,
          steps: [...steps],
        });
        results.push({
          success: true,
          appId: app.id,
          appName: app.name,
          details: {
            downloadUrl: releaseInfo.downloadUrl,
            installationStatus: installResult.operationId 
              ? `En progreso (ID: ${installResult.operationId})` 
              : 'Completado',
          },
        });
        successCount++;
      } else {
        const error = installResult.error || 'Error desconocido al instalar en BC';
        console.error(`   ❌ ERROR EN INSTALACIÓN`);
        console.error(`   💥 ${error}`);
        console.log('━'.repeat(80));
        
        steps[2].status = 'error';
        steps[2].message = error;
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error: `Paso 3/3: ${error}`,
          steps: [...steps],
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
          details: { downloadUrl: releaseInfo.downloadUrl },
        });
        failedCount++;
        
        // Abortar apps restantes
        for (let j = i + 1; j < applications.length; j++) {
          const abortedApp = applications[j];
          console.log(`\n⏸️  [${j + 1}/${applications.length}] ${abortedApp.name} - ABORTADO`);
          onProgress?.({
            applicationId: abortedApp.id,
            applicationName: abortedApp.name,
            status: 'error',
            error: 'Despliegue abortado por error anterior',
          });
          results.push({
            success: false,
            appId: abortedApp.id,
            appName: abortedApp.name,
            error: 'Despliegue abortado por error anterior',
          });
          failedCount++;
        }
        break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`   ❌ EXCEPCIÓN NO CONTROLADA`);
      console.error(`   💥 ${errorMessage}`);
      console.log('━'.repeat(80));
      
      // Marcar el paso actual como error
      const currentStepIndex = steps.findIndex(s => s.status === 'running');
      if (currentStepIndex >= 0) {
        steps[currentStepIndex].status = 'error';
        steps[currentStepIndex].message = errorMessage;
      }
      
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'error',
        error: `Error inesperado: ${errorMessage}`,
        steps: [...steps],
      });
      results.push({
        success: false,
        appId: app.id,
        appName: app.name,
        error: errorMessage,
      });
      failedCount++;
      
      // Abortar apps restantes
      for (let j = i + 1; j < applications.length; j++) {
        const abortedApp = applications[j];
        console.log(`\n⏸️  [${j + 1}/${applications.length}] ${abortedApp.name} - ABORTADO`);
        onProgress?.({
          applicationId: abortedApp.id,
          applicationName: abortedApp.name,
          status: 'error',
          error: 'Despliegue abortado por error anterior',
        });
        results.push({
          success: false,
          appId: abortedApp.id,
          appName: abortedApp.name,
          error: 'Despliegue abortado por error anterior',
        });
        failedCount++;
      }
      break;
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  console.log('📊 RESUMEN DEL DESPLIEGUE');
  console.log('━'.repeat(80));
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Fallidos: ${failedCount}`);
  console.log(`   📦 Total: ${applications.length}`);
  console.log('━'.repeat(80) + '\n');

  return {
    success: successCount,
    failed: failedCount,
    total: applications.length,
    results,
  };
}
