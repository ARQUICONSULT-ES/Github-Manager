import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Verifica si un token ha expirado y lo refresca si es necesario
 */
async function ensureValidToken(tenantId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
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

    if (!tenant.grantType || !tenant.clientId || !tenant.clientSecret || !tenant.scope) {
      return { success: false, error: "Configuración de autenticación incompleta" };
    }

    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000;
    const needsRefresh = !tenant.token || !tenant.tokenExpiresAt || 
                        new Date(tenant.tokenExpiresAt).getTime() - now.getTime() < expirationBuffer;

    if (!needsRefresh && tenant.token) {
      return { success: true, token: tenant.token };
    }

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
      return { 
        success: false, 
        error: `Error ${authRes.status} al obtener token: ${errorData.error || authRes.statusText}` 
      };
    }

    const authData = await authRes.json();
    const accessToken = authData.access_token;
    const expiresIn = authData.expires_in;

    if (!accessToken) {
      return { success: false, error: "No se recibió token de acceso" };
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        token: accessToken,
        tokenExpiresAt: tokenExpiresAt,
      },
    });

    return { success: true, token: accessToken };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido al verificar token' 
    };
  }
}

/**
 * Sincroniza las aplicaciones instaladas de un entorno específico
 */
async function syncEnvironmentApplications(
  tenantId: string,
  environmentName: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const bcApiUrl = `https://api.businesscentral.dynamics.com/admin/v2.28/applications/${tenantId}/environments/${environmentName}/apps`;

    const bcResponse = await fetch(bcApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!bcResponse.ok) {
      return { 
        success: false, 
        error: `Error ${bcResponse.status} al obtener aplicaciones de BC: ${bcResponse.statusText}` 
      };
    }

    const bcData = await bcResponse.json();
    const apps = bcData.value || [];

    // Sincronizar aplicaciones usando upsert en una transacción
    await prisma.$transaction(async (tx) => {
      for (const app of apps) {
        await tx.installedApp.upsert({
          where: {
            tenantId_environmentName_id: {
              tenantId: tenantId,
              environmentName: environmentName,
              id: app.id,
            },
          },
          update: {
            name: app.name,
            publisher: app.publisher,
            version: app.version,
            state: app.state,
            publishedAs: app.publishedAs || "Unknown",
          },
          create: {
            tenantId: tenantId,
            environmentName: environmentName,
            id: app.id,
            name: app.name,
            publisher: app.publisher,
            version: app.version,
            state: app.state,
            publishedAs: app.publishedAs || "Unknown",
          },
        });
      }

      // Eliminar aplicaciones que ya no existen en BC
      const currentAppIds = apps.map((app: any) => app.id);
      await tx.installedApp.deleteMany({
        where: {
          tenantId: tenantId,
          environmentName: environmentName,
          NOT: {
            id: { in: currentAppIds },
          },
        },
      });
    });

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * POST /api/installedapps/sync-customer/[customerId]
 * Sincroniza las instalaciones de todos los entornos de un cliente específico
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    // Obtener todos los entornos del cliente (a través de sus tenants)
    const environments = await prisma.environment.findMany({
      where: {
        tenant: {
          customerId: customerId,
        },
        NOT: {
          status: "SoftDeleted",
        },
      },
      select: {
        tenantId: true,
        name: true,
      },
    });

    if (environments.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        total: 0,
        errors: [],
        message: "No hay entornos activos para este cliente",
      });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ environmentName: string; error: string }> = [];

    // Sincronizar cada entorno
    for (const env of environments) {
      try {
        const tokenResult = await ensureValidToken(env.tenantId);
        
        if (!tokenResult.success || !tokenResult.token) {
          failedCount++;
          errors.push({
            environmentName: env.name,
            error: `Token inválido: ${tokenResult.error || 'No se pudo obtener token'}`,
          });
          continue;
        }

        const syncResult = await syncEnvironmentApplications(
          env.tenantId,
          env.name,
          tokenResult.token
        );

        if (syncResult.success) {
          successCount++;
        } else {
          failedCount++;
          errors.push({
            environmentName: env.name,
            error: syncResult.error || 'Error desconocido',
          });
        }
      } catch (error) {
        failedCount++;
        errors.push({
          environmentName: env.name,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      total: environments.length,
      errors,
      message: `Sincronización completada: ${successCount}/${environments.length} entornos sincronizados`,
    });
  } catch (error) {
    console.error("Error syncing customer applications:", error);
    return NextResponse.json(
      { 
        error: "Error al sincronizar las aplicaciones del cliente",
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
