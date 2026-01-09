import { EnvironmentDetailPage } from "@/modules/customers/pages/environmentDetail";

export default async function EnvironmentDetailRoute({
  params,
}: {
  params: Promise<{ tenantId: string; name: string }>;
}) {
  const { tenantId, name } = await params;
  return <EnvironmentDetailPage tenantId={tenantId} environmentName={name} />;
}
