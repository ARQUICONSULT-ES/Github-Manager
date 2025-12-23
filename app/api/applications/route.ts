import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth-permissions";

/**
 * GET /api/applications
 * Obtiene todas las aplicaciones del catálogo (tabla Application)
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

    // Los admins ven todas las aplicaciones
    // Los usuarios también pueden ver el catálogo completo de aplicaciones
    const applications = await prisma.application.findMany({
      orderBy: [
        { publisher: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Error al obtener las aplicaciones" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications
 * Crea una nueva aplicación en el catálogo
 */
export async function POST(request: NextRequest) {
  try {
    const permissions = await getUserPermissions();

    if (!permissions.isAuthenticated || !permissions.isAdmin) {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden crear aplicaciones." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, publisher, githubRepoName } = body;

    if (!name || !publisher || !githubRepoName) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, publisher, githubRepoName" },
        { status: 400 }
      );
    }

    // Generar un ID UUID para la nueva aplicación
    const newApplication = await prisma.application.create({
      data: {
        id: crypto.randomUUID(),
        name,
        publisher,
        githubRepoName,
      },
    });

    return NextResponse.json(newApplication, { status: 201 });
  } catch (error) {
    console.error("Error creating application:", error);
    return NextResponse.json(
      { error: "Error al crear la aplicación" },
      { status: 500 }
    );
  }
}
