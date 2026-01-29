import { EnvironmentComparePage } from "@/modules/customers/pages/environmentCompare";
import { redirect } from "next/navigation";

export default async function EnvironmentCompareWithThirdRoute({
  params,
}: {
  params: Promise<{ 
    tenantId: string; 
    name: string; 
    compareTenantId: string; 
    compareName: string;
    thirdTenantId: string;
    thirdName: string;
  }>;
}) {
  const { tenantId, name, compareTenantId, compareName, thirdTenantId, thirdName } = await params;
  
  // Redirigir a la nueva ruta con query params
  const params_query = new URLSearchParams();
  params_query.append('env0', `${tenantId}/${name}`);
  params_query.append('env1', `${compareTenantId}/${compareName}`);
  params_query.append('env2', `${thirdTenantId}/${thirdName}`);
  
  redirect(`/environments/compare?${params_query.toString()}`);
}
