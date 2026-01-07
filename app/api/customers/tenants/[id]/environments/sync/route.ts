import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureValidToken, syncTenantEnvironments } from "@/lib/environment-sync";

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

    // Sincronizar los entornos del tenant
    const syncResult = await syncTenantEnvironments(id, tokenResult.token);

    if (!syncResult.success) {
      return NextResponse.json(
        { error: syncResult.error || 'Error al sincronizar environments' },
        { status: 500 }
      );
    }

    // Obtener los environments actualizados para devolverlos
    const syncedEnvironments = await prisma.environment.findMany({
      where: {
        tenantId: id,
        NOT: {
          status: "SoftDeleted",
        },
      },
      orderBy: {
        name: 'asc',
      },
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
