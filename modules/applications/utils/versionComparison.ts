/**
 * Extrae la versión major.minor de una cadena de versión
 * Ejemplo: "1.18.0.3" -> "1.18"
 */
export function getMajorMinorVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  
  const parts = version.split('.');
  if (parts.length < 2) return null;
  
  return parts.slice(0, 2).join('.');
}

/**
 * Compara si dos versiones tienen el mismo major.minor
 * Retorna true si son iguales, false si son diferentes
 */
export function isSameMajorMinor(version1: string | null | undefined, version2: string | null | undefined): boolean {
  const v1 = getMajorMinorVersion(version1);
  const v2 = getMajorMinorVersion(version2);
  
  if (!v1 || !v2) return false;
  
  return v1 === v2;
}

/**
 * Calcula cuántas instalaciones están desactualizadas comparando con la última versión
 */
export function countOutdatedInstallations(
  latestVersion: string | null | undefined,
  installations: Array<{ version?: string | null }>
): number {
  if (!latestVersion) return 0;
  
  const latestMajorMinor = getMajorMinorVersion(latestVersion);
  if (!latestMajorMinor) return 0;
  
  return installations.filter(installation => {
    const installedMajorMinor = getMajorMinorVersion(installation.version);
    if (!installedMajorMinor) return false;
    
    return installedMajorMinor !== latestMajorMinor;
  }).length;
}
