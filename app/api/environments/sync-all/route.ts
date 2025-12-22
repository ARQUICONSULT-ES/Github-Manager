import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { BCEnvironmentsResponse, BCEnvironment } from "@/modules/customers/types";

/**
 * Verifica si un token ha expirado y lo refresca si es necesario
 * Retorna el token válido (ya sea el actual o uno nuevo)
 */
async function ensureValidToken(tenantId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Obtener información del token
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        tokenExpiresAt: true,
        token: true,
        grantType: true,
        clientId: true,
        clientSecret: true,
        scope: true,
      },
    });

    if (!tenant) {
      return { success: false, error: "Tenant no encontrado" };
    }

    // Verificar si no tiene configuración de autenticación
    if (!tenant.grantType || !tenant.clientId || !tenant.clientSecret || !tenant.scope) {
      return { success: false, error: "Configuración de autenticación incompleta" };
    }

    // Verificar si el token ha expirado (con margen de 5 minutos)
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutos en milisegundos
    const needsRefresh = !tenant.token || !tenant.tokenExpiresAt || 
                        new Date(tenant.tokenExpiresAt).getTime() - now.getTime() < expirationBuffer;

    if (!needsRefresh && tenant.token) {
      return { success: true, token: tenant.token }; // Token válido
    }

    // Refrescar el token directamente (sin hacer petición HTTP interna)
    console.log(`Refrescando token para tenant ${tenantId}...`);
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const authRes = await fetch(authUrl, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: tenant.grantType,
        client_id: tenant.clientId,
        client_secret: tenant.clientSecret,
        scope: tenant.scope,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!authRes.ok) {
      const errorData = await authRes.json().catch(() => ({ error: "No se pudo parsear la respuesta de error" }));
      console.error(`Error al refrescar token para tenant ${tenantId}:`, errorData);
      return { 
        success: false, 
        error: `Error ${authRes.status} al obtener token: ${errorData.error || authRes.statusText}` 
      };
    }

    // Parsear la respuesta
    const authData = await authRes.json();
    const accessToken = authData.access_token;
    const expiresIn = authData.expires_in; // segundos

    if (!accessToken) {
      return { success: false, error: "No se recibió token de acceso" };
    }

    // Calcular la fecha de expiración
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Actualizar el tenant con el nuevo token
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        token: accessToken,
        tokenExpiresAt: tokenExpiresAt,
      },
    });

    console.log(`Token refrescado exitosamente para tenant ${tenantId}`);
    return { success: true, token: accessToken };
  } catch (error) {
    console.error('Error ensuring valid token:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido al verificar token' 
    };
  }
}

/**
 * Sincroniza los entornos de un tenant específico con Business Central
 */
async function syncTenantEnvironments(tenantId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Llamar a la API de Business Central usando el token validado
    const bcApiUrl = process.env.BC_ADMIN_API_URL || "https://api.businesscentral.dynamics.com/admin/v2.28/applications";
    const url = `${bcApiUrl}/environments`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from BC API for tenant ${tenantId}:`, errorText);
      return { 
        success: false, 
        error: `Error al obtener environments: ${response.statusText}` 
      };
    }

    const data: BCEnvironmentsResponse = await response.json();

    // Sincronizar con la base de datos usando transacción
    await prisma.$transaction(async (tx) => {
      // Obtener environments existentes
      const existingEnvironments = await tx.environment.findMany({
        where: { tenantId },
      });

      // Crear un Set con los nombres de los environments actuales de BC
      const currentEnvNames = new Set(data.value.map((env) => env.name));

      // Marcar como SoftDeleted los que ya no existen en BC
      const envsToSoftDelete = existingEnvironments.filter(
        (env) => !currentEnvNames.has(env.name)
      );

      for (const env of envsToSoftDelete) {
        await tx.environment.update({
          where: {
            tenantId_name: {
              tenantId,
              name: env.name,
            },
          },
          data: { status: "SoftDeleted" },
        });
      }

      // Crear o actualizar los environments actuales de BC
      await Promise.all(
        data.value.map((bcEnv: BCEnvironment) =>
          tx.environment.upsert({
            where: {
              tenantId_name: {
                tenantId,
                name: bcEnv.name,
              },
            },
            update: {
              type: bcEnv.type,
              applicationVersion: bcEnv.applicationVersion,
              status: bcEnv.status,
              webClientUrl: bcEnv.webClientLoginUrl,
              locationName: bcEnv.locationName || null,
              platformVersion: bcEnv.platformVersion || null,
            },
            create: {
              tenantId,
              name: bcEnv.name,
              type: bcEnv.type,
              applicationVersion: bcEnv.applicationVersion,
              status: bcEnv.status,
              webClientUrl: bcEnv.webClientLoginUrl,
              locationName: bcEnv.locationName || null,
              platformVersion: bcEnv.platformVersion || null,
            },
          })
        )
      );
    });

    return { success: true };
  } catch (error) {
    console.error(`Error syncing environments for tenant ${tenantId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * POST /api/environments/sync-all
 * Sincroniza los entornos de todos los tenants con Business Central
 */
export async function POST() {
  try {
    // Obtener todos los tenants activos
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        customerId: true,
        customer: {
          select: {
            customerName: true,
          },
        },
      },
    });

    if (tenants.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        total: 0,
        errors: [],
        message: "No hay tenants para sincronizar",
      });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ tenantId: string; customerName: string; error: string }> = [];

    // Sincronizar cada tenant de forma secuencial para evitar sobrecarga
    for (const tenant of tenants) {
      try {
        // Verificar y refrescar el token si es necesario
        const tokenResult = await ensureValidToken(tenant.id);
        
        if (!tokenResult.success || !tokenResult.token) {
          failedCount++;
          errors.push({
            tenantId: tenant.id,
            customerName: tenant.customer.customerName,
            error: `Token inválido: ${tokenResult.error || 'No se pudo obtener token'}`,
          });
          continue; // Saltar a la siguiente iteración
        }

        // Sincronizar los entornos del tenant directamente
        const syncResult = await syncTenantEnvironments(tenant.id, tokenResult.token);

        if (syncResult.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push({
            tenantId: tenant.id,
            customerName: tenant.customer.customerName,
            error: syncResult.error || 'Error desconocido',
          });
        }
      } catch (error) {
        failedCount++;
        errors.push({
          tenantId: tenant.id,
          customerName: tenant.customer.customerName,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      total: tenants.length,
      errors,
      message: `Sincronización completada: ${successCount}/${tenants.length} tenants sincronizados correctamente`,
    });
  } catch (error) {
    console.error("Error syncing all environments:", error);
    return NextResponse.json(
      { 
        error: "Error al sincronizar los entornos",
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
