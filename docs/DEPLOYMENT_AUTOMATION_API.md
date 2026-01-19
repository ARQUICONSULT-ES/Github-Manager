# Deployment con Automation API de Business Central

## Arquitectura

El deployment está basado en el mismo flujo que utiliza **BcContainerHelper** (`Publish-PerTenantExtensionApps`) y **AL-Go for GitHub**.

### Flujo Completo

```
Usuario → CENTRA Frontend → API Route → deployment.ts
                                            ↓
                                    OAuth Token Exchange
                                    (Azure AD Refresh Token)
                                            ↓
                              Business Central Automation API
                              (/api/microsoft/automation/v2.0)
```

## AuthContext

El **AuthContext** es un JSON con credenciales OAuth que permite obtener Access Tokens dinámicamente.

### Estructura del AuthContext

```json
{
  "TenantID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "ClientID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "RefreshToken": "0.xxxxxxxxxxxxxxxxx...",
  "Scopes": "https://api.businesscentral.dynamics.com/"
}
```

### Cómo Obtener el AuthContext

En Business Central Web Client:

1. Abrir **DevTools** (F12)
2. Ir a la pestaña **Console**
3. Ejecutar:
```javascript
sessionStorage['Microsoft.Dynamics.Nav.WebClient.OAuth.Context']
```
4. Copiar el JSON resultante

## Proceso de Deployment

El deployment sigue estos pasos (igual que BcContainerHelper):

### 1. Obtener Access Token

```http
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={clientId}
&scope=https://api.businesscentral.dynamics.com/.default
&refresh_token={refreshToken}
&grant_type=refresh_token
```

**Respuesta:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 3599,
  ...
}
```

### 2. Obtener Company ID

```http
GET https://api.businesscentral.dynamics.com/v2.0/{environment}/api/microsoft/automation/v2.0/companies
Authorization: Bearer {accessToken}
```

**Respuesta:**
```json
{
  "value": [
    {
      "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "CRONUS International Ltd.",
      ...
    }
  ]
}
```

### 3. Obtener Extensiones Actuales

```http
GET {automationApiUrl}/companies({companyId})/extensions
Authorization: Bearer {accessToken}
```

Esto permite verificar qué extensiones ya están instaladas.

### 4. Crear/Actualizar ExtensionUpload Entity

```http
POST {automationApiUrl}/companies({companyId})/extensionUpload
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "schedule": "Current Version",
  "SchemaSyncMode": "Add"
}
```

**Respuesta:**
```json
{
  "systemId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "extensionContent@odata.mediaEditLink": "https://api.businesscentral.dynamics.com/v2.0/.../extensionUpload(...)/extensionContent",
  ...
}
```

### 5. Subir Contenido del Archivo .app

```http
PATCH {extensionContent@odata.mediaEditLink}
Authorization: Bearer {accessToken}
Content-Type: application/octet-stream
If-Match: *

[binary .app file content]
```

### 6. Triggear la Instalación

```http
POST {automationApiUrl}/companies({companyId})/extensionUpload({systemId})/Microsoft.NAV.upload
Authorization: Bearer {accessToken}
If-Match: *
```

### 7. Monitorear Progreso (Polling)

```http
GET {automationApiUrl}/companies({companyId})/extensionDeploymentStatus
Authorization: Bearer {accessToken}
```

**Respuesta:**
```json
{
  "value": [
    {
      "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "My Extension",
      "publisher": "My Publisher",
      "status": "InProgress",  // o "Completed", "Unknown", etc.
      ...
    }
  ]
}
```

El sistema hace polling cada 5 segundos hasta que el status sea `"Completed"` o se alcance el timeout (5 minutos).

## Ejemplo de Uso en CENTRA

1. Usuario va a **Deployments**
2. Selecciona:
   - Aplicación (desde GitHub)
   - Tenant (con sus entornos)
   - Entorno específico
3. Sistema construye automáticamente `environmentUrl`:
   ```
   https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{environmentName}
   ```
4. Se solicita **AuthContext** en un diálogo
5. Usuario pega el JSON del AuthContext
6. Sistema ejecuta el deployment:
   - ✓ Valida AuthContext
   - ✓ Obtiene Access Token
   - ✓ Crea extensionUpload
   - ✓ Sube archivo .app
   - ✓ Triggerea instalación
   - ✓ Monitorea hasta completar
7. Se muestra el resultado al usuario

## Correcciones Automáticas

### Scopes

El sistema corrige automáticamente el formato:

```javascript
"https://api.businesscentral.dynamics.com/" 
→ "https://api.businesscentral.dynamics.com/.default"
```

## Troubleshooting

### Error: "No se pudo obtener Access Token"

**Causa:** RefreshToken inválido o expirado.

**Solución:**
1. Ir a Business Central Web Client
2. Obtener un nuevo AuthContext desde sessionStorage
3. Volver a intentar el deployment

### Error: "AuthContext incompleto"

**Causa:** Falta algún campo requerido (TenantID, ClientID, RefreshToken).

**Solución:**
- Copiar el JSON completo desde sessionStorage
- No editar manualmente el JSON

### Error: "No se encontró una company en el entorno"

**Causa:** El entorno no tiene companies configuradas o el Access Token no tiene permisos.

**Solución:**
- Verificar que el entorno esté activo
- Asegurarse de que el ClientID tenga permisos Automation.ReadWrite.All

### Error: "Timeout esperando completion del deployment"

**Causa:** El deployment está tardando más de 5 minutos.

**Solución:**
- Verificar el estado en Business Central → Extension Management
- El deployment puede seguir ejecutándose en segundo plano
- Revisar logs en Business Central para más detalles

### Error durante Polling: "No se encontró deployment status"

**Causa:** El deployment puede no haber iniciado correctamente.

**Solución:**
- Revisar que el triggering (paso 6) haya sido exitoso
- Verificar en Business Central si el upload está pendiente

## Diferencias con Admin Center API

| Característica | Admin Center API | Automation API |
|----------------|------------------|----------------|
| Endpoint Base | `/admin/v2.28/applications` | `/v2.0/{env}/api/microsoft/automation/v2.0` |
| Método Upload | Direct PUT | Multi-step (Create → Upload → Trigger) |
| Progreso | No polling | Polling via extensionDeploymentStatus |
| Usado por | ? | BcContainerHelper, AL-Go |
| Recomendado | ❌ | ✅ |

## Referencias

- [BcContainerHelper - Publish-PerTenantExtensionApps](https://github.com/microsoft/navcontainerhelper/blob/main/Saas/Publish-PerTenantExtensionApps.ps1)
- [AL-Go for GitHub - Deploy Actions](https://github.com/microsoft/AL-Go-Actions/blob/main/Deploy/Deploy.ps1)
- [Business Central Automation API](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/itpro-introduction-to-automation-apis)
- [Microsoft Identity Platform - OAuth 2.0](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
