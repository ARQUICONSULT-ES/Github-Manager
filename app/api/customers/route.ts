import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth-permissions";

// GET - Obtener todos los clientes
export async function GET() {
  try {
    const permissions = await getUserPermissions();

    if (!permissions.isAuthenticated) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar permiso de acceso a clientes
    if (!permissions.canAccessCustomers) {
      return NextResponse.json(
        { error: "No tienes permiso para acceder a clientes" },
        { status: 403 }
      );
    }

    // Construir el where según los permisos
    // Si allCustomers es true, array vacío significa "sin restricciones"
    const whereClause = permissions.allCustomers
      ? {} // Ve todos los clientes
      : { id: { in: permissions.allowedCustomerIds } }; // Ve solo sus clientes permitidos

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: {
        customerName: 'asc',
      },
      include: {
        _count: {
          select: {
            tenants: true,
          },
        },
        tenants: {
          include: {
            environments: {
              where: {
                NOT: {
                  status: 'SoftDeleted',
                },
              },
            },
          },
        },
      },
    });

    // Mapear para incluir el conteo de tenants y entornos activos
    const customersWithCount = customers.map(customer => {
      const activeEnvironmentsCount = customer.tenants.reduce(
        (total, tenant) => total + tenant.environments.length,
        0
      );

      return {
        id: customer.id,
        customerName: customer.customerName,
        imageBase64: customer.imageBase64,
        infraestructureType: customer.infraestructureType,
        description: customer.description,
        tenantsCount: customer._count.tenants,
        activeEnvironmentsCount,
      };
    });

    return NextResponse.json(customersWithCount);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Error al obtener los clientes" },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo cliente
// NOTA: Cualquier usuario autenticado puede crear clientes
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const permissions = await getUserPermissions();

    if (!permissions.isAuthenticated) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerName, imageBase64, infraestructureType, description } = body;

    if (!customerName || customerName.trim() === "") {
      return NextResponse.json(
        { error: "El nombre del cliente es requerido" },
        { status: 400 }
      );
    }

    // Verificar si ya existe un cliente con el mismo nombre
    // IMPORTANTE: Esta búsqueda es global (no filtrada por permisos) para evitar duplicados
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        customerName: {
          equals: customerName.trim(),
          mode: 'insensitive', // Ignorar mayúsculas/minúsculas
        },
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Ya existe un cliente con este nombre" },
        { status: 409 } // Conflict
      );
    }

    // Crear el cliente
    const customer = await prisma.customer.create({
      data: {
        customerName: customerName.trim(),
        imageBase64: imageBase64 || null,
        infraestructureType: infraestructureType || "Saas",
        description: description || null,
      },
    });

    // Si el usuario NO tiene acceso a todos los clientes (no es admin),
    // asignarlo automáticamente al cliente que acaba de crear
    // Esto garantiza que el usuario pueda ver y gestionar el cliente inmediatamente
    if (!permissions.allCustomers && permissions.userId) {
      try {
        await prisma.userCustomer.create({
          data: {
            userId: permissions.userId,
            customerId: customer.id,
          },
        });
      } catch (error: any) {
        // Si ya existe la relación (código P2002), no es un error crítico
        if (error.code !== 'P2002') {
          console.error("Error creating user-customer assignment:", error);
          // No fallar la creación del cliente por un error de asignación
        }
      }
    }

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    
    // Manejar error de unique constraint de Prisma
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "Ya existe un cliente con este nombre" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Error al crear el cliente" },
      { status: 500 }
    );
  }
}
