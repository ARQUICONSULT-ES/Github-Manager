import { EnvironmentComparePage } from "@/modules/customers/pages/environmentCompare";

export default async function EnvironmentCompareRoute({
  params,
}: {
  params: Promise<{ 
    tenantId: string; 
    name: string; 
    compareTenantId: string; 
    compareName: string;
  }>;
}) {
  const { tenantId, name, compareTenantId, compareName } = await params;
  return (
    <EnvironmentComparePage 
      tenantId={tenantId} 
      environmentName={name}
      compareTenantId={compareTenantId}
      compareEnvironmentName={compareName}
    />
  );
}
