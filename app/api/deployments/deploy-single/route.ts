import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { deploySingleApplication } from "@/lib/deployment";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos máximo por aplicación individual

/**
 * Endpoint para desplegar UNA SOLA aplicación
 * El cliente controla el loop, llamando a este endpoint una vez por cada app
 * Esto evita los límites de runtime de Vercel al tener procesos más cortos
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener token administrativo de GitHub desde variables de entorno
    const githubToken = process.env.GITHUB_ADMIN_TOKEN;

    if (!githubToken) {
      return NextResponse.json(
        { error: "No se configuró el token administrativo de GitHub (GITHUB_ADMIN_TOKEN)." },
        { status: 500 }
      );
    }

    // Parsear el body
    const body = await request.json();
    const { environmentUrl, authContext, environmentName, application, applicationIndex, totalApplications } = body;

    // Validar parámetros
    if (!environmentUrl || !authContext || !environmentName || !application) {
      return NextResponse.json(
        { error: "Parámetros inválidos. Se requiere: environmentUrl, authContext, environmentName, application" },
        { status: 400 }
      );
    }

    console.log(`\n🚀 Desplegando aplicación ${applicationIndex + 1}/${totalApplications}: ${application.name}`);
    console.log(`   Entorno: ${environmentName}`);

    // Ejecutar el despliegue de la aplicación individual
    const result = await deploySingleApplication(
      environmentUrl,
      authContext,
      application,
      githubToken
    );

    console.log(`\n${result.success ? '✅' : '❌'} Resultado: ${application.name} - ${result.success ? 'ÉXITO' : 'ERROR'}`);

    return NextResponse.json({
      success: result.success,
      applicationId: application.id,
      applicationName: application.name,
      error: result.error,
      version: result.version,
      steps: result.steps,
    });

  } catch (error) {
    console.error("Error en endpoint de despliegue individual:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
