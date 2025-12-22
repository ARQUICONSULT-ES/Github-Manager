import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// GET - Obtener todas las aplicaciones del catálogo
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const applications = await prisma.application.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Error al obtener aplicaciones:", error);
    return NextResponse.json(
      { error: "Error al obtener aplicaciones" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva aplicación
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, publisher, githubRepoName } = body;

    // Validaciones
    if (!name || !publisher || !githubRepoName) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Crear la aplicación
    const application = await prisma.application.create({
      data: {
        name,
        publisher,
        githubRepoName,
      },
    });

    return NextResponse.json(
      { application, message: "Aplicación creada exitosamente" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear aplicación:", error);
    return NextResponse.json(
      { error: "Error al crear aplicación" },
      { status: 500 }
    );
  }
}
