import { ApplicationDetailPage } from "@/modules/applications/pages/ApplicationDetailPage";

export default async function ApplicationPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  return <ApplicationDetailPage applicationId={id} />;
}
