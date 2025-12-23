import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { getUserRepos } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener el token de GitHub del usuario desde la base de datos
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { 
        id: true,
        githubToken: true,
        githubAvatar: true,
      },
    });

    if (!user?.githubToken) {
      return NextResponse.json(
        { error: "No GitHub token found. Please add your GitHub token in your profile." },
        { status: 401 }
      );
    }

    // Obtener y actualizar la foto de perfil de GitHub de forma síncrona
    let updatedAvatar = user.githubAvatar;
    try {
      const githubUserResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${user.githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (githubUserResponse.ok) {
        const githubUser = await githubUserResponse.json();
        const newAvatar = githubUser.avatar_url || null;

        // Solo actualizar si el avatar ha cambiado
        if (newAvatar !== user.githubAvatar) {
          await prisma.user.update({
            where: { id: user.id },
            data: { githubAvatar: newAvatar },
          });
          updatedAvatar = newAvatar;
        }
      }
    } catch (err) {
      console.warn("Error actualizando avatar de GitHub:", err);
      // Continuar con la obtención de repos aunque falle el avatar
    }

    const repos = await getUserRepos(user.githubToken);
    return NextResponse.json({ repos, githubAvatar: updatedAvatar });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
