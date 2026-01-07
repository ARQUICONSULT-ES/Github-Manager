import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncMultipleEnvironments } from "@/lib/installedapp-sync";

/**
 * POST /api/installedapps/sync-all
 * Sincroniza las instalaciones de todos los entornos de todos los tenants con Business Central
 */
export async function POST() {
  try {
    // Obtener todos los entornos activos (no SoftDeleted)
    const environments = await prisma.environment.findMany({
      where: {
        NOT: {
          status: "SoftDeleted",
        },
      },
      select: {
        tenantId: true,
        name: true,
        tenant: {
          select: {
            customer: {
              select: {
                customerName: true,
              },
            },
          },
        },
      },
    });

    if (environments.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        total: 0,
        errors: [],
        message: "No hay entornos activos para sincronizar",
      });
    }

    // Mapear entornos al formato esperado
    const envsToSync = environments.map(env => ({
      tenantId: env.tenantId,
      name: env.name,
      customerName: env.tenant.customer.customerName,
    }));

    // Sincronizar usando la función compartida
    const results = await syncMultipleEnvironments(envsToSync);

    return NextResponse.json({
      ...results,
      message: `Sincronización completada: ${results.success}/${results.total} entornos sincronizados correctamente`,
    });
  } catch (error) {
    console.error("Error syncing all applications:", error);
    return NextResponse.json(
      { 
        error: "Error al sincronizar las aplicaciones",
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
