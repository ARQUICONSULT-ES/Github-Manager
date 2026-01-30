import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const GITHUB_API_BASE = "https://api.github.com";
const ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("GITHUB_ADMIN_TOKEN is not set");
}

interface UpdateMemoryLimitRequest {
  owner: string;
  repo: string;
  baseBranch: string;
  memoryLimit: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "GITHUB_ADMIN_TOKEN no configurado" },
        { status: 500 }
      );
    }

    const body: UpdateMemoryLimitRequest = await req.json();
    const { owner, repo, baseBranch, memoryLimit } = body;

    if (!owner || !repo || !baseBranch || !memoryLimit) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    // Validar que memoryLimit sea uno de los valores permitidos
    const validMemoryLimits = ['8G', '16G', '24G', '32G'];
    if (!validMemoryLimits.includes(memoryLimit)) {
      return NextResponse.json(
        { error: "Valor de memoria no válido. Debe ser: 8G, 16G, 24G o 32G" },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // 1. Obtener SHA de la rama base
    const baseBranchRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      { headers, cache: "no-store" }
    );

    if (!baseBranchRes.ok) {
      throw new Error(`Error al obtener rama base: ${baseBranchRes.statusText}`);
    }

    const baseBranchData = await baseBranchRes.json();
    const baseSha = baseBranchData.object.sha;

    // 2. Crear nueva rama
    const newBranchName = `update-memory-limit-${Date.now()}`;
    const createBranchRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: `refs/heads/${newBranchName}`,
          sha: baseSha,
        }),
      }
    );

    if (!createBranchRes.ok) {
      throw new Error(`Error al crear rama: ${createBranchRes.statusText}`);
    }

    // 3. Obtener contenido actual de AL-Go-Settings.json
    const settingsPath = ".github/AL-Go-Settings.json";
    const settingsRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${settingsPath}?ref=${newBranchName}`,
      { headers, cache: "no-store" }
    );

    if (!settingsRes.ok) {
      throw new Error(`Error al obtener AL-Go-Settings.json: ${settingsRes.statusText}`);
    }

    const settingsData = await settingsRes.json();
    const currentContent = JSON.parse(
      Buffer.from(settingsData.content, "base64").toString("utf-8")
    );

    // 4. Actualizar el contenido con el nuevo memoryLimit
    const updatedContent = {
      ...currentContent,
      memoryLimit: memoryLimit,
    };

    const updatedContentStr = JSON.stringify(updatedContent, null, 2);
    const updatedContentBase64 = Buffer.from(updatedContentStr).toString("base64");

    // 5. Actualizar el archivo en la nueva rama
    const updateFileRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${settingsPath}`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Update memoryLimit to ${memoryLimit}`,
          content: updatedContentBase64,
          sha: settingsData.sha,
          branch: newBranchName,
        }),
      }
    );

    if (!updateFileRes.ok) {
      const errorData = await updateFileRes.json();
      throw new Error(
        `Error al actualizar archivo: ${errorData.message || updateFileRes.statusText}`
      );
    }

    // 6. Crear Pull Request
    const prBody = `## 🚀 Actualización de Límite de Memoria

Este PR actualiza el límite de memoria del contenedor Docker de compilación.

### Cambios
- **Límite de memoria**: \`${memoryLimit}\`

### Recomendaciones
- **8G**: Sin verticales, Tegos
- **16G**: Configuración media
- **24G**: Configuración alta  
- **32G**: LS Central

---
_PR generado automáticamente desde CENTRA_`;

    const createPrRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Update memoryLimit to ${memoryLimit}`,
          head: newBranchName,
          base: baseBranch,
          body: prBody,
        }),
      }
    );

    if (!createPrRes.ok) {
      const errorData = await createPrRes.json();
      throw new Error(
        `Error al crear PR: ${errorData.message || createPrRes.statusText}`
      );
    }

    const prData = await createPrRes.json();

    return NextResponse.json({
      success: true,
      pullRequestUrl: prData.html_url,
      pullRequestNumber: prData.number,
      branch: newBranchName,
    });

  } catch (error) {
    console.error("Error en update-memory-limit:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
