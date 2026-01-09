import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth-permissions";

/**
 * GET /api/environments/[tenantId]/[name]
 * Obtiene un entorno específico con sus aplicaciones instaladas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; name: string }> }
) {
  try {
    const permissions = await getUserPermissions();

    if (!permissions.isAuthenticated) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar permiso de acceso a clientes (entornos son parte del módulo clientes)
    if (!permissions.canAccessCustomers) {
      return NextResponse.json(
        { error: "No tienes permiso para acceder a entornos" },
        { status: 403 }
      );
    }

    const { tenantId, name } = await params;

    // Buscar el entorno con información del tenant y customer
    const environment = await prisma.environment.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenantId,
          name: decodeURIComponent(name),
        },
      },
      include: {
        tenant: {
          include: {
            customer: true,
          },
        },
        installedApps: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!environment) {
      return NextResponse.json(
        { error: "Entorno no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos de acceso al cliente del entorno
    const customerId = environment.tenant.customerId;
    const allowedIds: string[] = permissions.allowedCustomerIds;
    if (!permissions.allCustomers && allowedIds.length > 0 && !allowedIds.includes(customerId)) {
      return NextResponse.json(
        { error: "No autorizado para ver este entorno" },
        { status: 403 }
      );
    }

    // Formatear la respuesta
    const response = {
      tenantId: environment.tenantId,
      name: environment.name,
      type: environment.type,
      status: environment.status,
      webClientUrl: environment.webClientUrl,
      locationName: environment.locationName,
      applicationVersion: environment.applicationVersion,
      platformVersion: environment.platformVersion,
      customerId: environment.tenant.customerId,
      customerName: environment.tenant.customer.customerName,
      customerImage: environment.tenant.customer.imageBase64,
      tenantDescription: environment.tenant.description,
      installedApps: environment.installedApps.map((app) => ({
        id: app.id,
        name: app.name,
        version: app.version,
        publisher: app.publisher,
        publishedAs: app.publishedAs,
        state: app.state,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching environment:", error);
    return NextResponse.json(
      { error: "Error al obtener el entorno" },
      { status: 500 }
    );
  }
}
