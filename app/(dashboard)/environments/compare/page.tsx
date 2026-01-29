import { EnvironmentComparePage } from "@/modules/customers/pages/environmentCompare";
import { redirect } from "next/navigation";

export default async function EnvironmentCompareWithQueryParams({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const search = await searchParams;
  
  // Extraer los parámetros env0, env1, env2, etc.
  const environments: Array<{ tenantId: string; environmentName: string }> = [];
  
  for (let i = 0; i < 10; i++) { // Máximo 10 entornos
    const envParam = search[`env${i}`];
    if (envParam && typeof envParam === 'string') {
      const [tenantId, environmentName] = envParam.split('/');
      if (tenantId && environmentName) {
        environments.push({ tenantId, environmentName });
      }
    }
  }
  
  // Requiere al menos 2 entornos
  if (environments.length < 2) {
    redirect('/environments');
  }
  
  return (
    <EnvironmentComparePage 
      environments={environments}
    />
  );
}
