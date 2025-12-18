import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// PUT - Actualizar el GitHub token del usuario actual
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { githubToken } = body;

    if (!githubToken || githubToken.trim() === "") {
      return NextResponse.json(
        { error: "GitHub token es requerido" },
        { status: 400 }
      );
    }

    // Actualizar solo el githubToken del usuario actual
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { githubToken: githubToken.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        githubToken: true,
      },
    });

    return NextResponse.json({ 
      message: "GitHub token actualizado correctamente",
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error al actualizar GitHub token:", error);
    return NextResponse.json(
      { error: "Error al actualizar GitHub token" },
      { status: 500 }
    );
  }
}

// GET - Obtener el estado del GitHub token del usuario actual
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        githubToken: true,
      },
    });

    return NextResponse.json({ 
      hasToken: !!user?.githubToken,
      tokenPreview: user?.githubToken ? `${user.githubToken.substring(0, 10)}...` : null
    });
  } catch (error) {
    console.error("Error al verificar GitHub token:", error);
    return NextResponse.json(
      { error: "Error al verificar GitHub token" },
      { status: 500 }
    );
  }
}
