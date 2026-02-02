import { GitHubRepository, GitHubUser, GitHubPullRequest } from "@/types/github";

const GITHUB_API_URL = "https://api.github.com";

/**
 * Obtiene todos los repositorios del usuario autenticado (con paginación)
 */
export async function getUserRepos(token: string): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const res = await fetch(
        `${GITHUB_API_URL}/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const repos: GitHubRepository[] = await res.json();
      allRepos.push(...repos);

      // Si recibimos menos de perPage, ya no hay más páginas
      if (repos.length < perPage) {
        break;
      }

      page++;
    }

    return allRepos;
  } catch (error) {
    console.error("Error fetching user repos:", error);
    throw error;
  }
}

/**
 * Obtiene la información del usuario autenticado
 */
export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
  try {
    const res = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching authenticated user:", error);
    throw error;
  }
}

/**
 * Obtiene los pull requests abiertos de un repositorio
 */
export async function getPullRequests(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubPullRequest[]> {
  try {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls?state=open&per_page=100`;
    console.log(`[getPullRequests] Fetching PRs from: ${url}`);
    console.log(`[getPullRequests] Owner: ${owner}, Repo: ${repo}`);
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[getPullRequests] Error response:`, errorBody);
      throw new Error(`GitHub API error: ${res.status} ${res.statusText} - ${errorBody}`);
    }

    const prs = await res.json();
    console.log(`[getPullRequests] Found ${prs.length} open PRs`);
    
    // Obtener el estado de los checks para cada PR usando Checks API
    const prsWithChecks = await Promise.all(
      prs.map(async (pr: any) => {
        try {
          // Usar Checks API (más moderno, incluye GitHub Actions)
          const checksUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`;
          console.log(`[getPullRequests] Fetching checks for PR #${pr.number}: ${checksUrl}`);
          
          const checksRes = await fetch(checksUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          });

          if (checksRes.ok) {
            const checksData = await checksRes.json();
            const checkRuns = checksData.check_runs || [];
            
            console.log(`[getPullRequests] PR #${pr.number} has ${checkRuns.length} check runs`);
            
            // Determinar el estado general
            let overallConclusion: 'success' | 'failure' | 'pending' | null = null;
            let overallStatus: 'queued' | 'in_progress' | 'completed' | null = null;
            
            if (checkRuns.length > 0) {
              // Si algún check está en progreso o en cola
              const hasInProgress = checkRuns.some((run: any) => 
                run.status === 'queued' || run.status === 'in_progress'
              );
              
              if (hasInProgress) {
                overallStatus = 'in_progress';
                overallConclusion = 'pending';
              } else {
                // Todos están completados
                overallStatus = 'completed';
                
                // Si alguno falló, el resultado general es failure
                const hasFailed = checkRuns.some((run: any) => 
                  run.conclusion === 'failure' || 
                  run.conclusion === 'timed_out' || 
                  run.conclusion === 'cancelled'
                );
                
                if (hasFailed) {
                  overallConclusion = 'failure';
                } else {
                  // Si todos pasaron o fueron neutral/skipped
                  const allSuccess = checkRuns.every((run: any) => 
                    run.conclusion === 'success' || 
                    run.conclusion === 'neutral' || 
                    run.conclusion === 'skipped'
                  );
                  
                  overallConclusion = allSuccess ? 'success' : null;
                }
              }
            }
            
            return {
              ...pr,
              checks: {
                conclusion: overallConclusion,
                status: overallStatus,
                total_count: checkRuns.length,
                check_runs: checkRuns.map((run: any) => ({
                  name: run.name,
                  status: run.status,
                  conclusion: run.conclusion,
                })),
              },
            };
          } else {
            console.log(`[getPullRequests] Failed to fetch checks for PR #${pr.number}: ${checksRes.status}`);
          }
        } catch (error) {
          console.error(`Error fetching checks for PR #${pr.number}:`, error);
        }
        return pr;
      })
    );
    
    return prsWithChecks;
  } catch (error) {
    console.error("Error fetching pull requests:", error);
    throw error;
  }
}
