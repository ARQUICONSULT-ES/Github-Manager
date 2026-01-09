import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth-permissions";

/**
 * GET /api/installedapps
 * Obtiene todas las instalaciones de la base de datos con información del cliente y entorno
 * Implementa paginación por entorno para evitar errores de memoria
 */
export async function GET(request: NextRequest) {
  try {
    const permissions = await getUserPermissions();

    if (!permissions.isAuthenticated) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar permiso de acceso a clientes (instalaciones son parte del módulo clientes)
    if (!permissions.canAccessCustomers) {
      return NextResponse.json(
        { error: "No tienes permiso para acceder a instalaciones" },
        { status: 403 }
      );
    }

    // Obtener el parámetro customerId de la URL si existe
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // Construir el where según los permisos para obtener entornos
    let environmentWhereClause: any = {};
    
    if (customerId) {
      // Si se especifica un customerId, filtrar por ese cliente
      // Verificar que el usuario tenga permiso para ver ese cliente (solo si no tiene allCustomers)
      const allowedIds: string[] = permissions.allowedCustomerIds;
      if (!permissions.allCustomers && allowedIds.length > 0 && !allowedIds.includes(customerId)) {
        return NextResponse.json(
          { error: "No autorizado para ver este cliente" },
          { status: 403 }
        );
      }
      environmentWhereClause = {
        tenant: {
          customerId: customerId,
        },
      };
    } else {
      // Sin customerId, aplicar permisos generales
      environmentWhereClause = permissions.allCustomers
        ? {} // Ve todos los entornos
        : {
            tenant: {
              customerId: { in: permissions.allowedCustomerIds },
            },
          }; // Ve solo entornos de sus clientes permitidos
    }

    // Paso 1: Obtener todos los entornos que cumplen con los permisos
    const environments = await prisma.environment.findMany({
      where: environmentWhereClause,
      select: {
        tenantId: true,
        name: true,
        type: true,
        status: true,
        tenant: {
          select: {
            customer: {
              select: {
                id: true,
                customerName: true,
                // NO incluir imageBase64 - es demasiado pesado
              },
            },
          },
        },
      },
      orderBy: [
        { tenant: { customer: { customerName: "asc" } } },
        { name: "asc" },
      ],
    });

    // Paso 2: Procesar entornos en lotes para evitar sobrecarga de memoria
    const BATCH_SIZE = 10; // Procesar 10 entornos a la vez
    const allApplications: any[] = [];

    for (let i = 0; i < environments.length; i += BATCH_SIZE) {
      const batch = environments.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (env) => {
        // Sin límite por entorno - cargar todas las apps
        const apps = await prisma.installedApp.findMany({
          where: {
            tenantId: env.tenantId,
            environmentName: env.name,
          },
          orderBy: [
            { name: "asc" },
          ],
          select: {
            tenantId: true,
            environmentName: true,
            id: true,
            name: true,
            version: true,
            publisher: true,
            publishedAs: true,
            state: true,
          },
        });

        // Transformar las apps agregando información del entorno (sin imagen base64)
        return apps.map((app) => ({
          tenantId: app.tenantId,
          environmentName: app.environmentName,
          id: app.id,
          name: app.name,
          version: app.version,
          publisher: app.publisher,
          publishedAs: app.publishedAs,
          state: app.state,
          customerId: env.tenant.customer.id,
          customerName: env.tenant.customer.customerName,
          environmentType: env.type,
          environmentStatus: env.status,
        }));
      });

      const batchResults = await Promise.all(batchPromises);
      allApplications.push(...batchResults.flat());
      
      // Log de progreso
      console.log(`Processed ${Math.min(i + BATCH_SIZE, environments.length)}/${environments.length} environments, ${allApplications.length} apps so far`);
    }

    console.log(`Returning ${allApplications.length} installed apps from ${environments.length} environments`);

    return NextResponse.json(allApplications);
  } catch (error) {
    console.error("Error fetching installed apps:", error);
    return NextResponse.json(
      { error: "Error al obtener las instalaciones" },
      { status: 500 }
    );
  }
}
