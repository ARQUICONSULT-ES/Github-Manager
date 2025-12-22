import { NextRequest, NextResponse } from "next/server";
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

    // Refrescar el token directamente
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
 * POST /api/customers/tenants/[id]/environments/sync
 * Sincroniza los environments de Business Central con la base de datos local
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar y refrescar el token si es necesario
    const tokenResult = await ensureValidToken(id);
    
    if (!tokenResult.success || !tokenResult.token) {
      return NextResponse.json(
        { error: `Error de autenticación: ${tokenResult.error || 'No se pudo obtener token'}` },
        { status: 401 }
      );
    }

    // Llamar a la API de Business Central usando el token validado/refrescado
    const bcApiUrl = process.env.BC_ADMIN_API_URL || "https://api.businesscentral.dynamics.com/admin/v2.28/applications";
    const url = `${bcApiUrl}/environments`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from BC API:", errorText);
      return NextResponse.json(
        { error: `Error al obtener environments: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data: BCEnvironmentsResponse = await response.json();

    // Sincronizar con la base de datos usando transacción
    const syncedEnvironments = await prisma.$transaction(async (tx) => {
      // Obtener environments existentes
      const existingEnvironments = await tx.environment.findMany({
        where: { tenantId: id },
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
              tenantId: id,
              name: env.name,
            },
          },
          data: { status: "SoftDeleted" },
        });
      }

      // Crear o actualizar los environments actuales de BC
      const environments = await Promise.all(
        data.value.map((bcEnv: BCEnvironment) =>
          tx.environment.upsert({
            where: {
              tenantId_name: {
                tenantId: id,
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
              tenantId: id,
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

      return environments;
    });

    return NextResponse.json(syncedEnvironments);
  } catch (error) {
    console.error("Error syncing environments:", error);
    return NextResponse.json(
      { error: "Error al sincronizar environments" },
      { status: 500 }
    );
  }
}
