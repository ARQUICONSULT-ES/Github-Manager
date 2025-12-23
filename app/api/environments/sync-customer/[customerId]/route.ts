import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface SyncResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ tenantId: string; error: string }>;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await context.params;

    // Obtener los tenants del cliente
    const tenants = await prisma.tenant.findMany({
      where: {
        customerId: customerId,
      },
      select: {
        id: true,
        grantType: true,
        clientId: true,
        clientSecret: true,
        scope: true,
        token: true,
        tokenExpiresAt: true,
      },
    });

    if (tenants.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        total: 0,
        errors: [],
        message: "No hay tenants configurados para este cliente",
      });
    }

    const result: SyncResult = {
      success: 0,
      failed: 0,
      total: tenants.length,
      errors: [],
    };

    for (const tenant of tenants) {
      try {
        // Validar configuración OAuth del tenant
        if (
          !tenant.grantType ||
          !tenant.clientId ||
          !tenant.clientSecret ||
          !tenant.scope
        ) {
          result.failed++;
          result.errors.push({
            tenantId: tenant.id,
            error: "Tenant sin configuración OAuth completa",
          });
          continue;
        }

        // Verificar si el token está expirado o no existe
        let accessToken = tenant.token;
        const now = new Date();
        const tokenExpiresAt = tenant.tokenExpiresAt
          ? new Date(tenant.tokenExpiresAt)
          : null;

        // Refresh token si está expirado o expira en menos de 5 minutos
        if (
          !accessToken ||
          !tokenExpiresAt ||
          tokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000
        ) {
          // Obtener nuevo token
          const tokenUrl = `https://login.microsoftonline.com/${tenant.id}/oauth2/v2.0/token`;
          const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: tenant.grantType,
              client_id: tenant.clientId,
              client_secret: tenant.clientSecret,
              scope: tenant.scope,
            }),
          });

          if (!tokenResponse.ok) {
            result.failed++;
            result.errors.push({
              tenantId: tenant.id,
              error: `Error al obtener token: ${tokenResponse.status}`,
            });
            continue;
          }

          const tokenData = await tokenResponse.json();
          accessToken = tokenData.access_token;

          // Actualizar token en la base de datos
          const expiresIn = tokenData.expires_in || 3600;
          const newExpiresAt = new Date(
            now.getTime() + expiresIn * 1000
          );

          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              token: accessToken,
              tokenExpiresAt: newExpiresAt,
            },
          });
        }

        // Obtener entornos de BC
        const bcResponse = await fetch(
          `https://api.businesscentral.dynamics.com/admin/v2.28/applications/${tenant.id}/environments`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!bcResponse.ok) {
          result.failed++;
          result.errors.push({
            tenantId: tenant.id,
            error: `Error al obtener entornos: ${bcResponse.status}`,
          });
          continue;
        }

        const bcData = await bcResponse.json();
        const environments = bcData.value || [];

        // Sincronizar entornos usando upsert en una transacción
        await prisma.$transaction(async (tx) => {
          for (const env of environments) {
            await tx.environment.upsert({
              where: {
                tenantId_name: {
                  tenantId: tenant.id,
                  name: env.name,
                },
              },
              update: {
                type: env.type,
                applicationVersion: env.applicationVersion,
                status: env.status,
                webClientUrl: env.webClientLoginUrl,
                locationName: env.locationName,
                platformVersion: env.platformVersion,
              },
              create: {
                tenantId: tenant.id,
                name: env.name,
                type: env.type,
                applicationVersion: env.applicationVersion,
                status: env.status,
                webClientUrl: env.webClientLoginUrl,
                locationName: env.locationName,
                platformVersion: env.platformVersion,
              },
            });
          }

          // Eliminar entornos que ya no existen en BC
          const envNamesInBC = environments.map((e: any) => e.name);
          await tx.environment.deleteMany({
            where: {
              tenantId: tenant.id,
              name: {
                notIn: envNamesInBC,
              },
            },
          });
        });

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          tenantId: tenant.id,
          error:
            error instanceof Error
              ? error.message
              : "Error desconocido",
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing customer environments:", error);
    return NextResponse.json(
      {
        error: "Error al sincronizar entornos del cliente",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
