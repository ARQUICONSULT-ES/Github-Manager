import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserGitHubToken } from "@/lib/auth-github";

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthenticatedUserGitHubToken();

    if (!token) {
      return NextResponse.json(
        { error: "No GitHub token found. Please add your GitHub token in your profile." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Faltan parámetros owner o repo" },
        { status: 400 }
      );
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/branches`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const branches = await response.json();
    
    // Extraer solo nombre de cada branch
    const branchNames = branches.map((branch: { name: string }) => branch.name);
    
    return NextResponse.json({ branches: branchNames });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener branches" },
      { status: 500 }
    );
  }
}
