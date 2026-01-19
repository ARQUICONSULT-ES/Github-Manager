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
    status: 'downloading' | 'installing' | 'success' | 'error';
    message?: string;
    error?: string;
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

  // Procesar cada aplicación secuencialmente
  for (const app of applications) {
    try {
      console.log(`\n📦 Desplegando ${app.name}...`);

      // Notificar inicio de descarga
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'downloading',
        message: `Obteniendo release desde GitHub`,
      });

      // Extraer owner y repo del githubRepoName
      const [owner, repo] = app.githubRepoName.split('/');
      console.log(`\nProcessing app: ${app.name}`);
      console.log(`  githubRepoName: ${app.githubRepoName}`);
      console.log(`  Extracted - owner: "${owner}", repo: "${repo}"`);
      
      if (!owner || !repo) {
        const error = `Formato inválido de repositorio GitHub: "${app.githubRepoName}"`;
        console.error(`  ❌ ${error}`);
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error,
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
        });
        failedCount++;
        break; // Detener al primer error
      }

      // Paso 1: Obtener URL de descarga del release
      console.log(`  1️⃣ Obteniendo release desde GitHub...`);
      const releaseInfo = await getLatestReleaseAsset(owner, repo, githubToken);
      if (!releaseInfo) {
        const error = 'No se encontró release en GitHub';
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error,
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
        });
        failedCount++;
        break; // Detener al primer error
      }

      console.log(`  ✓ Release encontrado: ${releaseInfo.version}`);

      // Paso 2: Descargar y extraer el .app
      console.log(`  2️⃣ Descargando archivo desde ${releaseInfo.downloadUrl}...`);
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'downloading',
        message: `Descargando v${releaseInfo.version}`,
      });
      
      const appBuffer = await downloadAndExtractApp(releaseInfo.downloadUrl, githubToken);
      if (!appBuffer) {
        const error = 'Error descargando o extrayendo archivo .app';
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error,
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
          details: { downloadUrl: releaseInfo.downloadUrl },
        });
        failedCount++;
        break; // Detener al primer error
      }

      console.log(`  ✓ Archivo descargado (${(appBuffer.byteLength / 1024).toFixed(2)} KB)`);

      // Paso 3: Instalar en Business Central
      console.log(`  3️⃣ Instalando en Business Central (${environmentName})...`);
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'installing',
        message: `Subiendo a Business Central`,
      });
      
      const installResult = await installAppInBC(tenantId, environmentName, app.id, appBuffer, bcToken);

      if (installResult.success) {
        console.log(`  ✅ ${app.name} desplegado exitosamente`);
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'success',
          message: `Instalado correctamente v${releaseInfo.version}`,
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
        console.error(`  ❌ Error instalando ${app.name}:`, installResult.error);
        const error = installResult.error || 'Error desconocido al instalar';
        onProgress?.({
          applicationId: app.id,
          applicationName: app.name,
          status: 'error',
          error,
        });
        results.push({
          success: false,
          appId: app.id,
          appName: app.name,
          error,
          details: { downloadUrl: releaseInfo.downloadUrl },
        });
        failedCount++;
        break; // Detener al primer error
      }

    } catch (error) {
      console.error(`Error desplegando ${app.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      onProgress?.({
        applicationId: app.id,
        applicationName: app.name,
        status: 'error',
        error: errorMessage,
      });
      results.push({
        success: false,
        appId: app.id,
        appName: app.name,
        error: errorMessage,
      });
      failedCount++;
      break; // Detener al primer error
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    total: applications.length,
    results,
  };
}
