/**
 * Utilidades para el módulo de repos
 */

/**
 * Calcula la siguiente versión minor basada en un tag
 */
export function getNextMinorVersion(tagName: string | null): string {
  if (!tagName) return "1.0";
  
  // Extraer números de la versión (ej: "v1.2.3" -> [1, 2, 3])
  const numbers = tagName.match(/(\d+)/g);
  if (!numbers || numbers.length < 2) return "1.0";
  
  const major = parseInt(numbers[0]);
  const minor = parseInt(numbers[1]) + 1;
  return `${major}.${minor}`;
}

/**
 * Formatea un timestamp a tiempo relativo (ej: "hace 2 días")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `hace ${diffYears} año${diffYears > 1 ? "s" : ""}`;
  if (diffMonths > 0) return `hace ${diffMonths} mes${diffMonths > 1 ? "es" : ""}`;
  if (diffWeeks > 0) return `hace ${diffWeeks} semana${diffWeeks > 1 ? "s" : ""}`;
  if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
  if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (diffMins > 0) return `hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
  return "hace un momento";
}

/**
 * Formatea el tamaño de un archivo en formato legible
 */
export function formatFileSize(size: number): string {
  return size >= 1024 * 1024 
    ? `${(size / (1024 * 1024)).toFixed(2)} MB`
    : `${(size / 1024).toFixed(2)} KB`;
}

/**
 * Extrae el owner y repo de una URL de GitHub
 */
export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/@]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Extrae solo el nombre del repositorio de una URL
 */
export function getRepoName(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/[^/]+\/([^/@]+)/);
  return match ? match[1] : repoUrl;
}
