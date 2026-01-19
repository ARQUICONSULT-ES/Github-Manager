// Automation API requiere Access Token de OAuth, no authContext en query string

/**
 * Obtiene un Access Token usando el Refresh Token del AuthContext
 */
async function getAccessTokenFromRefreshToken(
  tenantId: string,
  clientId: string,
  refreshToken: string,
  scopes: string
): Promise<{ accessToken: string; error?: string } | null> {
  try {
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const body = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    console.log(`Obteniendo Access Token de Azure AD...`);
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error obteniendo token: ${response.status}`, errorText);
      return null;
    }

    const tokenData = await response.json();
    return { accessToken: tokenData.access_token };
  } catch (error) {
    console.error('Error en getAccessTokenFromRefreshToken:', error);
    return null;
  }
}

/**
 * Instala una aplicación en Business Central mediante la Automation API
 * Basado en BcContainerHelper: Publish-PerTenantExtensionApps
 * Flujo:
 * 1. GET /companies - obtener ID de company
 * 2. GET /extensions - ver extensiones instaladas
 * 3. POST/PATCH /extensionUpload - crear/actualizar upload entity
 * 4. PATCH extensionContent@odata.mediaEditLink - subir archivo .app
 * 5. POST /extensionUpload({id})/Microsoft.NAV.upload - triggear instalación
 * 6. GET /extensionDeploymentStatus - poll hasta completar
 */
async function installAppInBC(
  environmentUrl: string,
  authContext: string,
  appId: string,
  appBuffer: Buffer
): Promise<{ success: boolean; error?: string; operationId?: string }> {
  try {
    console.log(`Instalando app con ID: ${appId}`);
    console.log(`Entorno URL: ${environmentUrl}`);
    
    // Parsear el authContext para obtener los datos de OAuth
    let authContextObj;
    try {
      authContextObj = typeof authContext === 'string' ? JSON.parse(authContext) : authContext;
    } catch (e) {
      return {
        success: false,
        error: 'AuthContext inválido: no es un JSON válido'
      };
    }

    // Validar que tenga los campos necesarios
    if (!authContextObj.TenantID || !authContextObj.ClientID || !authContextObj.RefreshToken) {
      return {
        success: false,
        error: 'AuthContext incompleto: falta TenantID, ClientID o RefreshToken'
      };
    }

    // Obtener Access Token usando el Refresh Token
    let scopes = authContextObj.Scopes || 'https://api.businesscentral.dynamics.com/.default';
    
    // Corregir el scope si no termina con /.default
    if (scopes.endsWith('/') && !scopes.endsWith('/.default')) {
      scopes = scopes + '.default';
    } else if (!scopes.includes('/.default')) {
      scopes = scopes + '/.default';
    }
    
    const tokenResult = await getAccessTokenFromRefreshToken(
      authContextObj.TenantID,
      authContextObj.ClientID,
      authContextObj.RefreshToken,
      scopes
    );

    if (!tokenResult || !tokenResult.accessToken) {
      return {
        success: false,
        error: 'No se pudo obtener Access Token de Azure AD. Verifica que el RefreshToken sea válido.'
      };
    }

    console.log('✓ Access Token obtenido exitosamente');
    
    // Extraer el nombre del entorno de la URL
    const environmentNameMatch = environmentUrl.match(/\/([^\/]+)$/);
    const environmentName = environmentNameMatch ? environmentNameMatch[1] : 'Production';
    
    console.log(`Nombre del entorno: ${environmentName}`);
    
    // Automation API URL (igual que BcContainerHelper)
    const automationApiUrl = `https://api.businesscentral.dynamics.com/v2.0/${environmentName}/api/microsoft/automation/v2.0`;
    
    const authHeaders = {
      'Authorization': `Bearer ${tokenResult.accessToken}`
    };
    
    // Paso 1: Obtener Company ID
    console.log('Paso 1: Obteniendo Company...');
    const companiesRes = await fetch(`${automationApiUrl}/companies`, {
      method: 'GET',
      headers: authHeaders
    });
    
    if (!companiesRes.ok) {
      const errorText = await companiesRes.text();
      return {
        success: false,
        error: `Error obteniendo companies: ${companiesRes.status} ${errorText}`
      };
    }
    
    const companiesData = await companiesRes.json();
    const company = companiesData.value?.[0];
    
    if (!company || !company.id) {
      return {
        success: false,
        error: 'No se encontró una company en el entorno'
      };
    }
    
    const companyId = company.id;
    console.log(`✓ Company: ${company.name} (${companyId})`);
    
    // Paso 2: Obtener extensiones actuales
    console.log('Paso 2: Obteniendo extensiones instaladas...');
    const extensionsRes = await fetch(`${automationApiUrl}/companies(${companyId})/extensions`, {
      method: 'GET',
      headers: authHeaders
    });
    
    if (!extensionsRes.ok) {
      const errorText = await extensionsRes.text();
      return {
        success: false,
        error: `Error obteniendo extensiones: ${extensionsRes.status} ${errorText}`
      };
    }
    
    const extensionsData = await extensionsRes.json();
    console.log(`✓ Extensiones actuales: ${extensionsData.value?.length || 0}`);
    
    // Paso 3: Crear/Actualizar extensionUpload entity
    console.log('Paso 3: Creando extensionUpload entity...');
    
    // Primero intentar obtener si ya existe
    const getUploadRes = await fetch(`${automationApiUrl}/companies(${companyId})/extensionUpload`, {
      method: 'GET',
      headers: authHeaders
    });
    
    let extensionUpload;
    const uploadBody = {
      schedule: 'Current Version',
      SchemaSyncMode: 'Add'
    };
    
    if (getUploadRes.ok) {
      const existingUpload = await getUploadRes.json();
      if (existingUpload.value && existingUpload.value.length > 0 && existingUpload.value[0].systemId) {
        // Ya existe, hacer PATCH
        const systemId = existingUpload.value[0].systemId;
        const patchRes = await fetch(`${automationApiUrl}/companies(${companyId})/extensionUpload(${systemId})`, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            'If-Match': '*'
          },
          body: JSON.stringify(uploadBody)
        });
        
        if (!patchRes.ok) {
          const errorText = await patchRes.text();
          return {
            success: false,
            error: `Error actualizando extensionUpload: ${patchRes.status} ${errorText}`
          };
        }
        
        extensionUpload = await patchRes.json();
      }
    }
    
    if (!extensionUpload) {
      // Crear nuevo
      const postRes = await fetch(`${automationApiUrl}/companies(${companyId})/extensionUpload`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadBody)
      });
      
      if (!postRes.ok) {
        const errorText = await postRes.text();
        return {
          success: false,
          error: `Error creando extensionUpload: ${postRes.status} ${errorText}`
        };
      }
      
      extensionUpload = await postRes.json();
    }
    
    if (!extensionUpload.systemId) {
      return {
        success: false,
        error: 'No se pudo obtener systemId de extensionUpload'
      };
    }
    
    console.log(`✓ ExtensionUpload entity creada: ${extensionUpload.systemId}`);
    
    // Paso 4: Subir contenido del archivo .app
    console.log('Paso 4: Subiendo archivo .app...');
    const mediaEditLink = extensionUpload['extensionContent@odata.mediaEditLink'];
    
    if (!mediaEditLink) {
      return {
        success: false,
        error: 'No se encontró extensionContent@odata.mediaEditLink en la respuesta'
      };
    }
    
    const uploadContentRes = await fetch(mediaEditLink, {
      method: 'PATCH',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/octet-stream',
        'If-Match': '*'
      },
      body: appBuffer
    });
    
    if (!uploadContentRes.ok) {
      const errorText = await uploadContentRes.text();
      return {
        success: false,
        error: `Error subiendo contenido: ${uploadContentRes.status} ${errorText}`
      };
    }
    
    console.log(`✓ Archivo subido (${appBuffer.length} bytes)`);
    
    // Paso 5: Triggear la instalación
    console.log('Paso 5: Triggerando instalación...');
    const uploadActionUrl = `${automationApiUrl}/companies(${companyId})/extensionUpload(${extensionUpload.systemId})/Microsoft.NAV.upload`;
    const triggerRes = await fetch(uploadActionUrl, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'If-Match': '*'
      }
    });
    
    if (!triggerRes.ok) {
      const errorText = await triggerRes.text();
      return {
        success: false,
        error: `Error triggerando instalación: ${triggerRes.status} ${errorText}`
      };
    }
    
    console.log('✓ Instalación triggerrada');
    
    // Paso 6: Poll deployment status
    console.log('Paso 6: Monitoreando progreso...');
    
    // Extraer info del app.json del buffer
    const appJsonMatch = appBuffer.toString('utf-8').match(/"id"\s*:\s*"([^"]+)"/);
    const appIdFromBuffer = appJsonMatch ? appJsonMatch[1] : appId;
    
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo (5 segundos * 60)
    let lastStatus = '';
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      attempts++;
      
      try {
        const statusRes = await fetch(`${automationApiUrl}/companies(${companyId})/extensionDeploymentStatus`, {
          method: 'GET',
          headers: authHeaders
        });
        
        if (!statusRes.ok) {
          console.log(`⚠ Error obteniendo status (intento ${attempts}/${maxAttempts})`);
          continue;
        }
        
        const statusData = await statusRes.json();
        const deploymentStatuses = statusData.value || [];
        
        // Buscar el status de nuestra app (por ID si lo tenemos, o por la última en la lista)
        let thisExtension = deploymentStatuses.find((ext: any) => ext.appId === appIdFromBuffer);
        if (!thisExtension && deploymentStatuses.length > 0) {
          // Si no encontramos por ID, tomar el último deployment
          thisExtension = deploymentStatuses[deploymentStatuses.length - 1];
        }
        
        if (!thisExtension) {
          console.log(`⚠ No se encontró deployment status (intento ${attempts}/${maxAttempts})`);
          continue;
        }
        
        const status = thisExtension.status || thisExtension.Status;
        if (status !== lastStatus) {
          console.log(`Status: ${status}`);
          lastStatus = status;
        }
        
        if (status === 'Completed') {
          completed = true;
          console.log('✓ Deployment completado exitosamente');
        } else if (status === 'InProgress') {
          // Continuar esperando
        } else if (status === 'Unknown') {
          return {
            success: false,
            error: 'Deployment status: Unknown Error'
          };
        } else if (status && status !== 'InProgress') {
          // Cualquier otro status es un error
          return {
            success: false,
            error: `Deployment failed with status: ${status}`
          };
        }
      } catch (pollError) {
        console.log(`⚠ Error en polling (intento ${attempts}/${maxAttempts}):`, pollError);
        // Continuar intentando
      }
    }
    
    if (!completed) {
      return {
        success: false,
        error: 'Timeout esperando completion del deployment después de 5 minutos'
      };
    }
    
    return { 
      success: true,
      operationId: extensionUpload.systemId
    };
  } catch (error) {
    console.error('Error instalando app en BC:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

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
 * Despliega múltiples aplicaciones en un entorno de Business Central
 * Se detiene en el primer error encontrado
 */
export async function deployApplications(
  environmentUrl: string,
  authContext: string,
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

  // Inicializar todas las apps como pendientes
  console.log(`\n🚀 Iniciando despliegue de ${applications.length} aplicación(es)...`);
  console.log(`📍 Entorno: ${environmentName}`);
  console.log('━'.repeat(80));
  
  // Procesar cada aplicación secuencialmente
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    const appNumber = i + 1;
    
    // Inicializar los 3 pasos
    const steps: Array<{
      name: string;
      status: 'pending' | 'running' | 'success' | 'error';
      message?: string;
    }> = [
      { name: '1. Validación', status: 'pending', message: undefined },
      { name: '2. Descarga', status: 'pending', message: undefined },
      { name: '3. Instalación', status: 'pending', message: undefined },
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
      
      const installResult = await installAppInBC(environmentUrl, authContext, app.id, appBuffer);

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
