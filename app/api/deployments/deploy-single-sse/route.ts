import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { deploySingleApplication } from "@/lib/deployment";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos máximo por aplicación individual

/**
 * Endpoint SSE para desplegar UNA SOLA aplicación con actualizaciones en tiempo real
 * Usa Server-Sent Events para enviar el progreso de cada paso al cliente
 */
export async function POST(request: NextRequest) {
  // Verificar autenticación
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return new Response(
      JSON.stringify({ error: "No autenticado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Obtener token administrativo de GitHub desde variables de entorno
  const githubToken = process.env.GITHUB_ADMIN_TOKEN;

  if (!githubToken) {
    return new Response(
      JSON.stringify({ error: "No se configuró el token administrativo de GitHub (GITHUB_ADMIN_TOKEN)." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parsear el body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Body inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { environmentUrl, authContext, environmentName, application, applicationIndex, totalApplications } = body;

  // Validar parámetros
  if (!environmentUrl || !authContext || !environmentName || !application) {
    return new Response(
      JSON.stringify({ error: "Parámetros inválidos. Se requiere: environmentUrl, authContext, environmentName, application" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`\n🚀 [SSE] Desplegando aplicación ${applicationIndex + 1}/${totalApplications}: ${application.name}`);
  console.log(`   Entorno: ${environmentName}`);

  // Crear un stream para SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Función para enviar eventos SSE
      const sendEvent = (eventType: string, data: unknown) => {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        // Ejecutar el despliegue con callback de progreso
        const result = await deploySingleApplication(
          environmentUrl,
          authContext,
          application,
          githubToken,
          (steps) => {
            // Enviar actualización de progreso
            sendEvent('progress', {
              applicationId: application.id,
              applicationName: application.name,
              steps,
            });
          }
        );

        console.log(`\n${result.success ? '✅' : '❌'} [SSE] Resultado: ${application.name} - ${result.success ? 'ÉXITO' : 'ERROR'}`);

        // Enviar resultado final
        sendEvent('complete', {
          success: result.success,
          applicationId: application.id,
          applicationName: application.name,
          error: result.error,
          version: result.version,
          steps: result.steps,
        });

      } catch (error) {
        console.error("[SSE] Error en despliegue:", error);
        
        sendEvent('error', {
          success: false,
          applicationId: application.id,
          applicationName: application.name,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
