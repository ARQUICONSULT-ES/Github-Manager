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
      select: { githubToken: true },
    });

    if (!user?.githubToken) {
      return NextResponse.json(
        { error: "No GitHub token found. Please add your GitHub token in your profile." },
        { status: 401 }
      );
    }

    const repos = await getUserRepos(user.githubToken);
    return NextResponse.json(repos);
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
