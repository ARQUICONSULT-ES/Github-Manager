# Script para actualizar todos los endpoints de GitHub API

$files = @(
    "app/api/github/workflow-status/route.ts",
    "app/api/github/upload-dependency/route.ts",
    "app/api/github/update-settings/route.ts",
    "app/api/github/trigger-workflow/route.ts",
    "app/api/github/repo-dependencies/route.ts",
    "app/api/github/list-dependencies/route.ts",
    "app/api/github/latest-release/route.ts",
    "app/api/github/file-content/route.ts",
    "app/api/github/delete-dependency/route.ts",
    "app/api/github/compare/route.ts",
    "app/api/github/batch-releases/route.ts",
    "app/api/github/batch-info/route.ts",
    "app/api/github/analyze-app-file/route.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Procesando: $file"
        
        # Leer el contenido del archivo
        $content = Get-Content $file -Raw
        
        # Reemplazar el import de cookies por el nuevo helper
        $content = $content -replace 'import \{ cookies \} from "next/headers";', 'import { getAuthenticatedUserGitHubToken } from "@/lib/auth-github";'
        
        # Reemplazar el patrón de obtención del token
        $content = $content -replace '(?s)const cookieStore = await cookies\(\);\s+const token = cookieStore\.get\("github_token"\)\?\.value;\s+if \(!token\) \{\s+return NextResponse\.json\(\{ error: "No autenticado" \}, \{ status: 401 \}\);', 'const token = await getAuthenticatedUserGitHubToken();\n\n  if (!token) {\n    return NextResponse.json(\n      { error: "No GitHub token found. Please add your GitHub token in your profile." },\n      { status: 401 }\n    );'
        
        # Guardar el archivo modificado
        Set-Content -Path $file -Value $content -NoNewline
        
        Write-Host "  ✓ Actualizado" -ForegroundColor Green
    } else {
        Write-Host "  ✗ No encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nTodos los archivos han sido procesados." -ForegroundColor Cyan
