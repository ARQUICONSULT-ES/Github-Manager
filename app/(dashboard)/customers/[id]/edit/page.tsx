import { CustomerFormPage } from "@/modules/customers/pages/CustomerFormPage";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  return <CustomerFormPage customerId={id} />;
}
