import type { Environment } from "../types";

/**
 * Ordena environments: Production primero, luego por status (Active primero)
 */
export function sortEnvironments(environments: Environment[]): Environment[] {
  return [...environments].sort((a, b) => {
    // Orden de tipos (Production primero)
    const typeOrder: Record<string, number> = {
      production: 0,
      sandbox: 1,
      test: 2,
    };

    const typeA = (a.type?.toLowerCase() || 'zzz');
    const typeB = (b.type?.toLowerCase() || 'zzz');
    const typeOrderA = typeOrder[typeA] ?? 999;
    const typeOrderB = typeOrder[typeB] ?? 999;

    if (typeOrderA !== typeOrderB) {
      return typeOrderA - typeOrderB;
    }

    // Orden de status (Active primero)
    const statusOrder: Record<string, number> = {
      active: 0,
      ready: 1,
      pending: 2,
      preparing: 3,
      mounting: 4,
      removing: 5,
      notready: 6,
    };

    const statusA = (a.status?.toLowerCase() || 'zzz');
    const statusB = (b.status?.toLowerCase() || 'zzz');
    const statusOrderA = statusOrder[statusA] ?? 999;
    const statusOrderB = statusOrder[statusB] ?? 999;

    if (statusOrderA !== statusOrderB) {
      return statusOrderA - statusOrderB;
    }

    // Si todo es igual, ordenar por nombre
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filtra environments excluyendo los soft deleted
 */
export function filterActivEnvironments(environments: Environment[]): Environment[] {
  return environments.filter(env => env.status?.toLowerCase() !== 'softdeleted');
}

/**
 * Verifica si un environment está soft deleted
 */
export function isSoftDeleted(environment: Environment): boolean {
  return environment.status?.toLowerCase() === 'softdeleted';
}
