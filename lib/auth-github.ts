import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

/**
 * Obtiene el GitHub token del usuario autenticado desde la base de datos
 * @returns El token de GitHub o null si no existe
 * @throws Error si el usuario no está autenticado
 */
export async function getAuthenticatedUserGitHubToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Usuario no autenticado");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { githubToken: true },
  });

  return user?.githubToken || null;
}
