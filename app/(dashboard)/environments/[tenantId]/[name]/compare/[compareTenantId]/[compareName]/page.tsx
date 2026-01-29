import { EnvironmentComparePage } from "@/modules/customers/pages/environmentCompare";
import { redirect } from "next/navigation";

export default async function EnvironmentCompareRoute({
  params,
  searchParams
}: {
  params: Promise<{ 
    tenantId: string; 
    name: string; 
    compareTenantId: string; 
    compareName: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tenantId, name, compareTenantId, compareName } = await params;
  const search = await searchParams;
  
  // Si hay parámetros env en la URL, redirigir a la nueva ruta
  if (Object.keys(search).some(key => key.startsWith('env'))) {
    const queryString = new URLSearchParams(search as Record<string, string>).toString();
    redirect(`/environments/compare?${queryString}`);
  }
  
  // Construir array de entornos desde los parámetros de ruta
  const environments = [
    { tenantId, environmentName: name },
    { tenantId: compareTenantId, environmentName: compareName }
  ];
  
  return (
    <EnvironmentComparePage 
      environments={environments}
    />
  );
}
