import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserGitHubToken } from "@/lib/auth-github";

const GITHUB_API_URL = "https://api.github.com";

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthenticatedUserGitHubToken();

    if (!token) {
      return NextResponse.json(
        { error: "No GitHub token found. Please add your GitHub token in your profile." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { owner, repo, workflow, ref = "main", inputs = {} } = body;

    if (!owner || !repo || !workflow) {
      return NextResponse.json(
        { error: "Faltan parámetros: owner, repo, workflow" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref,
          inputs,
        }),
      }
    );

    // GitHub devuelve 204 No Content cuando es exitoso
    if (res.status === 204) {
      return NextResponse.json({ success: true });
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error: ${res.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al ejecutar workflow" },
      { status: 500 }
    );
  }
}
